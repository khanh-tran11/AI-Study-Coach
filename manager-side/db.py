import boto3
from boto3.dynamodb.conditions import Key
from datetime import datetime, timedelta

# Connect to DynamoDB - region us-west-2 (Oregon)
dynamodb = boto3.resource("dynamodb", region_name="us-west-2")
table = dynamodb.Table("AITrainerProgress")

# Average expected time per module (in minutes)
EXPECTED_MODULE_TIME = 30
# Threshold for "too fast" (in minutes)
FAST_THRESHOLD = 5
# Max warnings before reporting cheating
MAX_WARNINGS = 3
# Deadline: days allowed to complete each module
MODULE_DEADLINE_DAYS = 7

# Module order - must complete in sequence
MODULE_ORDER = [
    "Intro to AI",
    "Data Basics",
    "Machine Learning",
]


def get_all_employees():
    """Get all employee progress records."""
    response = table.scan()
    return response.get("Items", [])


def get_employee_progress(name):
    """Get all modules for a specific employee."""
    response = table.query(
        KeyConditionExpression=Key("name").eq(name)
    )
    return response.get("Items", [])


def get_employees_by_module(module_name, progress_filter=None):
    """
    Query by module using GSI.
    Finds all employees for a specific module.
    Optionally filter by progress status.
    """
    if progress_filter:
        response = table.query(
            IndexName="module-progress-index",
            KeyConditionExpression=Key("module").eq(module_name) & Key("progress").eq(progress_filter)
        )
    else:
        response = table.query(
            IndexName="module-progress-index",
            KeyConditionExpression=Key("module").eq(module_name)
        )
    return response.get("Items", [])


def update_progress(name, module, status):
    """
    Update an employee's module progress status.
    Uses Conditional Write: cannot mark 'completed' if time_spent < 5 min.
    This prevents cheating at the database level.
    """
    if status == "completed":
        try:
            # Conditional: only allow completion if time_spent >= 5 min
            table.update_item(
                Key={"name": name, "module": module},
                UpdateExpression="SET progress = :s, last_updated = :t",
                ConditionExpression="attribute_not_exists(time_spent) OR time_spent >= :min_time",
                ExpressionAttributeValues={
                    ":s": status,
                    ":t": datetime.utcnow().isoformat(),
                    ":min_time": "5",
                }
            )
        except dynamodb.meta.client.exceptions.ConditionalCheckFailedException:
            raise ValueError(
                f"Cannot mark '{module}' as completed for {name}. "
                f"Time spent is less than 5 minutes. Possible cheating detected."
            )
    else:
        # No condition for other status changes (e.g., reset to in_progress)
        table.update_item(
            Key={"name": name, "module": module},
            UpdateExpression="SET progress = :s, last_updated = :t",
            ExpressionAttributeValues={
                ":s": status,
                ":t": datetime.utcnow().isoformat(),
            }
        )


def update_time_spent(name, module, time_spent_minutes):
    """Update time spent on a module and check for alerts."""
    # Get current alert count
    response = table.get_item(Key={"name": name, "module": module})
    item = response.get("Item", {})
    current_alerts = int(item.get("alert_count", 0))

    # Check if too fast
    is_suspicious = time_spent_minutes < FAST_THRESHOLD
    new_alert_count = current_alerts + 1 if is_suspicious else current_alerts

    # Determine alert level
    if new_alert_count >= MAX_WARNINGS:
        alert_status = "cheating_reported"
    elif is_suspicious:
        alert_status = "warning"
    else:
        alert_status = "normal"

    table.update_item(
        Key={"name": name, "module": module},
        UpdateExpression=(
            "SET time_spent = :t, alert_count = :a, "
            "alert_status = :s, last_updated = :u"
        ),
        ExpressionAttributeValues={
            ":t": str(time_spent_minutes),
            ":a": str(new_alert_count),
            ":s": alert_status,
            ":u": datetime.utcnow().isoformat(),
        }
    )
    return {"alert_status": alert_status, "alert_count": new_alert_count}


def get_alerts():
    """Get all employees with warnings or cheating reports."""
    all_items = get_all_employees()
    alerts = []
    for item in all_items:
        alert_count = int(item.get("alert_count", 0))
        if alert_count > 0:
            alerts.append(item)
    return alerts


def update_verification_status(name, module, status, answer_given=""):
    """
    Update verification status after challenge question.
    status: 'passed', 'failed', 'pending'

    On fail:
      - Reset progress to 'in_progress' (send back to lecture)
      - Increment alert_count
      - If 3+ fails: lock employee (alert_status = 'locked') and report to manager
    """
    update_expr = "SET verification_status = :vs, verification_answer = :va, last_updated = :u"
    expr_values = {
        ":vs": status,
        ":va": answer_given,
        ":u": datetime.utcnow().isoformat(),
    }

    if status == "failed":
        # Reset progress back to in_progress (return to lecture)
        update_expr += ", progress = :prog, alert_count = alert_count + :one"
        expr_values[":prog"] = "in_progress"
        expr_values[":one"] = 1

        # Check if should lock and report
        response = table.get_item(Key={"name": name, "module": module})
        item = response.get("Item", {})
        current_alerts = int(item.get("alert_count", 0))

        if current_alerts + 1 >= MAX_WARNINGS:
            # Lock the employee and report to manager
            update_expr += ", alert_status = :as, locked = :locked"
            expr_values[":as"] = "cheating_reported"
            expr_values[":locked"] = "true"
        else:
            update_expr += ", alert_status = :as"
            expr_values[":as"] = "warning"

    table.update_item(
        Key={"name": name, "module": module},
        UpdateExpression=update_expr,
        ExpressionAttributeValues=expr_values,
    )

    # Return result info
    if status == "failed":
        response = table.get_item(Key={"name": name, "module": module})
        item = response.get("Item", {})
        return {
            "locked": item.get("locked") == "true",
            "alert_count": int(item.get("alert_count", 0)),
        }
    return {"locked": False, "alert_count": 0}


def get_cheating_reports():
    """Get employees flagged as cheating (3+ fast completions)."""
    all_items = get_all_employees()
    reports = []
    for item in all_items:
        if item.get("alert_status") == "cheating_reported":
            reports.append(item)
    return reports


def submit_contact_request(name, module, message=""):
    """
    Employee self-reports to manager requesting to redo assignment.
    Stores the contact request in DynamoDB.
    """
    table.update_item(
        Key={"name": name, "module": module},
        UpdateExpression=(
            "SET contact_requested = :cr, contact_message = :msg, "
            "contact_time = :ct, last_updated = :u"
        ),
        ExpressionAttributeValues={
            ":cr": "true",
            ":msg": message or "I would like to redo this assignment. Please unlock my access.",
            ":ct": datetime.utcnow().isoformat(),
            ":u": datetime.utcnow().isoformat(),
        }
    )


def get_contact_requests():
    """Get all employees who have submitted contact requests."""
    all_items = get_all_employees()
    requests = []
    for item in all_items:
        if item.get("contact_requested") == "true":
            requests.append(item)
    return requests


def unlock_employee(name, module):
    """Manager unlocks an employee after reviewing their contact request."""
    table.update_item(
        Key={"name": name, "module": module},
        UpdateExpression=(
            "SET locked = :l, alert_status = :as, progress = :p, "
            "contact_requested = :cr, alert_count = :ac, last_updated = :u"
        ),
        ExpressionAttributeValues={
            ":l": "false",
            ":as": "normal",
            ":p": "in_progress",
            ":cr": "false",
            ":ac": "0",
            ":u": datetime.utcnow().isoformat(),
        }
    )


def get_analytics():
    """Get module analytics - time spent per module per employee."""
    all_items = get_all_employees()
    analytics = {}
    for item in all_items:
        module = item.get("module", "Unknown")
        time_spent = float(item.get("time_spent", 0))
        if module not in analytics:
            analytics[module] = {"times": [], "employees": []}
        analytics[module]["times"].append(time_spent)
        analytics[module]["employees"].append(item.get("name", "Unknown"))
    # Calculate averages
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


def delete_employee(name):
    """Delete all records for an employee using batch write."""
    items = get_employee_progress(name)
    if not items:
        return
    # Use batch write for efficient bulk delete
    with table.batch_writer() as batch:
        for item in items:
            batch.delete_item(Key={"name": name, "module": item["module"]})


def batch_add_employees(records):
    """
    Batch insert multiple employee records at once.
    Much faster than individual put_item calls for 100+ records.

    Args:
        records: list of dicts, each with at least 'name' and 'module' keys.
                 e.g. [{"name": "John", "module": "Intro to AI", "progress": "in_progress"}, ...]
    Returns:
        Number of records inserted.
    """
    with table.batch_writer() as batch:
        for record in records:
            # Ensure required fields have defaults
            record.setdefault("progress", "in_progress")
            record.setdefault("time_spent", "0")
            record.setdefault("alert_count", "0")
            record.setdefault("alert_status", "normal")
            record.setdefault("last_updated", datetime.utcnow().isoformat())
            batch.put_item(Item=record)
    return len(records)


def batch_delete_employees(names):
    """
    Batch delete all records for multiple employees at once.

    Args:
        names: list of employee names to remove.
    Returns:
        Number of records deleted.
    """
    count = 0
    with table.batch_writer() as batch:
        for name in names:
            items = get_employee_progress(name)
            for item in items:
                batch.delete_item(Key={"name": name, "module": item["module"]})
                count += 1
    return count


def get_module_order():
    """Return the ordered list of modules."""
    return MODULE_ORDER


def can_access_module(name, module):
    """
    Check if employee can access a module based on sequential order.
    Must complete previous module first.
    """
    if module not in MODULE_ORDER:
        return True  # Unknown module, allow access
    idx = MODULE_ORDER.index(module)
    if idx == 0:
        return True  # First module always accessible

    # Check if previous module is completed
    prev_module = MODULE_ORDER[idx - 1]
    items = get_employee_progress(name)
    for item in items:
        if item.get("module") == prev_module and item.get("progress") == "completed":
            return True
    return False


def get_deadline_warnings():
    """
    Check all employees for deadline warnings.
    Deadline: MODULE_DEADLINE_DAYS from last_updated (when module was assigned/started).
    Returns employees approaching or past deadline.
    """
    all_items = get_all_employees()
    warnings = []
    now = datetime.utcnow()

    for item in all_items:
        if item.get("progress") == "completed":
            continue  # Already done, no deadline concern

        last_updated = item.get("last_updated", "")
        if not last_updated:
            continue

        try:
            start_date = datetime.fromisoformat(last_updated)
        except (ValueError, TypeError):
            continue

        deadline = start_date + timedelta(days=MODULE_DEADLINE_DAYS)
        days_left = (deadline - now).days

        # Determine warning level
        if days_left < 0:
            warning_type = "overdue"
            message = f"OVERDUE by {abs(days_left)} day(s)!"
        elif days_left <= 1:
            warning_type = "urgent"
            message = "Due TOMORROW!"
        elif days_left <= 3:
            warning_type = "warning"
            message = f"{days_left} days left"
        elif days_left <= 7:
            warning_type = "reminder"
            message = f"{days_left} days left"
        else:
            continue  # No warning needed

        warnings.append({
            "name": item.get("name"),
            "module": item.get("module"),
            "deadline": deadline.isoformat(),
            "days_left": days_left,
            "warning_type": warning_type,
            "message": message,
            "email_reminders": get_email_schedule(days_left),
        })

    return warnings


def get_email_schedule(days_left):
    """
    Determine which reminder emails should be sent.
    Schedule: 7 days before, 3 days before, 1 day before deadline.
    """
    reminders = []
    if days_left <= 7:
        reminders.append("7-day reminder sent")
    if days_left <= 3:
        reminders.append("3-day reminder sent")
    if days_left <= 1:
        reminders.append("1-day URGENT reminder sent")
    return reminders
