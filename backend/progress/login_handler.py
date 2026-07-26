"""
Lambda: POST /api/auth/login  (or called internally after auth succeeds)

Records a login event for the user so the manager dashboard can see:
  - firstLoginAt  – when the user first ever accessed the system
  - lastActiveAt  – updated on every login

This handler proxies the existing auth logic and then calls
db.record_login() to initialise / update all 10 module rows for the user.

It can also be called directly from Carlos's Express auth route
(server/routes/auth.js) via a fire-and-forget POST to this Lambda,
so the Node server doesn't need to import Python code.

Request body
────────────
{ "userId": "2", "name": "Dr. Maria Santos", "email": "m.santos@hartnell.edu" }

Response body (200)
───────────────────
{ "success": true }
"""
import json
import logging
import os

import boto3
from progress_common import TABLE_NAME, AWS_REGION, MODULE_TITLES, _now_iso

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
table    = dynamodb.Table(TABLE_NAME)

CORS_HEADERS = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type":                 "application/json",
}


def _response(status_code: int, body: dict) -> dict:
    return {
        "statusCode": status_code,
        "headers":    CORS_HEADERS,
        "body":       json.dumps(body),
    }


def record_login(user_id: str, name: str, email: str) -> None:
    """
    Upserts all 10 module rows for the user.
    - firstLoginAt  is written ONLY on the very first login (if_not_exists).
    - lastActiveAt  is refreshed on every call.
    - All other fields are initialised to safe defaults if missing.
    """
    now = _now_iso()
    for module_id, module_name in MODULE_TITLES.items():
        table.update_item(
            Key={"userId": user_id, "moduleId": module_id},
            UpdateExpression=(
                "SET #n                = if_not_exists(#n, :name), "
                "email                = if_not_exists(email, :email), "
                "moduleName           = if_not_exists(moduleName, :mn), "
                "progress             = if_not_exists(progress, :ns), "
                "firstLoginAt         = if_not_exists(firstLoginAt, :now), "
                "lastActiveAt         = :now, "
                "alert_count          = if_not_exists(alert_count, :zero), "
                "alert_status         = if_not_exists(alert_status, :normal), "
                "locked               = if_not_exists(locked, :false), "
                "verification_status  = if_not_exists(verification_status, :none), "
                "contact_requested    = if_not_exists(contact_requested, :false), "
                "timeSpentSeconds     = if_not_exists(timeSpentSeconds, :zero)"
            ),
            ExpressionAttributeNames={"#n": "name"},
            ExpressionAttributeValues={
                ":name":   name,
                ":email":  email,
                ":mn":     module_name,
                ":ns":     "not_started",
                ":now":    now,
                ":zero":   0,
                ":normal": "normal",
                ":false":  False,
                ":none":   "none",
            },
        )


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return _response(200, {})

    try:
        payload = json.loads(event.get("body") or "{}")
    except (TypeError, json.JSONDecodeError):
        return _response(400, {"error": "Request body must be valid JSON."})

    user_id = payload.get("userId")
    name    = payload.get("name", "")
    email   = payload.get("email", "")

    if not user_id:
        return _response(400, {"error": "userId is required."})

    try:
        record_login(user_id, name, email)
        logger.info("Login recorded: userId=%s name=%s", user_id, name)
        return _response(200, {"success": True})
    except Exception:
        logger.exception("Failed to record login for userId=%r", user_id)
        return _response(500, {"error": "Internal server error."})
