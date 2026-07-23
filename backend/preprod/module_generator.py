"""
Lambda: S3-triggered (ObjectCreated on raw/*)

Reads a raw uploaded file, asks Claude (via Bedrock converse) to turn it
into a structured training module matching the schema already used in
the production pipeline's lesson JSON (title + content_blocks), and writes
the result to processed/<name>.json for canvasAITrainer-preprod to index.

Current scope: real end-to-end extraction only for .txt uploads. Other
accepted types (.pdf/.docx/.doc/.pptx/.ppt/.mp4/.mov) are logged and
skipped rather than faked — see backend/README.md's preprod section for
what real extraction would require for each format.
"""

import json
import logging
import os
import urllib.parse
from datetime import datetime, timezone

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

GENERATION_MODEL_ID = os.environ.get(
    "GENERATION_MODEL_ID", "us.anthropic.claude-sonnet-4-5-20250929-v1:0"
)

TEXT_EXTRACTABLE_EXTENSIONS = {".txt"}
KNOWN_UNSUPPORTED_EXTENSIONS = {".pdf", ".docx", ".doc", ".pptx", ".ppt", ".mp4", ".mov"}

MODULE_GENERATION_SYSTEM_PROMPT = (
    "You convert raw training material text into a structured training "
    "module. Respond with ONLY valid JSON (no markdown fences, no prose "
    "before or after) matching exactly this shape: "
    '{"title": "<short descriptive title>", "content_blocks": '
    '[{"tag": "p"|"li"|"h3", "text": "<block text>"}, ...]}. '
    "Break the content into logical paragraphs (tag p), bullet points for "
    "lists of steps or options (tag li), and section headers where useful "
    "(tag h3). Preserve the actual instructional content faithfully — do "
    "not invent steps that aren't in the source text."
)

s3 = boto3.client("s3")
bedrock_runtime = boto3.client("bedrock-runtime")


def _generate_module_json(raw_text: str, source_filename: str) -> dict:
    user_message = f"Source file: {source_filename}\n\nRaw content:\n{raw_text}"

    response = bedrock_runtime.converse(
        modelId=GENERATION_MODEL_ID,
        system=[{"text": MODULE_GENERATION_SYSTEM_PROMPT}],
        messages=[{"role": "user", "content": [{"text": user_message}]}],
    )
    raw_output = response["output"]["message"]["content"][0]["text"].strip()

    # Defensive: strip markdown code fences if the model adds them anyway.
    if raw_output.startswith("```"):
        raw_output = raw_output.strip("`")
        if raw_output.startswith("json"):
            raw_output = raw_output[4:].strip()

    module = json.loads(raw_output)  # let this raise if the model didn't return valid JSON
    module["source_file"] = source_filename
    module["generated_at"] = datetime.now(timezone.utc).isoformat()
    return module


def lambda_handler(event, context):
    for record in event.get("Records", []):
        bucket = record["s3"]["bucket"]["name"]
        key = urllib.parse.unquote_plus(record["s3"]["object"]["key"])

        filename = os.path.basename(key)
        ext = os.path.splitext(filename)[1].lower()

        if ext in KNOWN_UNSUPPORTED_EXTENSIONS:
            logger.warning(
                "Skipping %s: %s extraction is not implemented yet (see "
                "backend/README.md preprod section).",
                key,
                ext,
            )
            continue

        if ext not in TEXT_EXTRACTABLE_EXTENSIONS:
            logger.warning("Skipping %s: unrecognized extension %s.", key, ext)
            continue

        try:
            obj = s3.get_object(Bucket=bucket, Key=key)
            raw_text = obj["Body"].read().decode("utf-8", errors="replace")

            module = _generate_module_json(raw_text, filename)

            processed_key = f"processed/{os.path.splitext(filename)[0]}.json"
            s3.put_object(
                Bucket=bucket,
                Key=processed_key,
                Body=json.dumps(module, indent=2).encode("utf-8"),
                ContentType="application/json",
            )
            logger.info("Generated module %s from %s", processed_key, key)
        except Exception:
            logger.exception("Failed to generate module for %s", key)
            # Don't re-raise: one bad file shouldn't fail the whole batch
            # of S3 event records in this invocation.
            continue
