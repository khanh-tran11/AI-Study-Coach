"""
Shared DynamoDB access + stats computation for the progress endpoints.
Mirrors the exact logic of the original in-memory reference implementation
in hartnell-trainer/server/routes/progress.js (getUserStats/getEmptyStats),
so response shapes match what ProgressDashboard.jsx and TrainingPage.jsx
already expect field-for-field.
"""

import os

import boto3

TABLE_NAME = os.environ.get("PROGRESS_TABLE_NAME", "canvas-ai-trainer-module-progress")

# Matches the hardcoded totalModules = 10 in the original progress.js —
# the frontend's module list (server/routes/training.js) is a fixed
# 10-module curriculum, not something derived per-user.
TOTAL_MODULES = 10

dynamodb = boto3.resource("dynamodb", region_name="us-west-2")
table = dynamodb.Table(TABLE_NAME)


def get_empty_stats(user_id: str) -> dict:
    return {
        "userId": user_id,
        "completedModules": 0,
        "totalModules": TOTAL_MODULES,
        "completionPct": 0,
        "totalHours": 0,
        "modules": {},
    }


def compute_stats(item: dict) -> dict:
    user_id = item["userId"]
    modules = item.get("modules", {})
    completed_modules = sum(1 for m in modules.values() if m.get("completedAt"))
    completion_pct = round((completed_modules / TOTAL_MODULES) * 100)
    total_seconds = item.get("totalSeconds", 0)
    total_hours = round(float(total_seconds) / 3600, 1)
    return {
        "userId": user_id,
        "completedModules": completed_modules,
        "totalModules": TOTAL_MODULES,
        "completionPct": completion_pct,
        "totalHours": total_hours,
        "modules": modules,
    }


def get_user_stats(user_id: str) -> dict:
    response = table.get_item(Key={"userId": user_id})
    item = response.get("Item")
    if not item:
        return get_empty_stats(user_id)
    return compute_stats(item)
