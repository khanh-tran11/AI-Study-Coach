"""
AI Trainer — Canvas Onboarding Agent
Query module implementing the two-step retrieve -> generate pattern.

Why two steps: the `canvasAITrainer` knowledge base is a MANAGED-type KB,
which does not support Bedrock's built-in `retrieve_and_generate` API.
We call `retrieve` ourselves for the search step, then call a Bedrock
model directly for the generation step, combining the two manually.

This mirrors the exact pattern validated interactively via Claude Code
earlier in the project: re-synced KB, cross-content-type retrieval checks,
and a grounded refusal test on an out-of-scope question.
"""

import json
import boto3
from dataclasses import dataclass, field
from typing import Optional

# ---- Configuration -----------------------------------------------------

KNOWLEDGE_BASE_ID = "3GKR6EM7I6"       # canvasAITrainer-v2, us-west-2, account 807462092040
GENERATION_MODEL_ID = "us.anthropic.claude-sonnet-4-5-20250929-v1:0"  # inference profile ID; on-demand model IDs errored with ResourceNotFoundException
AWS_REGION = "us-west-2"

# Below this relevance score, a chunk is treated as noise and dropped
# before it ever reaches the generation step. Derived from real testing:
# on-topic queries scored 0.59-0.84, an out-of-scope query topped out at 0.49.
RELEVANCE_THRESHOLD = 0.50

# Validated during testing: this exact instruction caused the model to
# correctly refuse an out-of-scope question instead of hallucinating.
SYSTEM_PROMPT = (
    "Answer ONLY using the provided context. If the context does not "
    "contain the answer, say you don't have that information rather "
    "than guessing. When you do answer, mention which source document "
    "the information came from."
)

bedrock_agent_runtime = boto3.client("bedrock-agent-runtime", region_name=AWS_REGION)
bedrock_runtime = boto3.client("bedrock-runtime", region_name=AWS_REGION)


# ---- Data shape ----------------------------------------------------------

@dataclass
class RetrievedChunk:
    text: str
    score: float
    source_title: str
    source_uri: str
    chunk_id: str


@dataclass
class QueryResult:
    answer: str
    grounded: bool               # False if no chunk cleared the relevance threshold
    sources: list = field(default_factory=list)   # list of source_title strings actually used
    raw_chunks: list = field(default_factory=list)  # full RetrievedChunk list, for debugging/logging


# ---- Step 1: retrieve ------------------------------------------------------

def retrieve_chunks(query: str, number_of_results: int = 5) -> list[RetrievedChunk]:
    """Call the KB's retrieve API and parse the raw response into RetrievedChunk objects."""
    response = bedrock_agent_runtime.retrieve(
        knowledgeBaseId=KNOWLEDGE_BASE_ID,
        retrievalQuery={"text": query},
        retrievalConfiguration={
            "managedSearchConfiguration": {"numberOfResults": number_of_results}
        },
    )

    chunks = []
    for result in response.get("retrievalResults", []):
        chunks.append(
            RetrievedChunk(
                text=result["content"]["text"],
                score=result["score"],
                source_title=result["metadata"].get("_document_title", "unknown"),
                source_uri=result["metadata"].get("_source_uri", ""),
                chunk_id=result["metadata"].get("_chunk_id", ""),
            )
        )
    return chunks


# ---- Step 2: generate -------------------------------------------------------

def generate_answer(query: str, chunks: list[RetrievedChunk]) -> str:
    """Feed filtered chunks + the strict grounding system prompt to the model."""
    if not chunks:
        # No need to even call the model, we already know there's nothing relevant.
        return "I don't have that information in my training materials."

    context_block = "\n\n---\n\n".join(
        f"[Source: {c.source_title}]\n{c.text}" for c in chunks
    )

    user_message = (
        f"Context:\n{context_block}\n\n"
        f"Question: {query}"
    )

    response = bedrock_runtime.converse(
        modelId=GENERATION_MODEL_ID,
        system=[{"text": SYSTEM_PROMPT}],
        messages=[{"role": "user", "content": [{"text": user_message}]}],
    )

    return response["output"]["message"]["content"][0]["text"]


# ---- Refusal detection ------------------------------------------------------

# Phrasings the model tends to use when it follows SYSTEM_PROMPT's refusal
# instruction. A high relevance score doesn't guarantee the model actually
# found an answer in the chunk (e.g. an irrelevant chunk can still clear
# RELEVANCE_THRESHOLD), so grounded is derived from the answer text itself
# rather than from retrieval scores alone.
REFUSAL_PATTERNS = (
    "i don't have that information",
    "i don't have information",
    "the context does not contain",
    "does not contain the answer",
    "does not contain any information",
    "doesn't contain the answer",
    "doesn't contain any information",
)


def _is_refusal(answer: str) -> bool:
    lowered = answer.strip().lower()
    return any(pattern in lowered for pattern in REFUSAL_PATTERNS)


# ---- Combined entry point --------------------------------------------------

def query_knowledge_base(query: str) -> QueryResult:
    """
    The function your app/API layer should actually call.
    Handles retrieval, threshold filtering, generation, and grounding metadata
    in one place so callers don't touch the raw Bedrock response shape.
    """
    all_chunks = retrieve_chunks(query)
    relevant_chunks = [c for c in all_chunks if c.score >= RELEVANCE_THRESHOLD]

    answer = generate_answer(query, relevant_chunks)
    grounded = not _is_refusal(answer)

    return QueryResult(
        answer=answer,
        grounded=grounded,
        sources=list({c.source_title for c in relevant_chunks}) if grounded else [],
        raw_chunks=all_chunks,
    )


# ---- Manual test runner -----------------------------------------------------

if __name__ == "__main__":
    test_questions = [
        "How do I change the name of my course?",
        "What are the steps to customize my dashboard?",
        "What do I need to submit for the Organize Your Dashboard assignment?",
        "How do I reset my Canvas password?",  # should be refused, out of scope
    ]

    for q in test_questions:
        result = query_knowledge_base(q)
        print(f"\nQ: {q}")
        print(f"Grounded: {result.grounded}")
        print(f"Sources: {result.sources}")
        print(f"A: {result.answer}")
        print("-" * 60)
