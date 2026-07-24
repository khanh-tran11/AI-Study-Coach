const express = require('express');
const axios   = require('axios');
const router  = express.Router();

// Real Bedrock-backed answers via our AWS Lambda + API Gateway, replacing
// the previous OpenAI call. /ask only accepts a single { question } string —
// no conversation history, no lesson context, no persona/system prompt.
//
// KNOWN LIMITATION (not replicated, not faked): this does NOT preserve
// conversation memory across turns, and does NOT reproduce the "Panther"
// Socratic-tutor persona the OpenAI prompt had (encouraging tone, guiding
// toward the answer instead of giving it away, referencing lesson content
// directly). Each question is answered in isolation from Canvas KB content
// only. Restoring either of those would need real feature work — a stateful
// wrapper and/or a richer prompt — not attempted here.
const CHAT_API_BASE = 'https://yhpt0ck7c7.execute-api.us-west-2.amazonaws.com';

/**
 * POST /api/chat
 * Body: { messages, context: { tool_id, step_id, s3LessonText, moduleTitle } }
 */
router.post('/', async (req, res) => {
  const { messages = [], context = {} } = req.body;

  const latestUserMessage = [...messages].reverse().find(m => m.role === 'user');
  if (!latestUserMessage) {
    return res.json({
      reply: { role: 'assistant', content: "I didn't catch a question — what would you like to ask?" },
    });
  }

  const question = `The user is working on the lesson '${context.moduleTitle || 'Canvas Training'}', ` +
    `step ${context.step_id || 'unknown'}. Their question: ${latestUserMessage.content}`;

  try {
    const { data } = await axios.post(`${CHAT_API_BASE}/ask`, { question });
    res.json({ reply: { role: 'assistant', content: data.answer } });
  } catch (err) {
    console.error('Chat error:', err.message);
    // Graceful fallback so UI never breaks
    res.json({
      reply: {
        role: 'assistant',
        content: "I'm having trouble connecting right now. Please try again in a moment.",
      },
    });
  }
});

module.exports = router;
