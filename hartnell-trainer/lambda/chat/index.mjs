// Lambda: POST /chat
// Forwards messages + step context to OpenAI and streams the reply back
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const CORS = {
  'Access-Control-Allow-Origin':  process.env.FRONTEND_ORIGIN ?? '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
};

function ok(body)       { return { statusCode:200, headers:{...CORS,'Content-Type':'application/json'}, body:JSON.stringify(body) }; }
function err(code, msg) { return { statusCode:code, headers:CORS, body:JSON.stringify({error:msg}) }; }

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode:200, headers:CORS, body:'' };

  let body;
  try { body = JSON.parse(event.body ?? '{}'); } catch { return err(400,'Invalid JSON'); }

  const { messages = [], context = {} } = body;

  const systemPrompt = `You are Panther, the AI learning assistant for Hartnell College's Canvas faculty onboarding program.
You help distance education instructors learn how to use Canvas LMS step by step.

Current context:
- Module / Tool: ${context.moduleTitle ?? 'Canvas Training'}
- Tool ID: ${context.tool_id ?? 'canvas-lms'}
- Step ID: ${context.step_id ?? 'unknown'}
- Lesson content: "${context.s3LessonText ?? 'General Canvas guidance.'}"

Your role:
1. Guide the instructor toward the answer — do not give it away immediately.
2. Ask clarifying questions to understand where they are stuck.
3. Reference the lesson content when relevant.
4. Be encouraging — warm, supportive, solutions-focused.
5. If still stuck after 2 attempts, provide a clear step-by-step answer.
6. Keep responses to 3–5 sentences max unless a detailed walkthrough is requested.

Hartnell College motto: "Growing Leaders through Opportunity, Engagement, and Achievement."`;

  try {
    const completion = await openai.chat.completions.create({
      model:       process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
      messages:    [{ role:'system', content:systemPrompt }, ...messages],
      temperature: 0.7,
      max_tokens:  500,
    });
    return ok({ reply: completion.choices[0].message, usage: completion.usage });
  } catch (e) {
    console.error('OpenAI error:', e.message);
    return ok({
      reply: {
        role:    'assistant',
        content: "I'm having trouble connecting right now. Please verify that OPENAI_API_KEY is set in the Lambda environment variables.",
      },
    });
  }
};
