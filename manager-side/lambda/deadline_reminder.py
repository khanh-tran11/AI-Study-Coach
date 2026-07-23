"""
Lambda function to send deadline reminder emails.
Triggered by CloudWatch Events (scheduled every day).
Sends reminders at: 7 days, 3 days, 1 day before deadline.

Uses AWS SES (Simple Email Service) to send emails.
"""
import json
import boto3
from datetime import datetime, timedelta

dynamodb = boto3.resource("dynamodb", region_name="us-west-2")
ses = boto3.client("ses", region_name="us-west-2")
table = dynamodb.Table("AITrainerProgress")

MODULE_DEADLINE_DAYS = 7
MANAGER_EMAIL = "manager@yourcompany.com"  # Change this
REMINDER_DAYS = [7, 3, 1]  # Send reminders at these days before deadline


def lambda_handler(event, context):
    """Scan all in-progress modules and send deadline reminders."""
    response = table.scan()
    items = response.get("Items", [])
    now = datetime.utcnow()
    emails_sent = []

    for item in items:
        if item.get("progress") == "completed":
            continue

        last_updated = item.get("last_updated", "")
        if not last_updated:
            continue

        try:
            start_date = datetime.fromisoformat(last_updated)
        except (ValueError, TypeError):
            continue

        deadline = start_date + timedelta(days=MODULE_DEADLINE_DAYS)
        days_left = (deadline - now).days

        # Check if we should send a reminder today
        if days_left in REMINDER_DAYS:
            name = item.get("name", "Employee")
            module = item.get("module", "Unknown")
            email = item.get("email", "")

            if not email:
                continue

            subject, body = get_reminder_content(name, module, days_left)

            try:
                ses.send_email(
                    Source=MANAGER_EMAIL,
                    Destination={"ToAddresses": [email]},
                    Message={
                        "Subject": {"Data": subject},
                        "Body": {"Html": {"Data": body}}
                    }
                )
                emails_sent.append({"name": name, "module": module, "days_left": days_left})
                print(f"Sent {days_left}-day reminder to {name} ({email})")
            except Exception as e:
                print(f"Failed to send email to {email}: {str(e)}")

    return {
        "statusCode": 200,
        "body": json.dumps({"emails_sent": len(emails_sent), "details": emails_sent})
    }


def get_reminder_content(name, module, days_left):
    """Generate email subject and body based on urgency level."""
    if days_left == 7:
        subject = f"Reminder: '{module}' due in 1 week"
        body = f"""
        <h2>Hi {name},</h2>
        <p>Just a friendly reminder that your module <strong>'{module}'</strong> is due in <strong>7 days</strong>.</p>
        <p>You have plenty of time - keep up the good work!</p>
        <p>Best,<br>AI Trainer Team</p>
        """
    elif days_left == 3:
        subject = f"⚠️ '{module}' due in 3 days"
        body = f"""
        <h2>Hi {name},</h2>
        <p>Your module <strong>'{module}'</strong> is due in <strong>3 days</strong>.</p>
        <p>Please make sure to complete it before the deadline to avoid any issues.</p>
        <p>Best,<br>AI Trainer Team</p>
        """
    else:  # 1 day
        subject = f"🚨 URGENT: '{module}' due TOMORROW"
        body = f"""
        <h2>Hi {name},</h2>
        <p><strong>URGENT:</strong> Your module <strong>'{module}'</strong> is due <strong>TOMORROW</strong>!</p>
        <p>Please complete it as soon as possible. If you're having trouble, contact your manager immediately.</p>
        <p>Best,<br>AI Trainer Team</p>
        """
    return subject, body
