# Prompt for IBM watsonx Code Assistant (Bob) - Full Architecture Review

Copy everything below this line and paste into Bob:

---

## Project Context

**Project:** AI Study Coach - Manager Tracking System
**Goal:** Build a manager-side dashboard to track new employee training progress on an AI training platform. Managers can monitor completion, detect cheating, send verification challenges, and manage deadlines.

**My role:** Manager tracking side (backend + frontend)
**Teammate's role:** Employee side (Canvas front-end + back-end for completing modules)
**Shared resource:** DynamoDB table `AITrainerProgress` in AWS (us-west-2)

**Tech Stack:**
- Python Flask (backend API)
- HTML/CSS/JS with Chart.js (frontend dashboard)
- AWS DynamoDB (database)
- AWS Lambda + DynamoDB Streams (auto cheating detection)
- AWS Bedrock - Claude (AI summary, question generation, feedback, email drafting)
- AWS SES (deadline email reminders)
- AWS IAM (roles and permissions)

## Architecture Overview

```
[Manager Browser] → Flask API (localhost:5001)
                         ↓
                   [DynamoDB Table: AITrainerProgress]
                         ↓
              [DynamoDB Streams] → [Lambda: CheatingDetector]
                         ↓
              [Amazon Bedrock] → AI Summary / Questions / Feedback
                         ↓
              [AWS SES] → Deadline reminder emails
```

**DynamoDB Table Schema:**
- Partition Key: `name` (String) - employee name
- Sort Key: `module` (String) - module name
- GSI: `module-progress-index` (module as HASH, progress as RANGE)
- Attributes: progress, time_spent, alert_count, alert_status, locked, verification_status, contact_requested, contact_message, last_updated

**Features built:**
1. Employee tracking with real-time auto-refresh (5s)
2. Search, filter, sort, pagination (scalable to 100+ employees)
3. Module analytics with Chart.js (avg time, comparison, per-employee)
4. Cheating detection (time < 5 min = suspicious)
5. AI-generated challenge questions via Bedrock (unique each time)
6. Warning system with funny GIFs (3 levels)
7. Failed challenge → sent back to lecture → 3 fails = locked + reported
8. Employee self-contact manager feature (message box)
9. Manager unlock + reply system
10. AI Summary tab (Bedrock generates team insights)
11. Personalized AI feedback on wrong answers
12. AI email drafting (cheating/deadline/encouragement)
13. Deadline warnings with email schedule (7/3/1 day reminders)
14. Sequential module ordering (can't skip ahead)
15. Conditional writes (prevent marking complete if time < 5 min)
16. Batch operations for bulk insert/delete
17. Point-in-time recovery (35 day backup)
18. FAQ chatbox with keyword-based responses
19. Login/logout authentication for manager

## Code Files

### app.py (Flask routes)
```python
from flask import Flask, jsonify, request, render_template, redirect, url_for, session
from functools import wraps
from db import (
    get_all_employees,
    get_employee_progress,
    get_employees_by_module,
    update_progress,
    update_time_spent,
    update_verification_status,
    delete_employee,
    batch_add_employees,
    batch_delete_employees,
    get_alerts,
    get_cheating_reports,
    get_contact_requests,
    submit_contact_request,
    unlock_employee,
    get_analytics,
    get_deadline_warnings,
    can_access_module,
    get_module_order,
)
from questions import get_challenge_question, get_warning_gif
from ai_summary import generate_summary, generate_personalized_feedback, draft_manager_email

app = Flask(__name__)
app.secret_key = "ai-trainer-secret-key-2024"

MANAGER_USERNAME = "admin"
MANAGER_PASSWORD = "admin123"

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("logged_in"):
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return decorated

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username")
        password = request.form.get("password")
        if username == MANAGER_USERNAME and password == MANAGER_PASSWORD:
            session["logged_in"] = True
            session["username"] = username
            return redirect(url_for("dashboard"))
        else:
            return render_template("login.html", error="Invalid username or password")
    return render_template("login.html")

@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))

@app.route("/")
@login_required
def dashboard():
    return render_template("dashboard.html")

@app.route("/manager/employees", methods=["GET"])
@login_required
def list_employees():
    data = get_all_employees()
    return jsonify(data)

@app.route("/manager/employees/<name>", methods=["GET"])
@login_required
def employee_detail(name):
    data = get_employee_progress(name)
    return jsonify({"name": name, "modules": data})

@app.route("/manager/employees/<name>/modules/<module>", methods=["PUT"])
@login_required
def update_module(name, module):
    body = request.get_json()
    status = body.get("progress", "completed")
    try:
        update_progress(name, module, status)
        return jsonify({"message": f"Updated {name} - {module} to {status}"})
    except ValueError as e:
        return jsonify({"error": str(e)}), 403

@app.route("/manager/employees/<name>/modules/<module>/time", methods=["PUT"])
@login_required
def record_time(name, module):
    body = request.get_json()
    time_spent = float(body.get("time_spent", 0))
    result = update_time_spent(name, module, time_spent)
    return jsonify(result)

@app.route("/manager/analytics", methods=["GET"])
@login_required
def analytics():
    data = get_analytics()
    return jsonify(data)

@app.route("/manager/modules/<module>", methods=["GET"])
@login_required
def module_employees(module):
    progress_filter = request.args.get("progress")
    data = get_employees_by_module(module, progress_filter)
    return jsonify({"module": module, "employees": data})

@app.route("/manager/alerts", methods=["GET"])
@login_required
def alerts():
    data = get_alerts()
    return jsonify(data)

@app.route("/manager/deadlines", methods=["GET"])
@login_required
def deadlines():
    data = get_deadline_warnings()
    return jsonify(data)

@app.route("/manager/ai-summary", methods=["GET"])
@login_required
def ai_summary():
    data = get_all_employees()
    summary = generate_summary(data)
    return jsonify({"summary": summary})

@app.route("/manager/draft-email", methods=["POST"])
@login_required
def draft_email():
    body = request.get_json()
    name = body.get("name", "Employee")
    module = body.get("module", "")
    reason = body.get("reason", "cheating")
    context = body.get("context", "")
    email = draft_manager_email(name, module, reason, context)
    return jsonify({"email": email, "name": name, "reason": reason})

@app.route("/manager/module-order", methods=["GET"])
@login_required
def module_order():
    return jsonify({"modules": get_module_order()})

@app.route("/manager/can-access/<name>/<module>", methods=["GET"])
@login_required
def check_access(name, module):
    allowed = can_access_module(name, module)
    return jsonify({"name": name, "module": module, "can_access": allowed})

@app.route("/manager/reports", methods=["GET"])
@login_required
def reports():
    data = get_cheating_reports()
    return jsonify(data)

@app.route("/manager/contact/<name>/<module>", methods=["POST"])
def contact_manager(name, module):
    body = request.get_json() or {}
    message = body.get("message", "")
    submit_contact_request(name, module, message)
    return jsonify({"message": "Contact request sent to manager."})

@app.route("/manager/contact-requests", methods=["GET"])
@login_required
def view_contact_requests():
    data = get_contact_requests()
    return jsonify(data)

@app.route("/manager/unlock/<name>/<module>", methods=["POST"])
@login_required
def unlock(name, module):
    unlock_employee(name, module)
    return jsonify({"message": f"Unlocked {name} for {module}."})

@app.route("/manager/employees/<name>", methods=["DELETE"])
@login_required
def remove_employee(name):
    delete_employee(name)
    return jsonify({"message": f"{name} removed"})

@app.route("/manager/employees/batch", methods=["POST"])
@login_required
def batch_add():
    body = request.get_json()
    records = body.get("records", [])
    if not records:
        return jsonify({"error": "No records provided"}), 400
    count = batch_add_employees(records)
    return jsonify({"message": f"Added {count} records", "count": count})

@app.route("/manager/employees/batch/delete", methods=["POST"])
@login_required
def batch_delete():
    body = request.get_json()
    names = body.get("names", [])
    if not names:
        return jsonify({"error": "No names provided"}), 400
    count = batch_delete_employees(names)
    return jsonify({"message": f"Deleted {count} records", "count": count})

@app.route("/manager/challenge/<name>/<module>", methods=["GET"])
@login_required
def get_challenge(name, module):
    question_data = get_challenge_question(module)
    items = get_employee_progress(name)
    alert_count = 0
    for item in items:
        if item.get("module") == module:
            alert_count = int(item.get("alert_count", 0))
            break
    gif_data = get_warning_gif(alert_count)
    return jsonify({
        "name": name, "module": module,
        "question": question_data["question"],
        "options": question_data["options"],
        "correct_option": question_data["correct_option"],
        "gif": gif_data["gif"], "gif_caption": gif_data["caption"],
        "alert_count": alert_count,
    })

@app.route("/manager/verify/<name>/<module>", methods=["POST"])
@login_required
def verify_answer(name, module):
    body = request.get_json()
    given_answer = body.get("answer", "")
    correct_answer = body.get("correct_option", "")
    is_correct = given_answer.upper() == correct_answer.upper()
    if is_correct:
        update_verification_status(name, module, "passed", given_answer)
        return jsonify({"result": "passed", "message": "Correct!", "is_correct": True})
    else:
        result = update_verification_status(name, module, "failed", given_answer)
        alert_count = result.get("alert_count", 0)
        is_locked = result.get("locked", False)
        gif_data = get_warning_gif(alert_count)
        feedback = generate_personalized_feedback(name, module, body.get("question", ""), given_answer, correct_answer)
        if is_locked:
            message = "LOCKED: Contact manager to redo."
        else:
            message = f"Wrong! Sent back to lecture. Warning {alert_count}/3."
        return jsonify({
            "result": "failed", "message": message, "feedback": feedback,
            "is_correct": False, "alert_count": alert_count,
            "locked": is_locked, "sent_back_to_lecture": True,
            "gif": gif_data["gif"], "gif_caption": gif_data["caption"],
        })

if __name__ == "__main__":
    app.run(debug=True, port=5001)
```

### db.py (DynamoDB operations)
```python
import boto3
from boto3.dynamodb.conditions import Key
from datetime import datetime, timedelta

dynamodb = boto3.resource("dynamodb", region_name="us-west-2")
table = dynamodb.Table("AITrainerProgress")

EXPECTED_MODULE_TIME = 30
FAST_THRESHOLD = 5
MAX_WARNINGS = 3
MODULE_DEADLINE_DAYS = 7
MODULE_ORDER = ["Intro to AI", "Data Basics", "Machine Learning"]

# Functions: get_all_employees, get_employee_progress, get_employees_by_module (GSI),
# update_progress (conditional write), update_time_spent, get_alerts,
# update_verification_status (fail=reset+lock at 3), get_cheating_reports,
# submit_contact_request, get_contact_requests, unlock_employee,
# get_analytics, delete_employee (batch), batch_add_employees, batch_delete_employees,
# get_module_order, can_access_module, get_deadline_warnings, get_email_schedule
```

### questions.py (Bedrock challenge questions)
```python
# Uses Amazon Bedrock to generate unique real-scenario questions each time
# Falls back to hardcoded QUESTION_BANK if Bedrock unavailable
# MODULE_CONTENT dict describes each module for AI context
# WARNING_GIFS: 3 levels with different funny gifs and captions
# Functions: generate_question_with_bedrock, get_challenge_question, get_warning_gif
```

### ai_summary.py (Bedrock AI features)
```python
# Functions:
# generate_summary() - vivid team progress summary with emojis
# generate_basic_summary() - fallback without Bedrock
# generate_personalized_feedback() - specific feedback on wrong answers
# draft_manager_email() - AI drafts professional emails (cheating/deadline/encouragement)
```

### Lambda functions:
- `cheating_detector.py` - triggered by DynamoDB Streams, detects fast completions
- `deadline_reminder.py` - scheduled daily, sends SES emails at 7/3/1 days before deadline

## What I Need You To Review

Please provide:

1. **Architecture Validation** - Is this architecture sound? What would you change for production?
2. **Security Audit** - Find vulnerabilities (auth, input validation, AWS permissions, secrets)
3. **Scalability Assessment** - What breaks at 1000 employees? 10,000? Recommendations?
4. **Code Quality** - Rate each file 1-10. What's the biggest improvement I should make?
5. **DynamoDB Design** - Is my key schema optimal? Should I use a different access pattern?
6. **AWS Best Practices** - Am I using AWS services correctly? What's missing?
7. **Alternative Approaches** - What would you architect differently and why?

Give me specific, actionable feedback with code examples where relevant.
