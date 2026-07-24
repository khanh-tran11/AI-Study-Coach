"""
AI Summary using Amazon Bedrock (Claude model).
Generates insights and summaries from employee progress data.
"""
import json
import boto3

bedrock = boto3.client("bedrock-runtime", region_name="us-west-2")


def generate_summary(employee_data):
    """
    Use Amazon Bedrock to generate a vivid, engaging AI summary of employee progress.
    Analyzes patterns, flags concerns, and provides recommendations.
    """
    # Build context from data
    data_text = format_data_for_ai(employee_data)

    prompt = f"""You are a friendly, engaging AI training coach assistant. Analyze the following employee training progress data and write a vivid, easy-to-read summary for the manager.

Use emojis, be conversational, and make it feel like a quick team standup briefing. Include:

1. 🎯 **Team Pulse** - Quick vibe check on overall progress (use percentages, be encouraging)
2. 🌟 **Stars of the Week** - Highlight top performers with specific praise
3. 🚨 **Heads Up** - Who needs attention (be specific about why)
4. 📊 **Module Breakdown** - Which modules are easy vs. hard for the team (mention first-attempt fail rates)
5. 💡 **Your Move** - 3 specific, actionable things the manager should do TODAY (e.g., "Send check-in to Prof X who failed Grade Policy 3 times", "Review Module 4 — 60% first-attempt fail rate suggests content issue")
6. 📈 **Risk Summary** - How many are low/medium/high risk. Flag anyone above 70.

Format as a Monday morning briefing email. Keep it under 300 words. Be direct, friendly, and slightly humorous where appropriate. No corporate jargon.

Data:
{data_text}"""

    try:
        response = bedrock.invoke_model(
            modelId="anthropic.claude-3-haiku-20240307-v1:0",
            contentType="application/json",
            accept="application/json",
            body=json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 1024,
                "messages": [
                    {"role": "user", "content": prompt}
                ]
            })
        )
        result = json.loads(response["body"].read())
        summary = result["content"][0]["text"]
        return summary
    except Exception as e:
        # Fallback to basic summary if Bedrock unavailable
        return generate_basic_summary(employee_data)


def generate_basic_summary(employee_data):
    """Fallback summary without AI - vivid data analysis."""
    if not employee_data:
        return "No data available for analysis."

    total = len(employee_data)
    names = list(set(item.get("name", "") for item in employee_data))
    completed = [i for i in employee_data if i.get("progress") == "completed"]
    in_progress = [i for i in employee_data if i.get("progress") == "in_progress"]
    warnings = [i for i in employee_data if int(i.get("alert_count", 0)) > 0]
    cheating = [i for i in employee_data if i.get("alert_status") == "cheating_reported"]
    fast = [i for i in employee_data if float(i.get("time_spent", 0)) > 0 and float(i.get("time_spent", 0)) < 5]

    completion_rate = round(len(completed)/total*100) if total > 0 else 0

    # Find top performers
    completion_count = {}
    for item in completed:
        name = item.get("name", "")
        completion_count[name] = completion_count.get(name, 0) + 1
    top_performers = sorted(completion_count.items(), key=lambda x: -x[1])[:3]

    # Build vivid summary
    summary = f"""🎯 **Team Pulse**
Your team of {len(names)} is at **{completion_rate}% completion** — """

    if completion_rate >= 70:
        summary += "crushing it! 🔥\n"
    elif completion_rate >= 40:
        summary += "making solid progress! 💪\n"
    else:
        summary += "still warming up. Let's pick up the pace! ⚡\n"

    summary += f"- {len(completed)} modules done ✅ | {len(in_progress)} in progress 🔄\n\n"

    summary += "🌟 **Stars of the Week**\n"
    if top_performers:
        for name, count in top_performers:
            summary += f"- {name} — {count} module(s) completed 👏\n"
    else:
        summary += "- No completions yet — let's get those first wins!\n"

    summary += "\n🚨 **Heads Up**\n"
    if cheating:
        summary += f"- 🔴 {len(cheating)} cheating report(s) — needs immediate attention!\n"
    if warnings:
        summary += f"- ⚠️ {len(warnings)} employee(s) with warnings\n"
    if fast:
        summary += f"- 👀 {len(fast)} suspiciously fast completion(s)\n"
    if not cheating and not warnings and not fast:
        summary += "- All clear! No red flags today 🎉\n"

    summary += "\n💡 **Your Move**\n"
    if cheating:
        for item in cheating[:2]:
            summary += f"- Review {item.get('name')}'s case on {item.get('module')} — send challenge or unlock\n"
    if warnings:
        summary += "- Check the Alerts tab and send verification challenges\n"
    if in_progress:
        summary += "- Encourage employees still in progress — a quick message goes a long way!\n"

    return summary


def format_data_for_ai(data):
    """Format employee data into readable text for AI."""
    lines = []
    for item in data:
        line = (
            f"Employee: {item.get('name', '?')} | "
            f"Module: {item.get('module', '?')} | "
            f"Status: {item.get('progress', '?')} | "
            f"Time: {item.get('time_spent', '0')} min | "
            f"Warnings: {item.get('alert_count', '0')} | "
            f"Alert: {item.get('alert_status', 'normal')} | "
            f"Last active: {item.get('last_updated', 'N/A')}"
        )
        lines.append(line)
    return "\n".join(lines)


def generate_personalized_feedback(name, module, question, given_answer, correct_option):
    """
    Use Bedrock to generate personalized feedback when employee fails a challenge.
    Tells them exactly what they got wrong and where to review.
    """
    prompt = f"""An employee named {name} just failed a verification challenge for the module '{module}'.

Question asked: {question}
Their answer: {given_answer}
Correct answer: {correct_option}

Write a SHORT, friendly, personalized feedback (3-4 sentences max) that:
1. Acknowledges their attempt without being harsh
2. Explains specifically what concept they got wrong
3. Points them to what section of the lecture to review (be specific, e.g., "review the section about X")
4. Encourages them to try again

Keep it warm and supportive, like a helpful tutor. Use 1-2 emojis."""

    try:
        response = bedrock.invoke_model(
            modelId="anthropic.claude-3-haiku-20240307-v1:0",
            contentType="application/json",
            accept="application/json",
            body=json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 256,
                "messages": [
                    {"role": "user", "content": prompt}
                ]
            })
        )
        result = json.loads(response["body"].read())
        return result["content"][0]["text"]
    except Exception as e:
        # Fallback
        return f"Hey {name}, that wasn't quite right. Please review the '{module}' lecture again, focusing on the core concepts. You've got this — try again after reviewing! 📚"


def draft_manager_email(employee_name, module, reason="cheating", context=""):
    """
    Use Bedrock to draft a professional email from manager to employee.
    Reasons: 'cheating', 'deadline', 'encouragement'
    """
    prompts = {
        "cheating": f"""Draft a professional but empathetic email from a training manager to an employee named {employee_name}.

Situation: {employee_name} has been flagged for potential academic integrity issues on the module '{module}'. {context}

The email should:
- Be professional but not threatening
- Express concern, not accusation
- Invite them to discuss the situation
- Offer the chance to redo the assignment
- Keep it under 150 words

Sign it as "Training Manager".""",

        "deadline": f"""Draft a friendly reminder email from a training manager to an employee named {employee_name}.

Situation: {employee_name} is approaching or past the deadline for module '{module}'. {context}

The email should:
- Be warm and encouraging, not punitive
- Acknowledge they might be busy
- Offer help if they're stuck
- Clearly state the deadline and consequences
- Keep it under 120 words

Sign it as "Training Manager".""",

        "encouragement": f"""Draft a short motivational email from a training manager to an employee named {employee_name}.

Situation: {employee_name} is making progress on '{module}'. {context}

The email should:
- Celebrate their progress
- Be genuine and specific
- Encourage them to keep going
- Keep it under 80 words

Sign it as "Training Manager".""",
    }

    prompt = prompts.get(reason, prompts["cheating"])

    try:
        response = bedrock.invoke_model(
            modelId="anthropic.claude-3-haiku-20240307-v1:0",
            contentType="application/json",
            accept="application/json",
            body=json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 512,
                "messages": [
                    {"role": "user", "content": prompt}
                ]
            })
        )
        result = json.loads(response["body"].read())
        return result["content"][0]["text"]
    except Exception as e:
        # Fallback templates
        fallbacks = {
            "cheating": f"Hi {employee_name},\n\nWe noticed some concerns with your progress on '{module}'. We'd like to discuss this with you. Please reach out at your earliest convenience so we can help you get back on track.\n\nBest,\nTraining Manager",
            "deadline": f"Hi {employee_name},\n\nFriendly reminder that '{module}' is due soon. If you need help or more time, please don't hesitate to reach out.\n\nBest,\nTraining Manager",
            "encouragement": f"Hi {employee_name},\n\nGreat progress on '{module}'! Keep up the good work.\n\nBest,\nTraining Manager",
        }
        return fallbacks.get(reason, fallbacks["cheating"])
