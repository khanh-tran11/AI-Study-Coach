"""
Lambda: POST /api/progress/update
Matches hartnell-trainer/server/routes/progress.js's POST /update route
exactly — same request body fields, same module-completion logic (a module
is complete once every step written for it has status "completed"), same
response shape.
"""

import json
import logging
from datetime import datetime, timezone
from decimal import Decimal

from progress_common import compute_stats, table

logger = logging.getLogger()
logger.setLevel(logging.INFO)

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
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

    try:
        payload = json.loads(event.get("body") or "{}")
    except (TypeError, json.JSONDecodeError):
        return _response(400, {"error": "Request body must be valid JSON."})

    user_id = payload.get("userId")
    module_id = payload.get("moduleId")
    step_id = payload.get("stepId")
    status = payload.get("status")
    time_spent_seconds = payload.get("timeSpentSeconds", 0)

    if not user_id or module_id is None or not step_id:
        return _response(400, {"error": "userId, moduleId, and stepId are required."})

    module_id = str(module_id)  # DynamoDB map keys (and the frontend's own
    # stats.modules?.[String(i + 1)] lookup) both expect string keys
    now = datetime.now(timezone.utc).isoformat()

    try:
        existing = table.get_item(Key={"userId": user_id}).get("Item")
        item = existing or {"userId": user_id, "totalSeconds": Decimal(0), "modules": {}}

        modules = item.get("modules", {})
        module = modules.get(module_id, {"steps": {}, "completedAt": None})
        steps = module.get("steps", {})

        steps[step_id] = {"status": status, "updatedAt": now}
        module["steps"] = steps

        # Mark module complete once every step written for it is completed
        if status == "completed" and all(s.get("status") == "completed" for s in steps.values()):
            module["completedAt"] = now

        modules[module_id] = module
        item["modules"] = modules
        item["totalSeconds"] = Decimal(str(item.get("totalSeconds", 0))) + Decimal(str(time_spent_seconds))

        table.put_item(Item=item)

        return _response(200, {"success": True, "progress": compute_stats(item)})
    except Exception:
        logger.exception("Failed to update progress for userId=%r", user_id)
        return _response(500, {"error": "Internal server error."})
