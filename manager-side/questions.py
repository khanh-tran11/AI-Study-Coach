"""
Question bank for cheating verification.
Uses Amazon Bedrock to generate unique real-scenario questions each time.
Falls back to hardcoded questions if Bedrock is unavailable.
"""
import json
import random
import boto3

try:
    bedrock = boto3.client("bedrock-runtime", region_name="us-west-2")
except Exception:
    bedrock = None

# Module content descriptions (used by Bedrock to generate relevant questions)
MODULE_CONTENT = {
    "Intro to AI": "Introduction to Artificial Intelligence: what AI is, types of AI (narrow vs general), real-world applications (chatbots, recommendation systems, self-driving cars), difference between AI/ML/DL, ethics in AI.",
    "Data Basics": "Data fundamentals: data types (numerical, categorical), data collection, cleaning missing values, exploratory data analysis (EDA), basic statistics (mean, median, distribution), data visualization, correlation.",
    "Machine Learning": "Machine Learning basics: supervised vs unsupervised learning, classification vs regression, overfitting/underfitting, train/test split, common algorithms (linear regression, decision trees, k-means clustering), model evaluation metrics.",
}

# Fallback hardcoded questions (used when Bedrock unavailable)
QUESTION_BANK = {
    "Intro to AI": [
        {
            "question": "Your company wants to automate customer support. Which AI approach would you recommend for handling common FAQ questions, and why?",
            "options": ["A) Build a chatbot using NLP to understand and respond to FAQs", "B) Hire more support staff", "C) Send all questions to email", "D) Ignore the customers"],
            "correct_option": "A"
        },
        {
            "question": "A hospital wants to predict which patients are at risk of readmission. What type of AI/ML task is this?",
            "options": ["A) Image generation", "B) Classification/Prediction", "C) Language translation", "D) Robot navigation"],
            "correct_option": "B"
        },
        {
            "question": "Your manager asks: 'Is AI the same as Machine Learning?' How would you explain the difference?",
            "options": ["A) They are exactly the same thing", "B) ML is a subset of AI - AI is the broad field, ML is one technique within it", "C) AI is a subset of ML", "D) They are completely unrelated"],
            "correct_option": "B"
        },
    ],
    "Data Basics": [
        {
            "question": "Your team collected survey data but 30% of responses have missing age values. What's the best first step?",
            "options": ["A) Delete all rows with missing data", "B) Analyze why data is missing, then decide to impute or remove based on pattern", "C) Replace all missing values with 0", "D) Ignore the missing data completely"],
            "correct_option": "B"
        },
        {
            "question": "A retail company has sales data from 50 stores. They want to find patterns in customer buying behavior. What technique should they start with?",
            "options": ["A) Jump straight to deep learning", "B) Exploratory Data Analysis (EDA) - visualize distributions and correlations first", "C) Delete all data and start fresh", "D) Only look at one store"],
            "correct_option": "B"
        },
        {
            "question": "You're given a dataset with customer names, emails, and purchase amounts. Which is the numerical variable you can do math on?",
            "options": ["A) Customer name", "B) Email address", "C) Purchase amount", "D) All of them are numerical"],
            "correct_option": "C"
        },
    ],
    "Machine Learning": [
        {
            "question": "A bank wants to predict if a loan applicant will default. They have 10 years of historical loan data. What type of ML model fits best?",
            "options": ["A) Unsupervised clustering", "B) Supervised classification (e.g., logistic regression or random forest)", "C) Reinforcement learning", "D) No ML needed, just guess"],
            "correct_option": "B"
        },
        {
            "question": "Your ML model gets 99% accuracy on training data but 60% on test data. What is this problem called and how do you fix it?",
            "options": ["A) Underfitting - add more features", "B) Overfitting - use regularization, more training data, or simpler model", "C) Perfect model - ship it to production", "D) Data is broken - delete everything"],
            "correct_option": "B"
        },
        {
            "question": "An e-commerce site wants to group customers into segments without predefined labels. Which ML approach?",
            "options": ["A) Supervised classification", "B) Unsupervised clustering (e.g., K-means)", "C) Reinforcement learning", "D) Manual sorting by hand"],
            "correct_option": "B"
        },
    ],
}

# Different funny gifs for each warning level
WARNING_GIFS = {
    1: {
        "gif": "https://media.giphy.com/media/3o7btPCcdNniyf0ArS/giphy.gif",
        "caption": "🤔 Oops! Better luck next time, back to the lecture!"
    },
    2: {
        "gif": "https://media.giphy.com/media/l3q2K5jinAlChoCLS/giphy.gif",
        "caption": "👀 Uh oh... one more and you're out!"
    },
    3: {
        "gif": "https://media.giphy.com/media/3oEjHAUOqG3lSS0f1C/giphy.gif",
        "caption": "🚨 Hey friend, we need to chat. Your manager has been notified. Let's sort this out together!"
    },
}


def generate_question_with_bedrock(module_name):
    """
    Use Amazon Bedrock to generate a unique real-scenario challenge question.
    Each call produces a different question so employees can't memorize answers.
    """
    content = MODULE_CONTENT.get(module_name, f"General knowledge about {module_name}")

    prompt = f"""Generate a multiple-choice verification question for an employee training module.

Module: {module_name}
Module content: {content}

Requirements:
- The question must be a REAL-WORLD SCENARIO that tests application of knowledge (not memorization)
- Make it specific to a workplace situation
- 4 options (A, B, C, D) - one clearly correct, others plausible but wrong
- The correct answer should demonstrate genuine understanding

Respond in this exact JSON format only (no extra text):
{{
    "question": "Your scenario question here...",
    "options": ["A) option text", "B) option text", "C) option text", "D) option text"],
    "correct_option": "B"
}}"""

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
        text = result["content"][0]["text"]

        # Parse JSON from response
        question_data = json.loads(text)
        return question_data
    except Exception as e:
        print(f"Bedrock question generation failed: {e}")
        return None


def get_challenge_question(module_name):
    """
    Get a challenge question for verification.
    Tries Bedrock first (unique question each time),
    falls back to hardcoded bank if unavailable.
    """
    # Try Bedrock first
    if bedrock:
        ai_question = generate_question_with_bedrock(module_name)
        if ai_question:
            return ai_question

    # Fallback to hardcoded questions
    questions = QUESTION_BANK.get(module_name, [])
    if not questions:
        return {
            "question": f"Explain one real-world application of what you learned in '{module_name}'.",
            "options": ["A) I can explain it clearly", "B) I somewhat remember", "C) I don't remember", "D) I didn't do the module"],
            "correct_option": "A"
        }
    return random.choice(questions)


def get_warning_gif(alert_count):
    """Get the appropriate funny gif based on warning level."""
    level = min(int(alert_count), 3)
    if level <= 0:
        level = 1
    return WARNING_GIFS.get(level, WARNING_GIFS[1])
