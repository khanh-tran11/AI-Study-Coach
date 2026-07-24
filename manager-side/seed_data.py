"""
Seed test data into Amir's DynamoDB table for demo.
Format: userId (email), modules (nested map), totalSeconds, managerTracking (nested map)
Run: python seed_data.py
"""
import boto3

dynamodb = boto3.resource("dynamodb", region_name="us-west-2")
table = dynamodb.Table("canvas-ai-trainer-module-progress")

# Clear existing test data
print("Clearing old test data...")
test_emails = [
    "john.doe@hartnell.edu",
    "sarah.kim@hartnell.edu",
    "mike.chen@hartnell.edu",
    "lisa.nguyen@hartnell.edu",
    "kevin.patel@hartnell.edu",
]
for email in test_emails:
    try:
        table.delete_item(Key={"userId": email})
    except Exception:
        pass

# Test data in Amir's format
test_data = [
    # John - normal employee, good times
    {
        "userId": "john.doe@hartnell.edu",
        "totalSeconds": 3780,
        "modules": {
            "1": {"title": "Intro to AI", "completedAt": "2026-07-20T10:30:00"},
            "2": {"title": "Data Basics", "completedAt": "2026-07-20T11:05:00"},
            "3": {"title": "Machine Learning", "completedAt": ""},
        },
        "managerTracking": {
            "Intro to AI": {"time_spent": "28", "alert_count": "0", "alert_status": "normal", "locked": "false", "progress": "completed", "last_updated": "2026-07-20T10:30:00"},
            "Data Basics": {"time_spent": "35", "alert_count": "0", "alert_status": "normal", "locked": "false", "progress": "completed", "last_updated": "2026-07-20T11:05:00"},
            "Machine Learning": {"time_spent": "0", "alert_count": "0", "alert_status": "normal", "locked": "false", "progress": "in_progress", "last_updated": "2026-07-21T12:00:00"},
        },
    },
    # Sarah - suspicious, done too fast once
    {
        "userId": "sarah.kim@hartnell.edu",
        "totalSeconds": 1680,
        "modules": {
            "1": {"title": "Intro to AI", "completedAt": "2026-07-21T09:03:00"},
            "2": {"title": "Data Basics", "completedAt": "2026-07-21T09:30:00"},
            "3": {"title": "Machine Learning", "completedAt": ""},
        },
        "managerTracking": {
            "Intro to AI": {"time_spent": "3", "alert_count": "1", "alert_status": "warning", "locked": "false", "progress": "completed", "last_updated": "2026-07-21T09:03:00"},
            "Data Basics": {"time_spent": "25", "alert_count": "0", "alert_status": "normal", "locked": "false", "progress": "completed", "last_updated": "2026-07-21T09:30:00"},
            "Machine Learning": {"time_spent": "0", "alert_count": "0", "alert_status": "normal", "locked": "false", "progress": "in_progress", "last_updated": "2026-07-22T10:00:00"},
        },
    },
    # Mike - cheater, 3+ fast completions
    {
        "userId": "mike.chen@hartnell.edu",
        "totalSeconds": 540,
        "modules": {
            "1": {"title": "Intro to AI", "completedAt": "2026-07-19T08:02:00"},
            "2": {"title": "Data Basics", "completedAt": "2026-07-19T08:06:00"},
            "3": {"title": "Machine Learning", "completedAt": "2026-07-19T08:09:00"},
        },
        "managerTracking": {
            "Intro to AI": {"time_spent": "2", "alert_count": "3", "alert_status": "cheating_reported", "locked": "true", "progress": "completed", "last_updated": "2026-07-19T08:02:00"},
            "Data Basics": {"time_spent": "4", "alert_count": "3", "alert_status": "cheating_reported", "locked": "true", "progress": "completed", "last_updated": "2026-07-19T08:06:00"},
            "Machine Learning": {"time_spent": "3", "alert_count": "3", "alert_status": "cheating_reported", "locked": "true", "progress": "completed", "last_updated": "2026-07-19T08:09:00"},
        },
    },
    # Lisa - good employee, all normal
    {
        "userId": "lisa.nguyen@hartnell.edu",
        "totalSeconds": 5820,
        "modules": {
            "1": {"title": "Intro to AI", "completedAt": "2026-07-18T10:22:00"},
            "2": {"title": "Data Basics", "completedAt": "2026-07-18T10:52:00"},
            "3": {"title": "Machine Learning", "completedAt": "2026-07-19T11:37:00"},
        },
        "managerTracking": {
            "Intro to AI": {"time_spent": "22", "alert_count": "0", "alert_status": "normal", "locked": "false", "progress": "completed", "last_updated": "2026-07-18T10:22:00"},
            "Data Basics": {"time_spent": "30", "alert_count": "0", "alert_status": "normal", "locked": "false", "progress": "completed", "last_updated": "2026-07-18T10:52:00"},
            "Machine Learning": {"time_spent": "45", "alert_count": "0", "alert_status": "normal", "locked": "false", "progress": "completed", "last_updated": "2026-07-19T11:37:00"},
        },
    },
    # Kevin - 2 warnings, close to being reported
    {
        "userId": "kevin.patel@hartnell.edu",
        "totalSeconds": 420,
        "modules": {
            "1": {"title": "Intro to AI", "completedAt": "2026-07-22T09:04:00"},
            "2": {"title": "Data Basics", "completedAt": "2026-07-22T09:07:00"},
            "3": {"title": "Machine Learning", "completedAt": ""},
        },
        "managerTracking": {
            "Intro to AI": {"time_spent": "4", "alert_count": "2", "alert_status": "warning", "locked": "false", "progress": "completed", "last_updated": "2026-07-22T09:04:00"},
            "Data Basics": {"time_spent": "3", "alert_count": "2", "alert_status": "warning", "locked": "false", "progress": "completed", "last_updated": "2026-07-22T09:07:00"},
            "Machine Learning": {"time_spent": "0", "alert_count": "0", "alert_status": "normal", "locked": "false", "progress": "in_progress", "last_updated": "2026-07-22T09:30:00"},
        },
    },
]

print("Adding test data...")
for item in test_data:
    table.put_item(Item=item)
    user = item["userId"]
    modules_done = sum(1 for m in item["modules"].values() if m.get("completedAt"))
    print(f"  Added: {user} ({modules_done}/3 modules completed)")

print(f"\nDone! Added {len(test_data)} employee records.")
print("\nScenarios:")
print("  john.doe@hartnell.edu   - Normal, good times")
print("  sarah.kim@hartnell.edu  - 1 warning (Intro to AI in 3 min)")
print("  mike.chen@hartnell.edu  - CHEATING REPORTED + LOCKED (3x fast)")
print("  lisa.nguyen@hartnell.edu- Good employee, all normal")
print("  kevin.patel@hartnell.edu- 2 warnings, close to report")
