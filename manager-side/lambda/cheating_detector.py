"""
Lambda function triggered by DynamoDB Streams.
Detects when an employee completes a module too quickly (< 5 min)
and logs an alert / could send notification to manager.

Trigger: DynamoDB Streams on AITrainerProgress table
Event: NEW_AND_OLD_IMAGES
"""
import json
import boto3
from datetime import datetime

# SNS topic for notifications (create this if you want email alerts)
# sns = boto3.client("sns", region_name="us-west-2")
# TOPIC_ARN = "arn:aws:sns:us-west-2:807462092040:ManagerAlerts"

FAST_THRESHOLD = 5  # minutes


def lambda_handler(event, context):
    """
    Process DynamoDB Stream events.
    Checks for suspicious fast completions.
    """
    alerts = []

    for record in event.get("Records", []):
        # Only check MODIFY events (status changes)
        if record["eventName"] not in ("MODIFY", "INSERT"):
            continue

        new_image = record.get("dynamodb", {}).get("NewImage", {})
        old_image = record.get("dynamodb", {}).get("OldImage", {})

        # Extract fields from DynamoDB format
        name = new_image.get("name", {}).get("S", "Unknown")
        module = new_image.get("module", {}).get("S", "Unknown")
        progress = new_image.get("progress", {}).get("S", "")
        time_spent = float(new_image.get("time_spent", {}).get("S", "0") or "0")

        # Check if module was just completed too fast
        if progress == "completed" and time_spent > 0 and time_spent < FAST_THRESHOLD:
            alert = {
                "employee": name,
                "module": module,
                "time_spent": time_spent,
                "expected_time": 30,
                "timestamp": datetime.utcnow().isoformat(),
                "message": f"ALERT: {name} completed '{module}' in {time_spent} min (expected ~30 min)",
            }
            alerts.append(alert)
            print(json.dumps(alert))  # CloudWatch logs

            # Optional: Send SNS notification to manager
            # sns.publish(
            #     TopicArn=TOPIC_ARN,
            #     Subject=f"Cheating Alert: {name}",
            #     Message=json.dumps(alert, indent=2)
            # )

    return {
        "statusCode": 200,
        "body": json.dumps({
            "processed_records": len(event.get("Records", [])),
            "alerts_generated": len(alerts),
            "alerts": alerts,
        })
    }
