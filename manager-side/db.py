"""
Database layer - Manager Tracking System
Uses Amir's table (canvas-ai-trainer-module-progress) as single source of truth.
Manager features (alerts, challenges, locks) stored as additional attributes on each user item.
"""
import boto3
from boto3.dynamodb.conditions import Key, Attr
from datetime import datetime, timedelta

# Connect to DynamoDB - region us-west-2 (Oregon)
dynamodb = boto3.resource("dynamodb", region_name="us-west-2")

# Single shared table (Amir's table)
TABLE_NAME = "canvas-ai-trainer-module-progress"
table = dynamodb.Table(TABLE_NAME)

# Average expected time per module (in minutes)
EXPECTED_MODULE_TIME = 30
# Threshold for "too fast" (in minutes)
FAST_THRESHOLD = 5
# Max warnings before reporting cheating
MAX_WARNINGS = 3
# Deadline: days allowed to complete each module
MODULE_DEADLINE_DAYS = 7

# Module order - must complete in sequence (matches Carlos's 10 modules)
MODULE_ORDER = [
    "Intro to AI",
    "Data Basics",
    "Machine Learning",
    "Neural Networks",
    "Natural Language Processing",
    "Computer Vision",
    "Reinforcement Learning",
    "AI Ethics",
    "AI in Practice",
    "Final Assessment",
]


# ============================================================
# READ OPERATIONS
# ============================================================

def get_all_employees():
    """Get all user records from the shared table."""
    response = table.scan()
    items = response.get("Items", [])
    # Handle pagination for large tables
    while "LastEvaluatedKey" in response:
        response = table.scan(ExclusiveStartKey=response["LastEvaluatedKey"])
        items.extend(response.get("Items", []))
    return items


def get_employee_progress(user_id):
    """Get a specific employee's record."""
    response = table.get_item(Key={"userId": user_id})
    return response.get("Item", {})


def get_all_employee_modules():
    """
    Get flattened view of all employees + modules for the dashboard table.
    Converts Amir's nested format to flat rows for display.
    """
    all_items = get_all_employees()
    rows = []
    for item in all_items:
        user_id = item.get("userId", "unknown")
        modules = item.get("modules", {})
        manager_data = item.get("managerTracking", {})

        for module_id, module_info in modules.items():
            module_name = module_info.get("title", module_id)
            completed_at = module_info.get("completedAt", "")
            progress = "completed" if completed_at else "in_progress"

            # Get manager tracking data for this module
            mod_tracking = manager_data.get(module_name, {})

            rows.append({
                "userId": user_id,
                "module": module_name,
                "progress": progress,
                "time_spent": mod_tracking.get("time_spent", "0"),
                "alert_count": mod_tracking.get("alert_count", "0"),
                "alert_status": mod_tracking.get("alert_status", "normal"),
                "locked": mod_tracking.get("locked", "false"),
                "verification_status": mod_tracking.get("verification_status", ""),
                "contact_requested": mod_tracking.get("contact_requested", "false"),
                "contact_message": mod_tracking.get("contact_message", ""),
                "last_updated": mod_tracking.get("last_updated", completed_at or ""),
            })

        # If user has no modules yet, still show them
        if not modules:
            rows.append({
                "userId": user_id,
                "module": "No modules started",
                "progress": "in_progress",
                "time_spent": "0",
                "alert_count": "0",
                "alert_status": "normal",
                "locked": "false",
                "verification_status": "",
                "contact_requested": "false",
                "contact_message": "",
                "last_updated": "",
            })

    return rows


# ============================================================
# MANAGER TRACKING - WRITE OPERATIONS
# ============================================================

def update_module_tracking(user_id, module_name, updates):
    """
    Update manager tracking fields for a specific user/module.
    Stores under managerTracking.{module_name}.{field}
    """
    expr_parts = []
    expr_values = {}
    expr_names = {"#mt": "managerTracking", "#mod": module_name}

    for i, (field, value) in enumerate(updates.items()):
        expr_parts.append(f"#mt.#mod.#f{i} = :v{i}")
        expr_names[f"#f{i}"] = field
        expr_values[f":v{i}"] = value

    # Ensure managerTracking and module key exist
    table.update_item(
        Key={"userId": user_id},
        UpdateExpression="SET #mt = if_not_exists(#mt, :empty)",
        ExpressionAttributeNames={"#mt": "managerTracking"},
        ExpressionAttributeValues={":empty": {}},
    )
    table.update_item(
        Key={"userId": user_id},
        UpdateExpression="SET #mt.#mod = if_not_exists(#mt.#mod, :empty)",
        ExpressionAttributeNames={"#mt": "managerTracking", "#mod": module_name},
        ExpressionAttributeValues={":empty": {}},
    )

    # Now set the actual values
    table.update_item(
        Key={"userId": user_id},
        UpdateExpression="SET " + ", ".join(expr_parts),
        ExpressionAttributeNames=expr_names,
        ExpressionAttributeValues=expr_values,
    )


def update_progress(user_id, module_name, status):
    """
    Update module progress status.
    Conditional: cannot mark completed if time_spent < 5 min.
    """
    tracking = get_module_tracking(user_id, module_name)
    time_spent = float(tracking.get("time_spent", "0"))

    if status == "completed" and 0 < time_spent < FAST_THRESHOLD:
        raise ValueError(
            f"Cannot mark '{module_name}' as completed for {user_id}. "
            f"Time spent ({time_spent} min) is less than {FAST_THRESHOLD} minutes."
        )

    update_module_tracking(user_id, module_name, {
        "progress": status,
        "last_updated": datetime.utcnow().isoformat(),
    })


def update_time_spent(user_id, module_name, time_spent_minutes):
    """Update time spent on a module and check for alerts."""
    tracking = get_module_tracking(user_id, module_name)
    current_alerts = int(tracking.get("alert_count", "0"))

    is_suspicious = time_spent_minutes < FAST_THRESHOLD
    new_alert_count = current_alerts + 1 if is_suspicious else current_alerts

    if new_alert_count >= MAX_WARNINGS:
        alert_status = "cheating_reported"
    elif is_suspicious:
        alert_status = "warning"
    else:
        alert_status = "normal"

    update_module_tracking(user_id, module_name, {
        "time_spent": str(time_spent_minutes),
        "alert_count": str(new_alert_count),
        "alert_status": alert_status,
        "last_updated": datetime.utcnow().isoformat(),
    })
    return {"alert_status": alert_status, "alert_count": new_alert_count}


def update_verification_status(user_id, module_name, status, answer_given=""):
    """
    Update verification status after challenge question.
    On fail: reset progress, increment alerts, lock at 3.
    """
    tracking = get_module_tracking(user_id, module_name)
    current_alerts = int(tracking.get("alert_count", "0"))

    updates = {
        "verification_status": status,
        "verification_answer": answer_given,
        "last_updated": datetime.utcnow().isoformat(),
    }

    if status == "failed":
        new_alerts = current_alerts + 1
        updates["progress"] = "in_progress"
        updates["alert_count"] = str(new_alerts)

        if new_alerts >= MAX_WARNINGS:
            updates["alert_status"] = "cheating_reported"
            updates["locked"] = "true"
        else:
            updates["alert_status"] = "warning"

        update_module_tracking(user_id, module_name, updates)
        return {
            "locked": new_alerts >= MAX_WARNINGS,
            "alert_count": new_alerts,
        }

    update_module_tracking(user_id, module_name, updates)
    return {"locked": False, "alert_count": current_alerts}


# ============================================================
# HELPER: READ MODULE TRACKING
# ============================================================

def get_module_tracking(user_id, module_name):
    """Get manager tracking data for a specific user/module."""
    item = get_employee_progress(user_id)
    manager_data = item.get("managerTracking", {})
    return manager_data.get(module_name, {})


# ============================================================
# ALERTS & REPORTS
# ============================================================

def get_alerts():
    """Get all modules with warnings or cheating reports."""
    rows = get_all_employee_modules()
    return [r for r in rows if int(r.get("alert_count", "0")) > 0]


def get_cheating_reports():
    """Get modules flagged as cheating."""
    rows = get_all_employee_modules()
    return [r for r in rows if r.get("alert_status") == "cheating_reported"]


def get_contact_requests():
    """Get all employees who submitted contact requests."""
    rows = get_all_employee_modules()
    return [r for r in rows if r.get("contact_requested") == "true"]


# ============================================================
# CONTACT & UNLOCK
# ============================================================

def submit_contact_request(user_id, module_name, message=""):
    """Employee contacts manager to request redo."""
    update_module_tracking(user_id, module_name, {
        "contact_requested": "true",
        "contact_message": message or "I would like to redo this assignment.",
        "contact_time": datetime.utcnow().isoformat(),
        "last_updated": datetime.utcnow().isoformat(),
    })


def unlock_employee(user_id, module_name):
    """Manager unlocks an employee."""
    update_module_tracking(user_id, module_name, {
        "locked": "false",
        "alert_status": "normal",
        "progress": "in_progress",
        "contact_requested": "false",
        "alert_count": "0",
        "last_updated": datetime.utcnow().isoformat(),
    })


# ============================================================
# ANALYTICS
# ============================================================

def get_analytics():
    """Get module analytics - time spent per module."""
    rows = get_all_employee_modules()
    analytics = {}
    for row in rows:
        module = row.get("module", "Unknown")
        time_spent = float(row.get("time_spent", 0))
        if module not in analytics:
            analytics[module] = {"times": [], "employees": []}
        analytics[module]["times"].append(time_spent)
        analytics[module]["employees"].append(row.get("userId", "Unknown"))

    result = []
    for module, data in analytics.items():
        times = data["times"]
        avg = sum(times) / len(times) if times else 0
        result.append({
            "module": module,
            "avg_time": round(avg, 1),
            "total_attempts": len(times),
            "employees": data["employees"],
            "times": data["times"],
            "expected_time": EXPECTED_MODULE_TIME,
        })
    return result


# ============================================================
# MODULE ORDER & ACCESS CONTROL
# ============================================================

def get_module_order():
    """Return the ordered list of modules."""
    return MODULE_ORDER


def can_access_module(user_id, module_name):
    """Check if employee can access a module (must complete previous one)."""
    if module_name not in MODULE_ORDER:
        return True
    idx = MODULE_ORDER.index(module_name)
    if idx == 0:
        return True

    prev_module = MODULE_ORDER[idx - 1]
    tracking = get_module_tracking(user_id, prev_module)
    return tracking.get("progress") == "completed"


# ============================================================
# DEADLINES
# ============================================================

def get_deadline_warnings():
    """Check all employees for deadline warnings."""
    rows = get_all_employee_modules()
    warnings = []
    now = datetime.utcnow()

    for row in rows:
        if row.get("progress") == "completed":
            continue

        last_updated = row.get("last_updated", "")
        if not last_updated:
            continue

        try:
            start_date = datetime.fromisoformat(last_updated)
        except (ValueError, TypeError):
            continue

        deadline = start_date + timedelta(days=MODULE_DEADLINE_DAYS)
        days_left = (deadline - now).days

        if days_left < 0:
            warning_type, message = "overdue", f"OVERDUE by {abs(days_left)} day(s)!"
        elif days_left <= 1:
            warning_type, message = "urgent", "Due TOMORROW!"
        elif days_left <= 3:
            warning_type, message = "warning", f"{days_left} days left"
        elif days_left <= 7:
            warning_type, message = "reminder", f"{days_left} days left"
        else:
            continue

        warnings.append({
            "userId": row.get("userId"),
            "module": row.get("module"),
            "deadline": deadline.isoformat(),
            "days_left": days_left,
            "warning_type": warning_type,
            "message": message,
            "email_reminders": get_email_schedule(days_left),
        })
    return warnings


def get_email_schedule(days_left):
    """Email reminder schedule: 7, 3, 1 days before deadline."""
    reminders = []
    if days_left <= 7:
        reminders.append("7-day reminder sent")
    if days_left <= 3:
        reminders.append("3-day reminder sent")
    if days_left <= 1:
        reminders.append("1-day URGENT reminder sent")
    return reminders


# ============================================================
# BATCH & DELETE
# ============================================================

def delete_employee(user_id):
    """Delete an employee record."""
    table.delete_item(Key={"userId": user_id})


def batch_add_employees(records):
    """Batch insert multiple records."""
    with table.batch_writer() as batch:
        for record in records:
            record.setdefault("userId", "unknown@hartnell.edu")
            record.setdefault("modules", {})
            record.setdefault("managerTracking", {})
            batch.put_item(Item=record)
    return len(records)


def batch_delete_employees(user_ids):
    """Batch delete multiple employees."""
    count = 0
    with table.batch_writer() as batch:
        for user_id in user_ids:
            batch.delete_item(Key={"userId": user_id})
            count += 1
    return count
