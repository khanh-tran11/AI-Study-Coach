"""
Shared DynamoDB access and stats helpers for the progress Lambda endpoints.

Unified schema
──────────────
Table : canvas-ai-trainer-module-progress   (Amir's table, us-west-2)
PK    : userId   (string)  – matches auth.js user IDs "1"…"5"
SK    : moduleId (string)  – "1"…"10", matches Carlos TrainingPage MODULE_TITLES

One row per (user, module). Each row carries Khanh's rich admin fields
alongside Amir's step-level tracking so both the learner frontend and the
manager dashboard read from the same table.

Row fields
──────────
userId            PK  – user's id from auth system
moduleId          SK  – "1"…"10"
moduleName            – human-readable title (e.g. "Canvas Orientation")
name                  – user's display name (for manager dashboard)
email                 – user's email (for manager dashboard)
progress              – "not_started" | "in_progress" | "completed"
steps                 – map  stepId → { status, updatedAt }
timeSpentSeconds      – cumulative seconds on this module
completedAt           – ISO timestamp when module was completed, or null
lastActiveAt          – ISO timestamp of most recent step update
firstLoginAt          – ISO timestamp of first time user touched this module
alert_count           – number of fast-completion warnings
alert_status          – "normal" | "warning" | "cheating_reported"
locked                – bool – manager can lock a user out of a module
verification_status   – "none" | "pending" | "passed" | "failed"
contact_requested     – bool – employee asked manager to review their case
contact_message       – free text from the employee's contact request
"""
import os
from decimal import Decimal
from datetime import datetime, timezone

import boto3

# ── Config ────────────────────────────────────────────────────────────────────
TABLE_NAME   = os.environ.get("PROGRESS_TABLE_NAME", "canvas-ai-trainer-module-progress")
AWS_REGION   = os.environ.get("AWS_REGION", "us-west-2")
TOTAL_MODULES = 10

# Fast-completion threshold used by cheating detection (minutes)
FAST_THRESHOLD_MINUTES = 5
MAX_WARNINGS            = 3

# Canonical module titles – must stay in sync with Carlos's TrainingPage.jsx
MODULE_TITLES = {
    "1":  "Canvas Orientation",
    "2":  "Setting Up Your Shell",
    "3":  "Course Content Upload",
    "4":  "Assignments & Quizzes",
    "5":  "Gradebook & Exports",
    "6":  "Communication Tools",
    "7":  "Accessibility Standards",
    "8":  "Student View & Testing",
    "9":  "LMS Admin Intro",
    "10": "Capstone & Certification",
}

# ── DynamoDB client ───────────────────────────────────────────────────────────
dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
table    = dynamodb.Table(TABLE_NAME)


# ── Helpers ───────────────────────────────────────────────────────────────────
def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _decimal(value) -> Decimal:
    return Decimal(str(value))


def _to_float(value) -> float:
    """Safely convert Decimal / string / int to float."""
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


# ── Empty-state helpers ───────────────────────────────────────────────────────
def get_empty_module_row(user_id: str, module_id: str,
                         name: str = "", email: str = "") -> dict:
    """
    Return a fresh row for a (user, module) pair that has never been touched.
    All admin-visible fields are present with safe defaults so the manager
    dashboard never needs to guard against missing keys.
    """
    return {
        "userId":             user_id,
        "moduleId":           module_id,
        "moduleName":         MODULE_TITLES.get(module_id, f"Module {module_id}"),
        "name":               name,
        "email":              email,
        "progress":           "not_started",
        "steps":              {},
        "timeSpentSeconds":   _decimal(0),
        "completedAt":        None,
        "lastActiveAt":       None,
        "firstLoginAt":       None,
        "alert_count":        0,
        "alert_status":       "normal",
        "locked":             False,
        "verification_status": "none",
        "contact_requested":  False,
        "contact_message":    "",
    }


def get_empty_user_stats(user_id: str) -> dict:
    """
    Learner-facing summary returned by GET /api/progress/{userId}
    when the user has no rows yet.
    """
    return {
        "userId":           user_id,
        "completedModules": 0,
        "totalModules":     TOTAL_MODULES,
        "completionPct":    0,
        "totalHours":       0.0,
        "modules":          {},
    }


# ── Read helpers ──────────────────────────────────────────────────────────────
def get_all_module_rows(user_id: str) -> list[dict]:
    """
    Return every (userId, moduleId) row for a user.
    Uses a Query on the PK so we only read that user's data.
    """
    from boto3.dynamodb.conditions import Key
    response = table.query(
        KeyConditionExpression=Key("userId").eq(user_id)
    )
    return response.get("Items", [])


def get_module_row(user_id: str, module_id: str) -> dict | None:
    """Return a single row, or None if it doesn't exist yet."""
    response = table.get_item(Key={"userId": user_id, "moduleId": module_id})
    return response.get("Item")


# ── Stats computation ─────────────────────────────────────────────────────────
def compute_user_stats(rows: list[dict]) -> dict:
    """
    Aggregate all module rows for one user into the summary shape
    that ProgressDashboard.jsx and TrainingPage.jsx expect.
    """
    if not rows:
        user_id = rows[0]["userId"] if rows else "unknown"
        return get_empty_user_stats(user_id)

    user_id = rows[0]["userId"]
    total_seconds = sum(_to_float(r.get("timeSpentSeconds", 0)) for r in rows)

    modules_map = {}
    completed_count = 0
    for r in rows:
        mid = r["moduleId"]
        completed_at = r.get("completedAt")
        if completed_at:
            completed_count += 1
        modules_map[mid] = {
            "progress":         r.get("progress", "not_started"),
            "completedAt":      completed_at,
            "lastActiveAt":     r.get("lastActiveAt"),
            "timeSpentSeconds": _to_float(r.get("timeSpentSeconds", 0)),
            "steps":            r.get("steps", {}),
        }

    return {
        "userId":           user_id,
        "completedModules": completed_count,
        "totalModules":     TOTAL_MODULES,
        "completionPct":    round((completed_count / TOTAL_MODULES) * 100),
        "totalHours":       round(total_seconds / 3600, 1),
        "modules":          modules_map,
    }


def get_user_stats(user_id: str) -> dict:
    """Full read-path entry point for the GET Lambda handler."""
    rows = get_all_module_rows(user_id)
    if not rows:
        return get_empty_user_stats(user_id)
    return compute_user_stats(rows)


# ── Cheating-detection helper ─────────────────────────────────────────────────
def evaluate_alert(row: dict, time_spent_seconds: float) -> tuple[int, str]:
    """
    Given the current row and the new time-spent value, return
    (new_alert_count, new_alert_status).
    Only called when a module is being marked 'completed'.
    """
    time_spent_minutes  = time_spent_seconds / 60
    is_suspicious       = time_spent_minutes < FAST_THRESHOLD_MINUTES
    current_count       = int(row.get("alert_count", 0))
    new_count           = current_count + 1 if is_suspicious else current_count

    if new_count >= MAX_WARNINGS:
        status = "cheating_reported"
    elif new_count > 0:
        status = "warning"
    else:
        status = "normal"

    return new_count, status
