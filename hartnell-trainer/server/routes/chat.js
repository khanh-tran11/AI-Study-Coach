const express = require('express');
const OpenAI  = require('openai');
const router  = express.Router();

// Lazily initialize so dotenv has already loaded when this is first called
let openai;
function getOpenAI() {
  if (!openai) openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openai;
}

/**
 * POST /api/chat
 * Body: { messages, context: { tool_id, step_id, s3LessonText, moduleTitle } }
 */
router.post('/', async (req, res) => {
  const { messages = [], context = {} } = req.body;

  const systemPrompt = `You are Panther, the AI learning assistant for Hartnell College's Canvas faculty onboarding program.
You help distance education instructors learn how to use Canvas LMS step by step.

Current context:
- Module / Tool: ${context.moduleTitle || 'Canvas Training'}
- Tool ID: ${context.tool_id || 'canvas-lms'}
- Step ID: ${context.step_id || 'unknown'}
- Lesson content for this step: "${context.s3LessonText || 'General Canvas guidance.'}"

Your role:
1. Guide the instructor toward the answer — do NOT just give it away immediately.
2. Ask clarifying questions to understand where they are stuck.
3. Reference the lesson content above when relevant.
4. Be encouraging and use the Hartnell Panther spirit: warm, supportive, and solutions-focused.
5. If the user is truly stuck after 2 attempts, provide a clear step-by-step answer.
6. Keep responses concise — 3–5 sentences max unless a detailed walkthrough is explicitly requested.

Hartnell College motto: "Growing Leaders through Opportunity, Engagement, and Achievement."`;

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const reply = completion.choices[0].message;
    res.json({ reply, usage: completion.usage });
  } catch (err) {
    console.error('Chat error:', err.message);
    // Graceful fallback so UI never breaks
    res.json({
      reply: {
        role: 'assistant',
        content: "I'm having trouble connecting right now. Please check that your OpenAI API key is configured in the .env file, or try again in a moment.",
      },
    });
  }
});

module.exports = router;
