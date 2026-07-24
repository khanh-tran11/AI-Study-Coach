"""
Lambda: GET /api/progress/{userId}

Returns the aggregated progress summary for one learner.
Response shape is identical to what ProgressDashboard.jsx and
TrainingPage.jsx already expect – no frontend changes needed.

Response body (200)
───────────────────
{
  "userId":           "2",
  "completedModules": 3,
  "totalModules":     10,
  "completionPct":    30,
  "totalHours":       1.4,
  "modules": {
    "1": {
      "progress":         "completed",
      "completedAt":      "2026-07-23T10:00:00+00:00",
      "lastActiveAt":     "2026-07-23T10:00:00+00:00",
      "timeSpentSeconds": 2700,
      "steps":            { "1-1": { "status": "completed", ... }, ... }
    },
    ...
  }
}
"""
import json
import logging
from decimal import Decimal

from progress_common import get_user_stats

logger = logging.getLogger()
logger.setLevel(logging.INFO)

CORS_HEADERS = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type":                 "application/json",
}


def _serial(obj):
    if isinstance(obj, Decimal):
        return int(obj) if obj == obj.to_integral_value() else float(obj)
    raise TypeError


def _response(status_code: int, body: dict) -> dict:
    return {
        "statusCode": status_code,
        "headers":    CORS_HEADERS,
        "body":       json.dumps(body, default=_serial),
    }


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return _response(200, {})

    user_id = (event.get("pathParameters") or {}).get("userId")
    if not user_id:
        return _response(400, {"error": "Missing userId path parameter."})

    try:
        stats = get_user_stats(user_id)
        return _response(200, stats)
    except Exception:
        logger.exception("Failed to fetch progress for userId=%r", user_id)
        return _response(500, {"error": "Internal server error."})
