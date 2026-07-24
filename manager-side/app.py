"""
manager-side/app.py

Flask web app — manager dashboard backend.
Runs on :5001 (separate from the Node/Express server on :4000).

Start:
    cd manager-side
    pip install -r requirements.txt
    python app.py

Environment variables (create manager-side/.env or set in shell):
    MANAGER_USERNAME   – dashboard login username  (default: admin)
    MANAGER_PASSWORD   – dashboard login password  (default: change_me)
    FLASK_SECRET_KEY   – session signing key        (default: dev-only-change-in-prod)
    PROGRESS_TABLE_NAME – DynamoDB table            (default: canvas-ai-trainer-module-progress)
    AWS_REGION          – AWS region                (default: us-west-2)
"""
import os
from functools import wraps

from flask import (
    Flask, jsonify, redirect, render_template,
    request, session, url_for,
)

from db import (
    batch_add_employees,
    batch_delete_employees,
    can_access_module,
    delete_employee,
    get_alerts,
    get_all_employees,
    get_analytics,
    get_cheating_reports,
    get_contact_requests,
    get_deadline_warnings,
    get_employee_progress,
    get_employees_by_module,
    get_module_order,
    record_login,
    submit_contact_request,
    unlock_employee,
    update_progress,
    update_time_spent,
    update_verification_status,
)
from questions import get_challenge_question, get_warning_gif
from ai_summary import draft_manager_email, generate_personalized_feedback, generate_summary

# ── App setup ─────────────────────────────────────────────────────────────────
app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "dev-only-change-in-prod")

MANAGER_USERNAME = os.environ.get("MANAGER_USERNAME", "admin")
MANAGER_PASSWORD = os.environ.get("MANAGER_PASSWORD", "change_me")


# ── Auth decorator ────────────────────────────────────────────────────────────
def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("logged_in"):
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return decorated


# ── Pages ─────────────────────────────────────────────────────────────────────
@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username", "")
        password = request.form.get("password", "")
        if username == MANAGER_USERNAME and password == MANAGER_PASSWORD:
            session["logged_in"] = True
            session["username"]  = username
            return redirect(url_for("dashboard"))
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


# ── Employee endpoints ────────────────────────────────────────────────────────
@app.route("/manager/employees", methods=["GET"])
@login_required
def list_employees():
    return jsonify(get_all_employees())


@app.route("/manager/employees/<user_id>", methods=["GET"])
@login_required
def employee_detail(user_id):
    return jsonify({"userId": user_id, "modules": get_employee_progress(user_id)})


@app.route("/manager/employees/<user_id>/modules/<module_id>", methods=["PUT"])
@login_required
def update_module(user_id, module_id):
    body   = request.get_json() or {}
    status = body.get("progress", "completed")
    try:
        update_progress(user_id, module_id, status)
        return jsonify({"message": f"Updated user {user_id} module {module_id} → {status}"})
    except ValueError as e:
        return jsonify({"error": str(e)}), 403


@app.route("/manager/employees/<user_id>/modules/<module_id>/time", methods=["PUT"])
@login_required
def record_time(user_id, module_id):
    body       = request.get_json() or {}
    time_spent = float(body.get("time_spent", 0))
    result     = update_time_spent(user_id, module_id, time_spent)
    return jsonify(result)


@app.route("/manager/employees/<user_id>", methods=["DELETE"])
@login_required
def remove_employee(user_id):
    delete_employee(user_id)
    return jsonify({"message": f"User {user_id} removed"})


@app.route("/manager/employees/batch", methods=["POST"])
@login_required
def batch_add():
    body    = request.get_json() or {}
    records = body.get("records", [])
    if not records:
        return jsonify({"error": "No records provided"}), 400
    count = batch_add_employees(records)
    return jsonify({"message": f"Added {count} records", "count": count})


@app.route("/manager/employees/batch/delete", methods=["POST"])
@login_required
def batch_delete():
    body  = request.get_json() or {}
    ids   = body.get("userIds", [])
    if not ids:
        return jsonify({"error": "No userIds provided"}), 400
    count = batch_delete_employees(ids)
    return jsonify({"message": f"Deleted {count} records", "count": count})


# ── Analytics / reporting endpoints ──────────────────────────────────────────
@app.route("/manager/analytics", methods=["GET"])
@login_required
def analytics():
    return jsonify(get_analytics())


@app.route("/manager/modules/<module_name>", methods=["GET"])
@login_required
def module_employees(module_name):
    progress_filter = request.args.get("progress")
    return jsonify({
        "module":    module_name,
        "employees": get_employees_by_module(module_name, progress_filter),
    })


@app.route("/manager/alerts", methods=["GET"])
@login_required
def alerts():
    return jsonify(get_alerts())


@app.route("/manager/deadlines", methods=["GET"])
@login_required
def deadlines():
    return jsonify(get_deadline_warnings())


@app.route("/manager/reports", methods=["GET"])
@login_required
def reports():
    return jsonify(get_cheating_reports())


# ── AI endpoints ──────────────────────────────────────────────────────────────
@app.route("/manager/ai-summary", methods=["GET"])
@login_required
def ai_summary():
    data    = get_all_employees()
    summary = generate_summary(data)
    return jsonify({"summary": summary})


@app.route("/manager/draft-email", methods=["POST"])
@login_required
def draft_email():
    body    = request.get_json() or {}
    user_id = body.get("userId", "")
    name    = body.get("name", "Employee")
    module  = body.get("module", "")
    reason  = body.get("reason", "cheating")
    context = body.get("context", "")
    email   = draft_manager_email(name, module, reason, context)
    return jsonify({"email": email, "userId": user_id, "name": name, "reason": reason})


# ── Module gating endpoints ───────────────────────────────────────────────────
@app.route("/manager/module-order", methods=["GET"])
@login_required
def module_order():
    return jsonify({"modules": get_module_order()})


@app.route("/manager/can-access/<user_id>/<module>", methods=["GET"])
@login_required
def check_access(user_id, module):
    allowed = can_access_module(user_id, module)
    return jsonify({"userId": user_id, "module": module, "can_access": allowed})


# ── Contact / unlock endpoints ────────────────────────────────────────────────
@app.route("/manager/contact/<user_id>/<module_id>", methods=["POST"])
def contact_manager(user_id, module_id):
    body    = request.get_json() or {}
    message = body.get("message", "")
    submit_contact_request(user_id, module_id, message)
    return jsonify({"message": "Contact request submitted. The manager will review your case."})


@app.route("/manager/contact-requests", methods=["GET"])
@login_required
def view_contact_requests():
    return jsonify(get_contact_requests())


@app.route("/manager/unlock/<user_id>/<module_id>", methods=["POST"])
@login_required
def unlock(user_id, module_id):
    unlock_employee(user_id, module_id)
    return jsonify({"message": f"User {user_id} unlocked for module {module_id}."})


# ── Verification / challenge endpoints ───────────────────────────────────────
@app.route("/manager/challenge/<user_id>/<module_id>", methods=["GET"])
@login_required
def get_challenge(user_id, module_id):
    from db import get_module_order, MODULE_ID_TO_TITLE
    module_name   = MODULE_ID_TO_TITLE.get(str(module_id), module_id)
    question_data = get_challenge_question(module_name)

    rows        = get_employee_progress(user_id)
    alert_count = 0
    for row in rows:
        if str(row.get("moduleId")) == str(module_id):
            alert_count = int(row.get("alert_count", 0))
            break

    gif_data = get_warning_gif(alert_count)
    return jsonify({
        "userId":        user_id,
        "moduleId":      module_id,
        "question":      question_data["question"],
        "options":       question_data["options"],
        "correct_option": question_data["correct_option"],
        "gif":           gif_data["gif"],
        "gif_caption":   gif_data["caption"],
        "alert_count":   alert_count,
    })


@app.route("/manager/verify/<user_id>/<module_id>", methods=["POST"])
@login_required
def verify_answer(user_id, module_id):
    from db import MODULE_ID_TO_TITLE
    body          = request.get_json() or {}
    given_answer  = body.get("answer", "")
    correct       = body.get("correct_option", "")
    is_correct    = given_answer.upper() == correct.upper()

    if is_correct:
        update_verification_status(user_id, module_id, "passed", given_answer)
        return jsonify({"result": "passed", "message": "Correct! Verification passed.", "is_correct": True})

    result      = update_verification_status(user_id, module_id, "failed", given_answer)
    alert_count = result.get("alert_count", 0)
    is_locked   = result.get("locked", False)
    gif_data    = get_warning_gif(alert_count)
    module_name = MODULE_ID_TO_TITLE.get(str(module_id), module_id)

    feedback = generate_personalized_feedback(
        user_id, module_name,
        body.get("question", ""),
        given_answer, correct,
    )

    message = (
        "LOCKED: Too many failed attempts. Contact the manager to regain access."
        if is_locked
        else f"Wrong answer. Returned to lecture. Warning {alert_count}/{3}."
    )

    return jsonify({
        "result":               "failed",
        "message":              message,
        "feedback":             feedback,
        "is_correct":           False,
        "alert_count":          alert_count,
        "locked":               is_locked,
        "sent_back_to_lecture": True,
        "gif":                  gif_data["gif"],
        "gif_caption":          gif_data["caption"],
    })


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    port  = int(os.environ.get("FLASK_PORT", 5001))
    debug = os.environ.get("FLASK_DEBUG", "true").lower() == "true"
    app.run(debug=debug, port=port)
