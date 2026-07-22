import json
import boto3
import os

# Initialize Bedrock Agent Runtime client
bedrock_agent = boto3.client("bedrock-agent-runtime", region_name=os.environ.get("AWS_REGION", "us-east-1"))

# Your Knowledge Base ID (set in Lambda environment variables)
KNOWLEDGE_BASE_ID = os.environ["KNOWLEDGE_BASE_ID"]

# The foundation model to use for generation
MODEL_ARN = os.environ.get(
    "MODEL_ARN",
    "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-haiku-20240307-v1:0"
)


def lambda_handler(event, context):
    """
    Handles incoming chat requests from API Gateway.
    
    Expected request body:
    {
        "message": "How do I set up a Canvas shell?",
        "module": 1,
        "sessionId": "optional-session-id-for-conversation-memory"
    }
    """
    try:
        # Parse the request body
        body = json.loads(event.get("body", "{}"))
        user_message = body.get("message", "").strip()
        current_module = body.get("module", 1)
        session_id = body.get("sessionId")

        if not user_message:
            return build_response(400, {"error": "Message is required"})

        # Add module context to help the RAG focus its response
        augmented_query = (
            f"The user is currently on Module {current_module} of Canvas onboarding training. "
            f"User question: {user_message}"
        )

        # Build the RetrieveAndGenerate request
        rag_params = {
            "input": {"text": augmented_query},
            "retrieveAndGenerateConfiguration": {
                "type": "KNOWLEDGE_BASE",
                "knowledgeBaseConfiguration": {
                    "knowledgeBaseId": KNOWLEDGE_BASE_ID,
                    "modelArn": MODEL_ARN,
                    "retrievalConfiguration": {
                        "vectorSearchConfiguration": {
                            "numberOfResults": 5  # top-K chunks to retrieve
                        }
                    }
                }
            }
        }

        # Include session ID for multi-turn conversation memory
        if session_id:
            rag_params["sessionId"] = session_id

        # Call Bedrock Knowledge Base
        response = bedrock_agent.retrieve_and_generate(**rag_params)

        # Extract the generated response
        output_text = response["output"]["text"]
        returned_session_id = response.get("sessionId", "")

        # Extract citations if available
        citations = []
        for citation in response.get("citations", []):
            for ref in citation.get("retrievedReferences", []):
                source = ref.get("location", {}).get("s3Location", {}).get("uri", "")
                if source:
                    citations.append(source)

        return build_response(200, {
            "reply": output_text,
            "sessionId": returned_session_id,
            "citations": list(set(citations)),  # deduplicate
            "module": current_module
        })

    except KeyError as e:
        return build_response(400, {"error": f"Missing required field: {str(e)}"})
    except Exception as e:
        print(f"Error: {str(e)}")
        return build_response(500, {"error": "Internal server error"})


def build_response(status_code, body):
    """Build an API Gateway-compatible response with CORS headers."""
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",  # Restrict to your domain in production
            "Access-Control-Allow-Headers": "Content-Type,X-Api-Key",
            "Access-Control-Allow-Methods": "POST,OPTIONS"
        },
        "body": json.dumps(body)
    }
