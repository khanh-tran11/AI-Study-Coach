"""
manager-side/db.py

DynamoDB access layer for the manager Flask dashboard.

Reads from the SAME table as Amir's progress Lambdas:
  canvas-ai-trainer-module-progress  (us-west-2)

Schema (one row per user per module)
─────────────────────────────────────
PK  userId      string   – auth.js IDs "1"…"5"
SK  moduleId    string   – "1"…"10"

Admin-visible fields written by the progress Lambda:
  moduleName            human-readable title
  name                  learner display name
  email                 learner email
  progress              "not_started" | "in_progress" | "completed"
  steps                 map of stepId → {status, updatedAt}
  timeSpentSeconds      cumulative seconds
  completedAt           ISO timestamp or null
  lastActiveAt          ISO timestamp of last step touch
  firstLoginAt          ISO timestamp of first ever activity
  alert_count           int – fast-completion warnings
  alert_status          "normal" | "warning" | "cheating_reported"
  locked                bool
  verification_status   "none" | "pending" | "passed" | "failed"
  contact_requested     bool
  contact_message       string

GSI  moduleId-progress-index  on (moduleId, progress)
     – used by get_employees_by_module()
"""

import os
from datetime import datetime, timedelta
from decimal import Decimal

import boto3
from boto3.dynamodb.conditions import Key

# ── Config ────────────────────────────────────────────────────────────────────
TABLE_NAME   = os.environ.get("PROGRESS_TABLE_NAME", "canvas-ai-trainer-module-progress")
AWS_REGION   = os.environ.get("AWS_REGION", "us-west-2")

EXPECTED_MODULE_TIME   = 30   # minutes – used for analytics comparison
FAST_THRESHOLD         = 5    # minutes – below this is suspicious
MAX_WARNINGS           = 3    # warnings before cheating_reported
MODULE_DEADLINE_DAYS   = 7    # days allowed per module

# Canonical order – must match Carlos's TrainingPage.jsx MODULE_TITLES
MODULE_ORDER = [
    "Canvas Orientation",
    "Setting Up Your Shell",
    "Course Content Upload",
    "Assignments & Quizzes",
    "Gradebook & Exports",
    "Communication Tools",
    "Accessibility Standards",
    "Student View & Testing",
    "LMS Admin Intro",
    "Capstone & Certification",
]

# Map title → moduleId string (for cross-referencing with SK)
MODULE_TITLE_TO_ID = {title: str(i + 1) for i, title in enumerate(MODULE_ORDER)}
MODULE_ID_TO_TITLE = {str(i + 1): title for i, title in enumerate(MODULE_ORDER)}

# ── DynamoDB client ───────────────────────────────────────────────────────────
dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
table    = dynamodb.Table(TABLE_NAME)


# ── Internal helpers ──────────────────────────────────────────────────────────
def _now_iso() -> str:
    return datetime.utcnow().isoformat()


def _to_float(value) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _to_int(value) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def _normalise_row(item: dict) -> dict:
    """
    Ensure every admin-visible field exists with a safe default so the
    dashboard templates never need to guard against missing keys.
    Also converts Decimal → float/int for JSON serialisation.
    """
    item.setdefault("moduleName",          MODULE_ID_TO_TITLE.get(str(item.get("moduleId", "")), "Unknown"))
    item.setdefault("name",                "Unknown")
    item.setdefault("email",               "")
    item.setdefault("progress",            "not_started")
    item.setdefault("steps",               {})
    item.setdefault("completedAt",         None)
    item.setdefault("lastActiveAt",        None)
    item.setdefault("firstLoginAt",        None)
    item.setdefault("alert_count",         0)
    item.setdefault("alert_status",        "normal")
    item.setdefault("locked",              False)
    item.setdefault("verification_status", "none")
    item.setdefault("contact_requested",   False)
    item.setdefault("contact_message",     "")

    # Convert Decimal fields so Flask's jsonify doesn't choke
    item["timeSpentSeconds"] = _to_float(item.get("timeSpentSeconds", 0))
    item["alert_count"]      = _to_int(item.get("alert_count", 0))

    # Convenience alias for templates/dashboard that still use "time_spent" (minutes)
    item["time_spent"] = round(item["timeSpentSeconds"] / 60, 1)

    # Convenience alias: "module" = moduleName  (Khanh's dashboard uses "module" key)
    item["module"] = item["moduleName"]

    return item


# ── Read ──────────────────────────────────────────────────────────────────────
def get_all_employees() -> list[dict]:
    """
    Full table scan – returns every (userId, moduleId) row normalised.
    The manager dashboard uses this to build its employee table.
    """
    response = table.scan()
    rows = response.get("Items", [])

    # Handle DynamoDB pagination
    while "LastEvaluatedKey" in response:
        response = table.scan(ExclusiveStartKey=response["LastEvaluatedKey"])
        rows.extend(response.get("Items", []))

    return [_normalise_row(r) for r in rows]


def get_employee_progress(user_id: str) -> list[dict]:
    """Return all module rows for one employee (query on PK)."""
    response = table.query(
        KeyConditionExpression=Key("userId").eq(user_id)
    )
    return [_normalise_row(r) for r in response.get("Items", [])]


def get_employees_by_module(module_name: str, progress_filter: str = None) -> list[dict]:
    """
    Query via GSI moduleId-progress-index.
    module_name is the human-readable title; we translate to moduleId for the query.
    """
    module_id = MODULE_TITLE_TO_ID.get(module_name, module_name)

    if progress_filter:
        response = table.query(
            IndexName="moduleId-progress-index",
            KeyConditionExpression=(
                Key("moduleId").eq(module_id) & Key("progress").eq(progress_filter)
            ),
        )
    else:
        response = table.query(
            IndexName="moduleId-progress-index",
            KeyConditionExpression=Key("moduleId").eq(module_id),
        )

    return [_normalise_row(r) for r in response.get("Items", [])]


# ── Write helpers ─────────────────────────────────────────────────────────────
def _get_row(user_id: str, module_id: str) -> dict:
    """Fetch a row; return an empty normalised dict if not found."""
    response = table.get_item(Key={"userId": user_id, "moduleId": str(module_id)})
    item = response.get("Item")
    if item is None:
        item = {"userId": user_id, "moduleId": str(module_id)}
    return _normalise_row(item)


def update_progress(user_id: str, module_id: str, status: str) -> None:
    """
    Manager manually sets a module's progress status.
    Enforces the cheating guard: cannot set 'completed' if time < 5 min.
    module_id can be a string ID ("1") or a module title – both are handled.
    """
    # Accept title or numeric id
    if not str(module_id).isdigit():
        module_id = MODULE_TITLE_TO_ID.get(module_id, module_id)

    if status == "completed":
        row = _get_row(user_id, module_id)
        time_minutes = row["time_spent"]
        if time_minutes < FAST_THRESHOLD:
            raise ValueError(
                f"Cannot mark module {module_id} completed for user {user_id}: "
                f"only {time_minutes:.1f} min spent (minimum {FAST_THRESHOLD} min)."
            )

    table.update_item(
        Key={"userId": user_id, "moduleId": str(module_id)},
        UpdateExpression="SET progress = :s, lastActiveAt = :t",
        ExpressionAttributeValues={
            ":s": status,
            ":t": _now_iso(),
        },
    )


def update_time_spent(user_id: str, module_id: str, time_spent_minutes: float) -> dict:
    """
    Record time spent (in minutes) and run cheating detection.
    Returns { alert_status, alert_count }.
    """
    if not str(module_id).isdigit():
        module_id = MODULE_TITLE_TO_ID.get(module_id, module_id)

    row           = _get_row(user_id, module_id)
    current_count = row["alert_count"]
    is_suspicious = time_spent_minutes < FAST_THRESHOLD
    new_count     = current_count + 1 if is_suspicious else current_count

    if new_count >= MAX_WARNINGS:
        alert_status = "cheating_reported"
    elif new_count > 0:
        alert_status = "warning"
    else:
        alert_status = "normal"

    time_seconds = Decimal(str(time_spent_minutes * 60))

    table.update_item(
        Key={"userId": user_id, "moduleId": str(module_id)},
        UpdateExpression=(
            "SET timeSpentSeconds = :ts, alert_count = :ac, "
            "alert_status = :as, lastActiveAt = :u"
        ),
        ExpressionAttributeValues={
            ":ts": time_seconds,
            ":ac": new_count,
            ":as": alert_status,
            ":u":  _now_iso(),
        },
    )
    return {"alert_status": alert_status, "alert_count": new_count}


def record_login(user_id: str, name: str, email: str) -> None:
    """
    Called by the auth route when a user logs in.
    Ensures every module row exists for this user with identity fields
    populated and firstLoginAt set on the very first login.
    Uses update_item with condition so firstLoginAt is only written once.
    """
    now = _now_iso()
    for module_id, module_name in MODULE_ID_TO_TITLE.items():
        # Set identity + lastActiveAt on every login.
        # firstLoginAt only written when the attribute doesn't exist yet.
        table.update_item(
            Key={"userId": user_id, "moduleId": module_id},
            UpdateExpression=(
                "SET #n = if_not_exists(#n, :name), "
                "email = if_not_exists(email, :email), "
                "moduleName = if_not_exists(moduleName, :mn), "
                "progress = if_not_exists(progress, :ns), "
                "firstLoginAt = if_not_exists(firstLoginAt, :now), "
                "lastActiveAt = :now, "
                "alert_count = if_not_exists(alert_count, :zero), "
                "alert_status = if_not_exists(alert_status, :normal), "
                "locked = if_not_exists(locked, :false), "
                "verification_status = if_not_exists(verification_status, :none), "
                "contact_requested = if_not_exists(contact_requested, :false)"
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


def update_verification_status(user_id: str, module_id: str,
                                status: str, answer_given: str = "") -> dict:
    """
    Record the result of a challenge question.
    On 'failed': reset progress → in_progress, increment alert_count.
    On 3+ failures: lock the employee and report cheating.
    """
    if not str(module_id).isdigit():
        module_id = MODULE_TITLE_TO_ID.get(module_id, module_id)

    now = _now_iso()
    update_expr   = "SET verification_status = :vs, lastActiveAt = :u"
    expr_values   = {":vs": status, ":u": now}

    if status == "failed":
        row           = _get_row(user_id, module_id)
        new_count     = row["alert_count"] + 1
        alert_status  = "cheating_reported" if new_count >= MAX_WARNINGS else "warning"
        locked        = new_count >= MAX_WARNINGS

        update_expr += (
            ", progress = :prog, alert_count = :ac, "
            "alert_status = :as, locked = :locked"
        )
        expr_values.update({
            ":prog":   "in_progress",
            ":ac":     new_count,
            ":as":     alert_status,
            ":locked": locked,
        })

        table.update_item(
            Key={"userId": user_id, "moduleId": str(module_id)},
            UpdateExpression=update_expr,
            ExpressionAttributeValues=expr_values,
        )
        return {"locked": locked, "alert_count": new_count}

    # passed
    table.update_item(
        Key={"userId": user_id, "moduleId": str(module_id)},
        UpdateExpression=update_expr,
        ExpressionAttributeValues=expr_values,
    )
    return {"locked": False, "alert_count": 0}


def unlock_employee(user_id: str, module_id: str) -> None:
    """Manager resets a locked employee so they can redo the module."""
    if not str(module_id).isdigit():
        module_id = MODULE_TITLE_TO_ID.get(module_id, module_id)

    table.update_item(
        Key={"userId": user_id, "moduleId": str(module_id)},
        UpdateExpression=(
            "SET locked = :f, alert_status = :n, progress = :p, "
            "contact_requested = :f, alert_count = :zero, lastActiveAt = :t"
        ),
        ExpressionAttributeValues={
            ":f":    False,
            ":n":    "normal",
            ":p":    "in_progress",
            ":zero": 0,
            ":t":    _now_iso(),
        },
    )


def submit_contact_request(user_id: str, module_id: str, message: str = "") -> None:
    """Employee self-reports and asks the manager to review their case."""
    if not str(module_id).isdigit():
        module_id = MODULE_TITLE_TO_ID.get(module_id, module_id)

    table.update_item(
        Key={"userId": user_id, "moduleId": str(module_id)},
        UpdateExpression=(
            "SET contact_requested = :t, contact_message = :msg, lastActiveAt = :u"
        ),
        ExpressionAttributeValues={
            ":t":   True,
            ":msg": message or "I would like to redo this assignment.",
            ":u":   _now_iso(),
        },
    )


def delete_employee(user_id: str) -> None:
    """Remove all module rows for an employee."""
    rows = get_employee_progress(user_id)
    with table.batch_writer() as batch:
        for row in rows:
            batch.delete_item(Key={"userId": user_id, "moduleId": row["moduleId"]})


def batch_add_employees(records: list[dict]) -> int:
    """
    Bulk-insert employee records.  Each record must have at least
    'userId' and 'moduleId'. Other fields default to safe values.
    """
    now = _now_iso()
    with table.batch_writer() as batch:
        for rec in records:
            rec.setdefault("moduleName",          MODULE_ID_TO_TITLE.get(str(rec.get("moduleId", "")), ""))
            rec.setdefault("progress",            "not_started")
            rec.setdefault("timeSpentSeconds",    Decimal("0"))
            rec.setdefault("alert_count",         0)
            rec.setdefault("alert_status",        "normal")
            rec.setdefault("locked",              False)
            rec.setdefault("verification_status", "none")
            rec.setdefault("contact_requested",   False)
            rec.setdefault("lastActiveAt",        now)
            rec.setdefault("firstLoginAt",        now)
            batch.put_item(Item=rec)
    return len(records)


def batch_delete_employees(user_ids: list[str]) -> int:
    """Bulk-delete all rows for a list of userIds."""
    count = 0
    with table.batch_writer() as batch:
        for uid in user_ids:
            rows = get_employee_progress(uid)
            for row in rows:
                batch.delete_item(Key={"userId": uid, "moduleId": row["moduleId"]})
                count += 1
    return count


# ── Alert / analytics read helpers ───────────────────────────────────────────
def get_alerts() -> list[dict]:
    """Return rows that have at least one warning or a cheating report."""
    return [r for r in get_all_employees() if r["alert_count"] > 0]


def get_cheating_reports() -> list[dict]:
    """Return rows flagged as cheating_reported."""
    return [r for r in get_all_employees() if r["alert_status"] == "cheating_reported"]


def get_contact_requests() -> list[dict]:
    """Return rows where the employee has asked the manager for help."""
    return [r for r in get_all_employees() if r.get("contact_requested") is True]


def get_analytics() -> list[dict]:
    """
    Average time-per-module across all employees, plus per-employee breakdown.
    Returns one entry per module (by title).
    """
    all_rows = get_all_employees()
    buckets: dict[str, dict] = {}

    for row in all_rows:
        title = row["moduleName"]
        if title not in buckets:
            buckets[title] = {"times": [], "employees": [], "module_id": row["moduleId"]}
        buckets[title]["times"].append(row["time_spent"])
        buckets[title]["employees"].append(row.get("name", "Unknown"))

    result = []
    for title, data in buckets.items():
        times = data["times"]
        avg   = sum(times) / len(times) if times else 0
        result.append({
            "module":          title,
            "module_id":       data["module_id"],
            "avg_time":        round(avg, 1),
            "total_attempts":  len(times),
            "employees":       data["employees"],
            "times":           times,
            "expected_time":   EXPECTED_MODULE_TIME,
        })

    # Return in canonical module order
    order_map = {title: i for i, title in enumerate(MODULE_ORDER)}
    result.sort(key=lambda x: order_map.get(x["module"], 99))
    return result


def get_deadline_warnings() -> list[dict]:
    """
    Check all in-progress rows for employees approaching or past their
    MODULE_DEADLINE_DAYS deadline (measured from firstLoginAt).
    """
    all_rows = get_all_employees()
    warnings = []
    now      = datetime.utcnow()

    for row in all_rows:
        if row["progress"] == "completed":
            continue

        start_str = row.get("firstLoginAt") or row.get("lastActiveAt")
        if not start_str:
            continue

        try:
            start_date = datetime.fromisoformat(start_str.replace("Z", "+00:00"))
            # strip tz for naive arithmetic
            start_date = start_date.replace(tzinfo=None)
        except (ValueError, TypeError):
            continue

        deadline  = start_date + timedelta(days=MODULE_DEADLINE_DAYS)
        days_left = (deadline - now).days

        if days_left > 7:
            continue

        if days_left < 0:
            warning_type = "overdue"
            message      = f"OVERDUE by {abs(days_left)} day(s)!"
        elif days_left <= 1:
            warning_type = "urgent"
            message      = "Due TOMORROW!"
        elif days_left <= 3:
            warning_type = "warning"
            message      = f"{days_left} days left"
        else:
            warning_type = "reminder"
            message      = f"{days_left} days left"

        warnings.append({
            "userId":      row["userId"],
            "name":        row.get("name", "Unknown"),
            "module":      row["moduleName"],
            "module_id":   row["moduleId"],
            "deadline":    deadline.isoformat(),
            "days_left":   days_left,
            "warning_type": warning_type,
            "message":     message,
            "email_reminders": _email_schedule(days_left),
        })

    return warnings


def _email_schedule(days_left: int) -> list[str]:
    reminders = []
    if days_left <= 7:
        reminders.append("7-day reminder sent")
    if days_left <= 3:
        reminders.append("3-day reminder sent")
    if days_left <= 1:
        reminders.append("1-day URGENT reminder sent")
    return reminders


def can_access_module(user_id: str, module_name: str) -> bool:
    """
    Sequential gating: must complete the previous module before starting next.
    Accepts a module title or a numeric string ID.
    """
    if str(module_name).isdigit():
        idx = int(module_name) - 1
    else:
        if module_name not in MODULE_ORDER:
            return True   # unknown module – allow
        idx = MODULE_ORDER.index(module_name)

    if idx == 0:
        return True   # first module always open

    prev_id = str(idx)   # e.g. module index 1 → moduleId "1"
    row     = _get_row(user_id, prev_id)
    return row.get("progress") == "completed"


def get_module_order() -> list[str]:
    return MODULE_ORDER
