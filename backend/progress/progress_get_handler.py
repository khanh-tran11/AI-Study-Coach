"""
Lambda: GET /api/progress/{userId}
Matches hartnell-trainer/server/routes/progress.js's GET /:userId route
exactly — same response shape, same empty-state behavior for unknown users.
"""

import json
import logging
from decimal import Decimal

from progress_common import get_user_stats

logger = logging.getLogger()
logger.setLevel(logging.INFO)

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json",
}


def _decimal_default(obj):
    if isinstance(obj, Decimal):
        return int(obj) if obj == obj.to_integral_value() else float(obj)
    raise TypeError


def _response(status_code: int, body: dict) -> dict:
    return {
        "statusCode": status_code,
        "headers": CORS_HEADERS,
        "body": json.dumps(body, default=_decimal_default),
    }


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return _response(200, {})

    user_id = (event.get("pathParameters") or {}).get("userId")
    if not user_id:
        return _response(400, {"error": "Missing userId path parameter."})

    try:
        return _response(200, get_user_stats(user_id))
    except Exception:
        logger.exception("Failed to fetch progress for userId=%r", user_id)
        return _response(500, {"error": "Internal server error."})
