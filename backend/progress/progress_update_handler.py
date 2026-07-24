"""
Lambda: POST /api/progress/update

Called by the React frontend (via Carlos's Express proxy) every time a
learner completes a step or finishes a module.

Request body
────────────
{
  "userId":           "2",
  "moduleId":         "1",
  "stepId":           "1-2",
  "status":           "completed" | "in_progress",
  "timeSpentSeconds": 180,
  "name":             "Dr. Maria Santos",   // optional – stored for admin view
  "email":            "m.santos@hartnell.edu" // optional
}

Response body (200)
───────────────────
{ "success": true, "progress": <user-stats summary> }

Unified schema write
────────────────────
One DynamoDB row per (userId, moduleId).  On each call we:
  1. Load (or create) the row for this user+module.
  2. Upsert the step status inside the steps map.
  3. Accumulate timeSpentSeconds.
  4. If all steps are "completed" → mark module completed + run cheating check.
  5. Always update lastActiveAt; set firstLoginAt on first ever write.
  6. Write the full row back with put_item (simpler than a large UpdateExpression).
  7. Return the aggregated user-stats summary the frontend already expects.
"""
import json
import logging
from datetime import datetime, timezone
from decimal import Decimal

from progress_common import (
    TABLE_NAME,
    MODULE_TITLES,
    _now_iso,
    _decimal,
    _to_float,
    evaluate_alert,
    get_empty_module_row,
    get_module_row,
    get_all_module_rows,
    compute_user_stats,
    table,
)

logger = logging.getLogger()
logger.setLevel(logging.INFO)

CORS_HEADERS = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type":                 "application/json",
}


# ── Serialisation ─────────────────────────────────────────────────────────────
def _serial(obj):
    """json.dumps default – converts Decimal to int or float."""
    if isinstance(obj, Decimal):
        return int(obj) if obj == obj.to_integral_value() else float(obj)
    raise TypeError


def _response(status_code: int, body: dict) -> dict:
    return {
        "statusCode": status_code,
        "headers":    CORS_HEADERS,
        "body":       json.dumps(body, default=_serial),
    }


# ── Handler ───────────────────────────────────────────────────────────────────
def lambda_handler(event, context):
    # CORS pre-flight
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return _response(200, {})

    # Parse body
    try:
        payload = json.loads(event.get("body") or "{}")
    except (TypeError, json.JSONDecodeError):
        return _response(400, {"error": "Request body must be valid JSON."})

    user_id           = payload.get("userId")
    module_id         = str(payload.get("moduleId", ""))
    step_id           = payload.get("stepId")
    status            = payload.get("status", "in_progress")
    time_spent_secs   = float(payload.get("timeSpentSeconds", 0))
    # Optional identity fields – passed by frontend on first touch of each module
    learner_name      = payload.get("name", "")
    learner_email     = payload.get("email", "")

    if not user_id or not module_id or not step_id:
        return _response(400, {"error": "userId, moduleId, and stepId are required."})

    now = _now_iso()

    try:
        # ── 1. Load or create row ─────────────────────────────────────────────
        row = get_module_row(user_id, module_id)
        if row is None:
            row = get_empty_module_row(user_id, module_id, learner_name, learner_email)

        # Backfill name/email if we just learned them
        if learner_name and not row.get("name"):
            row["name"] = learner_name
        if learner_email and not row.get("email"):
            row["email"] = learner_email

        # ── 2. Record first-ever activity timestamp ───────────────────────────
        if not row.get("firstLoginAt"):
            row["firstLoginAt"] = now

        # ── 3. Update the step inside the steps map ───────────────────────────
        steps = dict(row.get("steps") or {})
        steps[step_id] = {"status": status, "updatedAt": now}
        row["steps"] = steps

        # ── 4. Accumulate time spent ──────────────────────────────────────────
        row["timeSpentSeconds"] = _decimal(
            _to_float(row.get("timeSpentSeconds", 0)) + time_spent_secs
        )

        # ── 5. Determine module-level progress ────────────────────────────────
        all_steps_done = bool(steps) and all(
            s.get("status") == "completed" for s in steps.values()
        )

        if all_steps_done and status == "completed":
            # Only mark completed if not already done (avoid overwriting timestamp)
            if not row.get("completedAt"):
                row["completedAt"] = now
                row["progress"]    = "completed"

                # Cheating check – runs once when module first completes
                total_seconds_on_module = _to_float(row["timeSpentSeconds"])
                new_count, new_status = evaluate_alert(row, total_seconds_on_module)
                row["alert_count"]  = new_count
                row["alert_status"] = new_status

                if new_status == "cheating_reported":
                    logger.warning(
                        "Cheating flag: userId=%s module=%s time=%.0fs",
                        user_id, module_id, total_seconds_on_module,
                    )
        elif row.get("progress") != "completed":
            # Module touched but not finished yet
            row["progress"] = "in_progress"

        # ── 6. Always refresh lastActiveAt ────────────────────────────────────
        row["lastActiveAt"] = now

        # ── 7. Persist the full row ───────────────────────────────────────────
        table.put_item(Item=row)
        logger.info("Progress saved: userId=%s moduleId=%s stepId=%s status=%s",
                    user_id, module_id, step_id, status)

        # ── 8. Build user-level stats summary for the frontend ────────────────
        all_rows = get_all_module_rows(user_id)
        stats    = compute_user_stats(all_rows)

        return _response(200, {"success": True, "progress": stats})

    except Exception:
        logger.exception("Failed to update progress for userId=%r moduleId=%r",
                         user_id, module_id)
        return _response(500, {"error": "Internal server error."})
