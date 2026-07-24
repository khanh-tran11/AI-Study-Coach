/**
 * server/routes/upload.js
 *
 * Admin content upload + AI module generation pipeline.
 *
 * Flow
 * ────
 * 1. POST /api/upload/presign
 *    Admin picks a file in the UI.
 *    We ask the preprod Lambda (or generate locally) for a presigned S3 PUT URL.
 *    The browser uploads the file directly to S3 — never routes bytes through Express.
 *
 * 2. POST /api/upload/generate
 *    Admin clicks "Generate Modules".
 *    We tell the module-generator Lambda the S3 keys that were uploaded.
 *    Lambda reads each file from S3, calls Bedrock Claude, writes
 *    processed/<name>.json back to S3, and returns the generated lesson JSON.
 *    We cache the result in server/generated-modules.json so training.js
 *    can serve it to learners immediately without hitting S3 again.
 *
 * 3. GET /api/upload/modules
 *    Returns all generated modules (from cache file, or live from S3).
 *
 * AWS mode  (PREPROD_API_BASE set in .env)
 *   Uses Amir's deployed Lambdas via API Gateway.
 *
 * Local-dev fallback  (PREPROD_API_BASE not set, OPENAI_API_KEY set)
 *   Saves the file to disk, extracts text locally, calls OpenAI to
 *   generate the same lesson JSON schema.  Lets the team develop the
 *   UI without needing AWS credentials.
 */

const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const axios   = require('axios');
const router  = express.Router();

// ── Config ────────────────────────────────────────────────────────────────────
const PREPROD_API_BASE = process.env.PREPROD_API_BASE;   // e.g. https://abc123.execute-api.us-west-2.amazonaws.com
const OPENAI_API_KEY   = process.env.OPENAI_API_KEY;
const OPENAI_MODEL     = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const AWS_REGION       = process.env.AWS_REGION   || 'us-west-2';
const S3_BUCKET        = process.env.PREPROD_BUCKET || process.env.S3_BUCKET_NAME;

// Persisted module cache — training.js reads this to serve lessons to learners
const MODULES_FILE = path.join(__dirname, '..', 'generated-modules.json');

function loadModules() {
  try {
    if (fs.existsSync(MODULES_FILE)) return JSON.parse(fs.readFileSync(MODULES_FILE, 'utf-8'));
  } catch { /* ignore */ }
  return [];
}

function saveModules(modules) {
  fs.writeFileSync(MODULES_FILE, JSON.stringify(modules, null, 2), 'utf-8');
}

// ── Multer (local fallback only — files never hit disk in AWS mode) ───────────
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename:    (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.docx', '.doc', '.txt', '.pptx', '.ppt', '.md'];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  },
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function extractLocalText(filePath, originalName) {
  const ext = path.extname(originalName).toLowerCase();
  if (ext === '.txt' || ext === '.md') {
    return fs.readFileSync(filePath, 'utf-8').slice(0, 12000);
  }
  // Best-effort UTF-8 decode for binary formats — good enough for local dev
  const buf = fs.readFileSync(filePath);
  return buf.toString('utf-8')
    .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
    .replace(/\s{3,}/g, '\n')
    .trim()
    .slice(0, 8000) || `Content from: ${originalName}`;
}

// Prompt that works for both OpenAI (local) and Bedrock (AWS).
// Returns a lesson JSON matching the schema TrainingPage.jsx expects.
function buildGenerationPrompt(combinedText, moduleTitle) {
  return `You are an instructional designer for Hartnell College. Based on the training material below, generate a structured Canvas LMS onboarding lesson for faculty.

Return ONLY valid JSON — no markdown fences, no explanation — matching this exact schema:
{
  "title": "${moduleTitle || 'Generated Module'}",
  "description": "One-sentence module description",
  "estimatedMinutes": 45,
  "steps": [
    {
      "step_id": "GEN-1",
      "tool_id": "canvas-lms",
      "title": "Introduction",
      "type": "text",
      "content": "2-3 paragraph introduction to the topic",
      "s3LessonText": "brief summary for the Panther AI assistant"
    },
    {
      "step_id": "GEN-2",
      "tool_id": "canvas-lms",
      "title": "Key Concepts",
      "type": "flashcard",
      "cards": [
        { "front": "Question or term?", "back": "Answer or definition" }
      ]
    },
    {
      "step_id": "GEN-3",
      "tool_id": "canvas-lms",
      "title": "Knowledge Check",
      "type": "quiz",
      "questions": [
        {
          "id": "q1",
          "type": "multiple_choice",
          "question": "Question text?",
          "options": ["Option A", "Option B", "Option C", "Option D"],
          "correct": "Option A"
        },
        {
          "id": "q2",
          "type": "fill_blank",
          "question": "The ___ is used to...",
          "correct": "correct word",
          "hint": "hint text"
        },
        {
          "id": "q3",
          "type": "matching",
          "question": "Match each item to its description.",
          "pairs": [
            { "left": "Term 1", "right": "Definition 1" },
            { "left": "Term 2", "right": "Definition 2" },
            { "left": "Term 3", "right": "Definition 3" },
            { "left": "Term 4", "right": "Definition 4" }
          ]
        }
      ]
    }
  ]
}

Rules:
- Include 4-6 flashcards covering the key concepts in the material.
- Make all quiz questions directly testable from the provided content.
- Keep step titles and content specific to the uploaded material — not generic.
- The "s3LessonText" field should be a 1-2 sentence summary the AI chat can use.

Training material:
${combinedText.slice(0, 7000)}`;
}

function parseGeneratedLesson(rawText) {
  let text = rawText.trim();
  // Strip markdown fences if model adds them despite instructions
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  }
  return JSON.parse(text);
}

// ── AWS mode helpers ──────────────────────────────────────────────────────────
async function getPresignedUrlFromLambda(filename) {
  const { data } = await axios.post(`${PREPROD_API_BASE}/upload-url`, { filename });
  return data; // { uploadUrl, key }
}

async function generateModuleViaBedrock(s3Key, filename) {
  // Trigger Amir's module_generator Lambda by sending the S3 key.
  // The Lambda reads the file from S3, calls Bedrock, and returns the lesson JSON.
  const { data } = await axios.post(`${PREPROD_API_BASE}/generate-module`, {
    key:    s3Key,
    bucket: S3_BUCKET,
  });
  return data.lesson || data; // normalise response shape
}

async function fetchModulesFromS3() {
  const { data } = await axios.get(`${PREPROD_API_BASE}/modules`);
  return data.modules || [];
}

// ── Local-dev mode helpers ────────────────────────────────────────────────────
async function generateModuleViaOpenAI(text, filename, moduleTitle) {
  const { default: OpenAI } = await import('openai');
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
  const completion = await openai.chat.completions.create({
    model:       OPENAI_MODEL,
    messages:    [{ role: 'user', content: buildGenerationPrompt(text, moduleTitle || path.basename(filename, path.extname(filename))) }],
    temperature: 0.7,
    max_tokens:  3000,
  });
  return parseGeneratedLesson(completion.choices[0].message.content);
}

// ── Routes ────────────────────────────────────────────────────────────────────

/**
 * POST /api/upload/presign
 * Body: { filename: "my-guide.pdf" }
 *
 * AWS mode:  calls the preprod Lambda, returns { uploadUrl, key }
 * Local mode: returns a fake local "upload" endpoint key so the UI
 *             knows the filename for the next step.
 */
router.post('/presign', async (req, res) => {
  const { filename } = req.body;
  if (!filename) return res.status(400).json({ error: 'filename is required.' });

  if (PREPROD_API_BASE) {
    try {
      const result = await getPresignedUrlFromLambda(filename);
      return res.json(result);
    } catch (err) {
      console.error('[upload] presign Lambda error:', err.message);
      return res.status(502).json({ error: 'Failed to get presigned URL from AWS.', detail: err.message });
    }
  }

  // Local fallback — client will POST the actual file to /api/upload/local
  const safeKey = `local/${Date.now()}-${filename.replace(/[^A-Za-z0-9._-]/g, '_')}`;
  res.json({ uploadUrl: null, key: safeKey, mode: 'local' });
});


/**
 * POST /api/upload/local
 * Accepts the file as multipart/form-data for local-dev mode.
 * Not used in AWS mode — the browser PUTs directly to the S3 presigned URL.
 */
router.post('/local', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file received.' });
  res.json({
    key:          `local/${req.file.filename}`,
    originalName: req.file.originalname,
    size:         req.file.size,
    localPath:    req.file.path,
  });
});


/**
 * POST /api/upload/generate
 * Body: {
 *   files: [{ key, originalName, localPath? }],  // S3 keys or local paths
 *   moduleTitle: "optional title override"
 * }
 *
 * AWS mode:  calls the module_generator Lambda per file, each returns a lesson.
 * Local mode: reads text from disk, calls OpenAI, same output schema.
 *
 * Result is saved to generated-modules.json so training.js can serve it.
 */
router.post('/generate', async (req, res) => {
  const { files = [], moduleTitle } = req.body;
  if (!files.length) return res.status(400).json({ error: 'No files provided.' });

  const existingModules = loadModules();
  const newLessons = [];
  const errors     = [];

  for (const file of files) {
    try {
      let lesson;

      if (PREPROD_API_BASE && !file.key?.startsWith('local/')) {
        // ── AWS path ──────────────────────────────────────────────────────────
        lesson = await generateModuleViaBedrock(file.key, file.originalName);
      } else {
        // ── Local-dev path ────────────────────────────────────────────────────
        if (!OPENAI_API_KEY) {
          errors.push({ file: file.originalName, error: 'OPENAI_API_KEY not set and PREPROD_API_BASE not set — cannot generate.' });
          continue;
        }
        const localPath = file.localPath || path.join(uploadsDir, path.basename(file.key));
        if (!fs.existsSync(localPath)) {
          errors.push({ file: file.originalName, error: 'Local file not found. Use /api/upload/local first.' });
          continue;
        }
        const text = extractLocalText(localPath, file.originalName);
        lesson = await generateModuleViaOpenAI(text, file.originalName, moduleTitle);
      }

      // Assign a stable ID (next available number)
      const moduleId = existingModules.length + newLessons.length + 1;
      lesson.id = moduleId;
      lesson.source_file   = file.originalName;
      lesson.generated_at  = new Date().toISOString();
      if (moduleTitle && newLessons.length === 0) lesson.title = moduleTitle;

      // Re-number step_ids to match the module position
      lesson.steps?.forEach((step, i) => {
        step.step_id = `${moduleId}-${i + 1}`;
      });

      newLessons.push(lesson);
    } catch (err) {
      console.error(`[upload] generation failed for ${file.originalName}:`, err.message);
      errors.push({ file: file.originalName, error: err.message });
    }
  }

  if (!newLessons.length) {
    return res.status(500).json({ error: 'All files failed to generate.', errors });
  }

  const allModules = [...existingModules, ...newLessons];
  saveModules(allModules);

  res.json({
    success:  true,
    generated: newLessons.length,
    errors,
    lessons:  newLessons,
    totalModules: allModules.length,
  });
});


/**
 * GET /api/upload/modules
 * Returns all AI-generated modules.
 * AWS mode tries S3 first, falls back to local cache.
 */
router.get('/modules', async (_req, res) => {
  // Always return the local cache first — it's always up to date
  // because /generate writes to it immediately.
  const cached = loadModules();
  if (cached.length > 0) {
    return res.json({ modules: cached, count: cached.length, source: 'cache' });
  }

  // No local cache — try fetching from S3 via Lambda
  if (PREPROD_API_BASE) {
    try {
      const modules = await fetchModulesFromS3();
      if (modules.length) {
        saveModules(modules); // warm the cache
        return res.json({ modules, count: modules.length, source: 's3' });
      }
    } catch (err) {
      console.warn('[upload] S3 modules fetch failed:', err.message);
    }
  }

  res.json({ modules: [], count: 0, source: 'empty' });
});


/**
 * DELETE /api/upload/modules/:id
 * Removes a single generated module by ID from the local cache.
 */
router.delete('/modules/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const modules = loadModules().filter(m => m.id !== id);
  saveModules(modules);
  res.json({ success: true, remaining: modules.length });
});


/**
 * DELETE /api/upload/modules
 * Clears all generated modules (reset).
 */
router.delete('/modules', (_req, res) => {
  saveModules([]);
  res.json({ success: true, message: 'All generated modules cleared.' });
});

module.exports = router;
