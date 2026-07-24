"""
Learner-side anti-cheating features:
- Scenario Simulations (branching choices)
- Spot-the-Violation Game (procedurally generated)
- AI Debate Partner (argumentative student, scores reasoning)
- Contextual Time Gates (word count + complexity based)

Uses Amazon Bedrock for AI interactions.
"""
import json
import random
import boto3
from datetime import datetime

try:
    bedrock = boto3.client("bedrock-runtime", region_name="us-west-2")
except Exception:
    bedrock = None


# ============================================================
# SCENARIO SIMULATIONS
# ============================================================

SCENARIOS = {
    "Intro to AI": [
        {
            "id": "ai_ethics_1",
            "situation": "It's 11pm. A faculty member messages you: 'My student used ChatGPT to write their entire essay. The AI detection tool says 95% AI-generated, but the student claims they only used it for grammar checking. What do you do?'",
            "choices": [
                {"id": "A", "text": "Immediately give the student a zero — the AI detector is clear.", "next": "escalation_wrong", "reasoning_quality": 2},
                {"id": "B", "text": "Schedule a meeting with the student to discuss, review the AI policy, and ask them to demonstrate their knowledge of the topic.", "next": "best_practice", "reasoning_quality": 10},
                {"id": "C", "text": "Ignore it until tomorrow — it's too late to deal with this.", "next": "delay_wrong", "reasoning_quality": 1},
                {"id": "D", "text": "Forward it to the department chair without investigating further.", "next": "delegation_poor", "reasoning_quality": 4},
            ],
        },
    ],
    "Data Basics": [
        {
            "id": "data_privacy_1",
            "situation": "You're setting up a Canvas assignment that collects student survey responses about their mental health for a psychology class. A colleague asks: 'Should we make the responses visible to all students so they can discuss in groups?'",
            "choices": [
                {"id": "A", "text": "Sure, peer learning is important. Make all responses visible.", "next": "privacy_violation", "reasoning_quality": 1},
                {"id": "B", "text": "No — anonymize the data first, then share aggregated results only. Individual responses stay private per FERPA.", "next": "best_practice", "reasoning_quality": 10},
                {"id": "C", "text": "Let students opt-in to sharing their own responses.", "next": "partial_good", "reasoning_quality": 7},
                {"id": "D", "text": "Just don't collect the data — it's too risky.", "next": "avoidance", "reasoning_quality": 3},
            ],
        },
    ],
    "Machine Learning": [
        {
            "id": "ml_bias_1",
            "situation": "Your department purchased an AI grading tool. After one semester, you notice it consistently gives lower scores to essays written by ESL students, even when human graders rate them equally. The vendor says the model is 'calibrated on native English corpora.' What's your recommendation?",
            "choices": [
                {"id": "A", "text": "Continue using it — the vendor knows best.", "next": "bias_ignored", "reasoning_quality": 1},
                {"id": "B", "text": "Immediately stop using the tool, document the bias, report to administration, and require human review for all affected students.", "next": "best_practice", "reasoning_quality": 10},
                {"id": "C", "text": "Add a disclaimer that AI grading may have limitations.", "next": "insufficient", "reasoning_quality": 3},
                {"id": "D", "text": "Only use the tool for native English speakers.", "next": "discrimination", "reasoning_quality": 2},
            ],
        },
    ],
}


def get_scenario(module_name):
    """Get a scenario simulation for a module."""
    scenarios = SCENARIOS.get(module_name, [])
    if not scenarios:
        return generate_scenario_with_bedrock(module_name)
    return random.choice(scenarios)


def generate_scenario_with_bedrock(module_name):
    """Use Bedrock to generate a unique scenario if none hardcoded."""
    if not bedrock:
        return None

    prompt = f"""Generate a workplace scenario simulation for a faculty training module on '{module_name}'.

The scenario should:
- Drop the professor into a realistic, time-pressured situation
- Have 4 choices (A-D) with varying quality of reasoning
- One clearly best answer, one clearly worst, two in between
- Include a "reasoning_quality" score (1-10) for each choice
- Be specific to higher education / Canvas LMS context

Return JSON only:
{{
    "id": "generated_{module_name.lower().replace(' ','_')}",
    "situation": "The scenario description...",
    "choices": [
        {{"id": "A", "text": "Choice text", "next": "outcome_label", "reasoning_quality": 5}},
        ...
    ]
}}"""

    try:
        response = bedrock.invoke_model(
            modelId="anthropic.claude-3-haiku-20240307-v1:0",
            contentType="application/json",
            accept="application/json",
            body=json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 700,
                "messages": [{"role": "user", "content": prompt}]
            })
        )
        result = json.loads(response["body"].read())
        return json.loads(result["content"][0]["text"])
    except Exception:
        return None


def evaluate_scenario_choice(scenario_id, choice_id, choices):
    """Evaluate a learner's scenario choice. Returns score and feedback."""
    for choice in choices:
        if choice["id"] == choice_id:
            score = choice["reasoning_quality"]
            if score >= 8:
                feedback = "Excellent reasoning! You demonstrated strong understanding of policy and empathy."
            elif score >= 5:
                feedback = "Decent approach, but there's a better option. Consider the student's perspective and institutional policy together."
            else:
                feedback = "This could lead to serious issues. Review the module content on proper procedures and student rights."
            return {"score": score, "max_score": 10, "feedback": feedback, "choice": choice}
    return {"score": 0, "max_score": 10, "feedback": "Invalid choice.", "choice": None}


# ============================================================
# SPOT-THE-VIOLATION GAME
# ============================================================

VIOLATION_TEMPLATES = [
    {"violation": "Assignment due date is set to 11:59 PM on a holiday", "category": "scheduling", "hint": "Check the calendar"},
    {"violation": "Student grades are visible to other students in the gradebook", "category": "FERPA", "hint": "Privacy settings"},
    {"violation": "Course materials contain copyrighted images without attribution", "category": "copyright", "hint": "Check image sources"},
    {"violation": "Discussion forum requires students to post before seeing others' posts, but the setting is disabled", "category": "academic_integrity", "hint": "Discussion settings"},
    {"violation": "Quiz has no time limit and allows unlimited attempts with answers shown after each attempt", "category": "assessment_integrity", "hint": "Quiz settings"},
    {"violation": "Syllabus doesn't mention the AI usage policy", "category": "policy", "hint": "Required disclosures"},
    {"violation": "Late submission penalty is set to -200% (students lose more points than the assignment is worth)", "category": "grading", "hint": "Penalty calculations"},
    {"violation": "Group project has peer evaluation but weights are 0% of final grade", "category": "assessment_design", "hint": "Grade weights"},
    {"violation": "Exam is proctored but accommodation students aren't given extended time", "category": "ADA_compliance", "hint": "Accommodations"},
    {"violation": "Course announcement contains a student's full name and grade", "category": "FERPA", "hint": "Public communications"},
]


def generate_violation_game(num_violations=4):
    """
    Generate a Spot-the-Violation game.
    Procedurally selects violations so answer-sharing doesn't work.
    """
    selected = random.sample(VIOLATION_TEMPLATES, min(num_violations, len(VIOLATION_TEMPLATES)))
    # Add 2-3 "clean" items that are NOT violations
    clean_items = [
        {"item": "Assignment rubric is clearly defined with point values", "is_violation": False},
        {"item": "Discussion posts are set to 'must post before seeing replies'", "is_violation": False},
        {"item": "Quiz has a 60-minute time limit with one attempt", "is_violation": False},
    ]

    game_items = []
    for v in selected:
        game_items.append({"item": v["violation"], "is_violation": True, "category": v["category"], "hint": v["hint"]})
    for c in random.sample(clean_items, min(2, len(clean_items))):
        game_items.append(c)

    random.shuffle(game_items)
    return {
        "total_violations": len(selected),
        "items": game_items,
        "time_limit_seconds": 120,
    }


# ============================================================
# AI DEBATE PARTNER
# ============================================================

def ai_debate(module_name, professor_statement, debate_history=None):
    """
    AI plays an argumentative student challenging the professor's decisions.
    Scores reasoning quality of the professor's response.
    """
    if not bedrock:
        return {
            "ai_response": "I disagree! Can you explain your reasoning further?",
            "reasoning_score": 5,
            "feedback": "Bedrock unavailable — using fallback.",
        }

    history_text = ""
    if debate_history:
        for entry in debate_history[-3:]:  # Last 3 exchanges
            history_text += f"Student: {entry.get('student', '')}\nProfessor: {entry.get('professor', '')}\n"

    prompt = f"""You are playing a stubborn, argumentative college student challenging a professor during faculty training on '{module_name}'.

Previous exchanges:
{history_text}

The professor just said: "{professor_statement}"

Do two things:
1. Respond as the argumentative student (push back, ask "but why?", raise edge cases). Be annoying but realistic — not rude, just persistent. 2-3 sentences max.
2. Score the professor's reasoning quality (1-10):
   - 9-10: Clear, policy-backed, empathetic, addresses the concern directly
   - 6-8: Reasonable but could be more specific or empathetic
   - 3-5: Vague, defensive, or doesn't address the real concern
   - 1-2: Wrong, dismissive, or would harm the student

Return JSON only:
{{"ai_response": "Student's pushback...", "reasoning_score": 7, "feedback": "Brief note on what was good/bad about their answer"}}"""

    try:
        response = bedrock.invoke_model(
            modelId="anthropic.claude-3-haiku-20240307-v1:0",
            contentType="application/json",
            accept="application/json",
            body=json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 300,
                "messages": [{"role": "user", "content": prompt}]
            })
        )
        result = json.loads(response["body"].read())
        return json.loads(result["content"][0]["text"])
    except Exception as e:
        return {
            "ai_response": "Okay, but what if a student has a legitimate excuse? How do you handle that?",
            "reasoning_score": 5,
            "feedback": "Fallback response — Bedrock unavailable.",
        }


# ============================================================
# CONTEXTUAL TIME GATES
# ============================================================

# Word counts and complexity per module (used for time estimation)
MODULE_CONTENT_METRICS = {
    "Intro to AI": {"word_count": 3500, "complexity": 0.6, "media_minutes": 5},
    "Data Basics": {"word_count": 4200, "complexity": 0.7, "media_minutes": 8},
    "Machine Learning": {"word_count": 5000, "complexity": 0.85, "media_minutes": 10},
    "Neural Networks": {"word_count": 5500, "complexity": 0.9, "media_minutes": 12},
    "Natural Language Processing": {"word_count": 4800, "complexity": 0.8, "media_minutes": 7},
    "Computer Vision": {"word_count": 4500, "complexity": 0.75, "media_minutes": 10},
    "Reinforcement Learning": {"word_count": 5200, "complexity": 0.9, "media_minutes": 8},
    "AI Ethics": {"word_count": 3800, "complexity": 0.65, "media_minutes": 5},
    "AI in Practice": {"word_count": 4000, "complexity": 0.7, "media_minutes": 15},
    "Final Assessment": {"word_count": 2000, "complexity": 0.5, "media_minutes": 0},
}

# Average reading speed (words per minute) for academic content
AVG_READING_SPEED = 200  # wpm for complex academic content


def calculate_time_gate(module_name):
    """
    Calculate when the Continue button should unlock based on:
    - Word count of the module
    - Complexity factor (0-1)
    - Media duration (videos, interactives)

    Returns minimum seconds before unlocking.
    Not punitive — just honest about how long it takes to actually read.
    """
    metrics = MODULE_CONTENT_METRICS.get(module_name, {
        "word_count": 3000, "complexity": 0.7, "media_minutes": 5
    })

    # Reading time: words / reading speed, adjusted for complexity
    reading_minutes = (metrics["word_count"] / AVG_READING_SPEED) * (1 + metrics["complexity"] * 0.5)

    # Add media time
    total_minutes = reading_minutes + metrics["media_minutes"]

    # Apply 70% factor — we're generous, not punitive
    minimum_minutes = total_minutes * 0.7

    return {
        "module": module_name,
        "minimum_seconds": round(minimum_minutes * 60),
        "minimum_minutes": round(minimum_minutes, 1),
        "estimated_full_minutes": round(total_minutes, 1),
        "word_count": metrics["word_count"],
        "complexity": metrics["complexity"],
        "message": f"This module takes approximately {round(total_minutes)} minutes to complete thoughtfully. The Continue button unlocks after {round(minimum_minutes)} minutes."
    }


def check_time_gate(module_name, time_spent_seconds):
    """Check if a learner has spent enough time to proceed."""
    gate = calculate_time_gate(module_name)
    minimum = gate["minimum_seconds"]
    if time_spent_seconds >= minimum:
        return {"unlocked": True, "message": "You're ready to continue!"}
    else:
        remaining = minimum - time_spent_seconds
        return {
            "unlocked": False,
            "remaining_seconds": remaining,
            "message": f"Take your time — {round(remaining/60)} more minutes of engagement needed. This isn't a timer, it's about giving the content the attention it deserves."
        }
