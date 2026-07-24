"""
AWS Lambda handler wrapping query_knowledge_base() for API Gateway
(HTTP API, Lambda proxy integration).

Expects a POST body of: {"question": "..."}
Returns: {"answer": str, "grounded": bool, "sources": [str, ...]}
"""

import json
import logging

from canvas_ai_trainer_query import query_knowledge_base

logger = logging.getLogger()
logger.setLevel(logging.INFO)

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
}


def _response(status_code: int, body: dict) -> dict:
    return {
        "statusCode": status_code,
        "headers": CORS_HEADERS,
        "body": json.dumps(body),
    }


def lambda_handler(event, context):
    # HTTP API preflight requests arrive as OPTIONS; API Gateway's own CORS
    # config normally short-circuits these before they reach Lambda, but
    # handle it here too in case the route is ever invoked directly.
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return _response(200, {})

    try:
        raw_body = event.get("body") or "{}"
        payload = json.loads(raw_body)
    except (TypeError, json.JSONDecodeError):
        return _response(400, {"error": "Request body must be valid JSON."})

    question = payload.get("question")
    if not isinstance(question, str) or not question.strip():
        return _response(400, {"error": "Missing or empty 'question' field."})

    try:
        result = query_knowledge_base(question)
    except Exception:
        logger.exception("query_knowledge_base failed for question: %r", question)
        return _response(500, {"error": "Internal server error."})

    return _response(
        200,
        {
            "answer": result.answer,
            "grounded": result.grounded,
            "sources": result.sources,
        },
    )
