"""
Seed test data into DynamoDB for demo purposes.
Run: python seed_data.py
"""
import boto3

dynamodb = boto3.resource("dynamodb", region_name="us-west-2")
table = dynamodb.Table("AITrainerProgress")

# Clear existing data first
print("Clearing old data...")
response = table.scan()
for item in response.get("Items", []):
    table.delete_item(Key={"name": item["name"], "module": item["module"]})

# Test data with various scenarios
test_data = [
    # John - normal employee, good times
    {"name": "John", "module": "Intro to AI", "progress": "completed", "time_spent": "28", "alert_count": "0", "alert_status": "normal", "last_updated": "2026-07-20T10:30:00"},
    {"name": "John", "module": "Data Basics", "progress": "completed", "time_spent": "35", "alert_count": "0", "alert_status": "normal", "last_updated": "2026-07-20T11:05:00"},
    {"name": "John", "module": "Machine Learning", "progress": "in_progress", "time_spent": "0", "alert_count": "0", "alert_status": "normal", "last_updated": "2026-07-21T12:00:00"},

    # Sarah - suspicious, done too fast once
    {"name": "Sarah", "module": "Intro to AI", "progress": "completed", "time_spent": "3", "alert_count": "1", "alert_status": "warning", "last_updated": "2026-07-21T09:03:00"},
    {"name": "Sarah", "module": "Data Basics", "progress": "completed", "time_spent": "25", "alert_count": "0", "alert_status": "normal", "last_updated": "2026-07-21T09:30:00"},
    {"name": "Sarah", "module": "Machine Learning", "progress": "in_progress", "time_spent": "0", "alert_count": "0", "alert_status": "normal", "last_updated": "2026-07-22T10:00:00"},

    # Mike - cheater, 3+ fast completions
    {"name": "Mike", "module": "Intro to AI", "progress": "completed", "time_spent": "2", "alert_count": "3", "alert_status": "cheating_reported", "last_updated": "2026-07-19T08:02:00"},
    {"name": "Mike", "module": "Data Basics", "progress": "completed", "time_spent": "4", "alert_count": "3", "alert_status": "cheating_reported", "last_updated": "2026-07-19T08:06:00"},
    {"name": "Mike", "module": "Machine Learning", "progress": "completed", "time_spent": "3", "alert_count": "3", "alert_status": "cheating_reported", "last_updated": "2026-07-19T08:09:00"},

    # Lisa - good employee, slightly fast but acceptable
    {"name": "Lisa", "module": "Intro to AI", "progress": "completed", "time_spent": "22", "alert_count": "0", "alert_status": "normal", "last_updated": "2026-07-18T10:22:00"},
    {"name": "Lisa", "module": "Data Basics", "progress": "completed", "time_spent": "30", "alert_count": "0", "alert_status": "normal", "last_updated": "2026-07-18T10:52:00"},
    {"name": "Lisa", "module": "Machine Learning", "progress": "completed", "time_spent": "45", "alert_count": "0", "alert_status": "normal", "last_updated": "2026-07-19T11:37:00"},

    # Kevin - 2 warnings, close to being reported
    {"name": "Kevin", "module": "Intro to AI", "progress": "completed", "time_spent": "4", "alert_count": "2", "alert_status": "warning", "last_updated": "2026-07-22T09:04:00"},
    {"name": "Kevin", "module": "Data Basics", "progress": "completed", "time_spent": "3", "alert_count": "2", "alert_status": "warning", "last_updated": "2026-07-22T09:07:00"},
    {"name": "Kevin", "module": "Machine Learning", "progress": "in_progress", "time_spent": "0", "alert_count": "0", "alert_status": "normal", "last_updated": "2026-07-22T09:30:00"},
]

print("Adding test data...")
for item in test_data:
    table.put_item(Item=item)
    print(f"  Added: {item['name']} - {item['module']} ({item['progress']}, {item['time_spent']} min)")

print(f"\nDone! Added {len(test_data)} records.")
print("\nScenarios:")
print("  John - Normal employee, good times")
print("  Sarah - 1 warning (completed Intro to AI in 3 min)")
print("  Mike  - CHEATING REPORTED (3+ fast completions)")
print("  Lisa  - Good employee, all normal")
print("  Kevin - 2 warnings, close to being reported")
