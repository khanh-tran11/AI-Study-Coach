from flask import Flask, jsonify, request, render_template, redirect, url_for, session
from functools import wraps
from db import (
    get_all_employees,
    get_all_employee_modules,
    get_employee_progress,
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
    get_all_risk_scores,
    calculate_risk_score,
    detect_anomalies,
    get_dropoff_alerts,
)
from questions import get_challenge_question, get_warning_gif
from ai_summary import generate_summary, generate_personalized_feedback, draft_manager_email
from learner_features import (
    get_scenario,
    evaluate_scenario_choice,
    generate_violation_game,
    ai_debate,
    calculate_time_gate,
    check_time_gate,
)

app = Flask(__name__)
app.secret_key = "ai-trainer-secret-key-2024"

# Manager credentials (in production, store in database)
MANAGER_USERNAME = "admin"
MANAGER_PASSWORD = "admin123"


def login_required(f):
    """Decorator to protect routes - must be logged in."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("logged_in"):
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return decorated


# Login page
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


# Logout
@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


# Manager dashboard page (protected)
@app.route("/")
@login_required
def dashboard():
    return render_template("dashboard.html")


# --- API ROUTES ---

# GET /manager/employees - List all employees and their progress (flattened)
@app.route("/manager/employees", methods=["GET"])
@login_required
def list_employees():
    data = get_all_employee_modules()
    return jsonify(data)


# GET /manager/employees/<user_id> - Get one employee's modules
@app.route("/manager/employees/<user_id>", methods=["GET"])
@login_required
def employee_detail(user_id):
    data = get_employee_progress(user_id)
    return jsonify({"name": name, "modules": data})


# PUT /manager/employees/<user_id>/modules/<module> - Update module status
@app.route("/manager/employees/<user_id>/modules/<module>", methods=["PUT"])
@login_required
def update_module(user_id, module):
    body = request.get_json()
    status = body.get("progress", "completed")
    try:
        update_progress(user_id, module, status)
        return jsonify({"message": f"Updated {name} - {module} to {status}"})
    except ValueError as e:
        return jsonify({"error": str(e)}), 403


# PUT /manager/employees/<user_id>/modules/<module>/time - Record time spent
@app.route("/manager/employees/<user_id>/modules/<module>/time", methods=["PUT"])
@login_required
def record_time(user_id, module):
    body = request.get_json()
    time_spent = float(body.get("time_spent", 0))
    result = update_time_spent(user_id, module, time_spent)
    return jsonify(result)


# GET /manager/analytics - Module analytics data
@app.route("/manager/analytics", methods=["GET"])
@login_required
def analytics():
    data = get_analytics()
    return jsonify(data)


# GET /manager/modules/<module> - Get all employees for a module
@app.route("/manager/modules/<module>", methods=["GET"])
@login_required
def module_employees(module):
    rows = get_all_employee_modules()
    progress_filter = request.args.get("progress")
    filtered = [r for r in rows if r.get("module") == module]
    if progress_filter:
        filtered = [r for r in filtered if r.get("progress") == progress_filter]
    return jsonify({"module": module, "employees": filtered})


# GET /manager/alerts - Get suspicious activity alerts
@app.route("/manager/alerts", methods=["GET"])
@login_required
def alerts():
    data = get_alerts()
    return jsonify(data)


# GET /manager/deadlines - Get deadline warnings
@app.route("/manager/deadlines", methods=["GET"])
@login_required
def deadlines():
    data = get_deadline_warnings()
    return jsonify(data)


# GET /manager/risk-scores - Risk score per professor (0-100)
@app.route("/manager/risk-scores", methods=["GET"])
@login_required
def risk_scores():
    data = get_all_risk_scores()
    return jsonify(data)


# GET /manager/risk-scores/<user_id> - Single professor risk score
@app.route("/manager/risk-scores/<user_id>", methods=["GET"])
@login_required
def single_risk_score(user_id):
    data = calculate_risk_score(user_id)
    return jsonify(data)


# GET /manager/anomalies - Behavioral anomaly detection
@app.route("/manager/anomalies", methods=["GET"])
@login_required
def anomalies():
    data = detect_anomalies()
    return jsonify(data)


# GET /manager/dropoff-alerts - Engagement drop-off alerts
@app.route("/manager/dropoff-alerts", methods=["GET"])
@login_required
def dropoff_alerts():
    data = get_dropoff_alerts()
    return jsonify(data)


# POST /manager/nudge-email/<user_id> - AI-drafted nudge email for drop-off
@app.route("/manager/nudge-email/<user_id>", methods=["POST"])
@login_required
def nudge_email(user_id):
    item = get_employee_progress(user_id)
    modules = item.get("modules", {})
    completed = sum(1 for m in modules.values() if m.get("completedAt"))
    total = len(modules)
    context = f"Professor has completed {completed}/{total} modules and has been inactive."
    email = draft_manager_email(user_id, "training modules", "encouragement", context)
    return jsonify({"email": email, "userId": user_id})


# GET /manager/ai-summary - AI-generated summary of all employee data
@app.route("/manager/ai-summary", methods=["GET"])
@login_required
def ai_summary():
    data = get_all_employees()
    summary = generate_summary(data)
    return jsonify({"summary": summary})


# POST /manager/draft-email - AI drafts an email for manager to send
@app.route("/manager/draft-email", methods=["POST"])
@login_required
def draft_email():
    body = request.get_json()
    name = body.get("name", "Employee")
    module = body.get("module", "")
    reason = body.get("reason", "cheating")  # cheating, deadline, encouragement
    context = body.get("context", "")
    email = draft_manager_email(name, module, reason, context)
    return jsonify({"email": email, "name": name, "reason": reason})


# GET /manager/module-order - Get the sequential module order
@app.route("/manager/module-order", methods=["GET"])
@login_required
def module_order():
    return jsonify({"modules": get_module_order()})


# GET /manager/can-access/<user_id>/<module> - Check if employee can access module
@app.route("/manager/can-access/<user_id>/<module>", methods=["GET"])
@login_required
def check_access(user_id, module):
    allowed = can_access_module(user_id, module)
    return jsonify({"name": name, "module": module, "can_access": allowed})


# GET /manager/reports - Get cheating reports
@app.route("/manager/reports", methods=["GET"])
@login_required
def reports():
    data = get_cheating_reports()
    return jsonify(data)


# POST /manager/contact/<user_id>/<module> - Employee contacts manager
@app.route("/manager/contact/<user_id>/<module>", methods=["POST"])
def contact_manager(user_id, module):
    body = request.get_json() or {}
    message = body.get("message", "")
    submit_contact_request(user_id, module, message)
    return jsonify({"message": "Contact request sent to manager. They will review your case shortly."})


# GET /manager/contact-requests - Manager views all contact requests
@app.route("/manager/contact-requests", methods=["GET"])
@login_required
def view_contact_requests():
    data = get_contact_requests()
    return jsonify(data)


# POST /manager/unlock/<user_id>/<module> - Manager unlocks employee
@app.route("/manager/unlock/<user_id>/<module>", methods=["POST"])
@login_required
def unlock(user_id, module):
    unlock_employee(user_id, module)
    return jsonify({"message": f"Unlocked {name} for {module}. They can redo the assignment now."})


# DELETE /manager/employees/<user_id> - Remove an employee
@app.route("/manager/employees/<user_id>", methods=["DELETE"])
@login_required
def remove_employee(user_id):
    delete_employee(user_id)
    return jsonify({"message": f"{name} removed"})


# POST /manager/employees/batch - Batch add employees
@app.route("/manager/employees/batch", methods=["POST"])
@login_required
def batch_add():
    body = request.get_json()
    records = body.get("records", [])
    if not records:
        return jsonify({"error": "No records provided"}), 400
    count = batch_add_employees(records)
    return jsonify({"message": f"Added {count} records", "count": count})


# DELETE /manager/employees/batch - Batch delete employees
@app.route("/manager/employees/batch/delete", methods=["POST"])
@login_required
def batch_delete():
    body = request.get_json()
    names = body.get("names", [])
    if not names:
        return jsonify({"error": "No names provided"}), 400
    count = batch_delete_employees(names)
    return jsonify({"message": f"Deleted {count} records", "count": count})


# GET /manager/challenge/<user_id>/<module> - Get a verification challenge question
@app.route("/manager/challenge/<user_id>/<module>", methods=["GET"])
@login_required
def get_challenge(user_id, module):
    question_data = get_challenge_question(module)
    # Get current alert count for this employee/module to determine gif
    from db import get_employee_progress
    items = get_employee_progress(user_id)
    alert_count = 0
    for item in items:
        if item.get("module") == module:
            alert_count = int(item.get("alert_count", 0))
            break
    gif_data = get_warning_gif(alert_count)
    return jsonify({
        "name": name,
        "module": module,
        "question": question_data["question"],
        "options": question_data["options"],
        "correct_option": question_data["correct_option"],
        "gif": gif_data["gif"],
        "gif_caption": gif_data["caption"],
        "alert_count": alert_count,
    })


# POST /manager/verify/<user_id>/<module> - Verify the employee's answer
@app.route("/manager/verify/<user_id>/<module>", methods=["POST"])
@login_required
def verify_answer(user_id, module):
    body = request.get_json()
    given_answer = body.get("answer", "")
    correct_answer = body.get("correct_option", "")

    is_correct = given_answer.upper() == correct_answer.upper()

    if is_correct:
        update_verification_status(user_id, module, "passed", given_answer)
        return jsonify({
            "result": "passed",
            "message": "Correct! Verification passed.",
            "is_correct": True,
        })
    else:
        result = update_verification_status(user_id, module, "failed", given_answer)
        # Get updated alert count
        alert_count = result.get("alert_count", 0)
        is_locked = result.get("locked", False)
        gif_data = get_warning_gif(alert_count)

        # Generate personalized feedback with Bedrock
        feedback = generate_personalized_feedback(
            name, module,
            body.get("question", ""),
            given_answer,
            correct_answer
        )

        if is_locked:
            message = "LOCKED: We see issues from your side. We report to the manager, please contact to redo the assignment. You are locked out of this module."
        else:
            message = f"Wrong answer! You are sent back to the lecture. Warning {alert_count}/3."

        return jsonify({
            "result": "failed",
            "message": message,
            "feedback": feedback,
            "is_correct": False,
            "alert_count": alert_count,
            "locked": is_locked,
            "sent_back_to_lecture": True,
            "gif": gif_data["gif"],
            "gif_caption": gif_data["caption"],
        })


# ============================================================
# LEARNER-SIDE ROUTES
# ============================================================

# GET /learner/scenario/<module> - Get a scenario simulation
@app.route("/learner/scenario/<module>", methods=["GET"])
def learner_scenario(module):
    scenario = get_scenario(module)
    if not scenario:
        return jsonify({"error": "No scenario available for this module"}), 404
    return jsonify(scenario)


# POST /learner/scenario/evaluate - Evaluate scenario choice
@app.route("/learner/scenario/evaluate", methods=["POST"])
def learner_scenario_evaluate():
    body = request.get_json()
    scenario_id = body.get("scenario_id")
    choice_id = body.get("choice_id")
    choices = body.get("choices", [])
    result = evaluate_scenario_choice(scenario_id, choice_id, choices)
    return jsonify(result)


# GET /learner/violation-game - Get a Spot-the-Violation game
@app.route("/learner/violation-game", methods=["GET"])
def learner_violation_game():
    game = generate_violation_game()
    return jsonify(game)


# POST /learner/debate - AI Debate Partner
@app.route("/learner/debate", methods=["POST"])
def learner_debate():
    body = request.get_json()
    module = body.get("module", "Intro to AI")
    statement = body.get("statement", "")
    history = body.get("history", [])
    if not statement:
        return jsonify({"error": "Statement is required"}), 400
    result = ai_debate(module, statement, history)
    return jsonify(result)


# GET /learner/time-gate/<module> - Get time gate info for a module
@app.route("/learner/time-gate/<module>", methods=["GET"])
def learner_time_gate(module):
    gate = calculate_time_gate(module)
    return jsonify(gate)


# POST /learner/time-gate/check - Check if time gate is unlocked
@app.route("/learner/time-gate/check", methods=["POST"])
def learner_time_gate_check():
    body = request.get_json()
    module = body.get("module", "")
    time_spent = int(body.get("time_spent_seconds", 0))
    result = check_time_gate(module, time_spent)
    return jsonify(result)


if __name__ == "__main__":
    app.run(debug=True, port=5001)
