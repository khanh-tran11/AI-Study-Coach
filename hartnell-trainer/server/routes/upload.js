const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const OpenAI  = require('openai');
const router  = express.Router();

// ── Storage for generated modules (in-memory + JSON file) ──
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

// ── Multer config for file uploads ──
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.docx', '.doc', '.txt', '.pptx', '.ppt', '.md'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

// ── Text extraction ──
function extractText(filePath, originalName) {
  const ext = path.extname(originalName).toLowerCase();
  if (ext === '.txt' || ext === '.md') {
    return fs.readFileSync(filePath, 'utf-8');
  }
  try {
    const buf = fs.readFileSync(filePath);
    const text = buf.toString('utf-8')
      .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
      .replace(/\s{3,}/g, '\n')
      .trim();
    return text.slice(0, 8000) || `Content from file: ${originalName}`;
  } catch {
    return `Content from file: ${originalName}`;
  }
}

// ── Lazy OpenAI init ──
let openai;
function getOpenAI() {
  if (!openai) openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openai;
}

/**
 * POST /api/upload
 */
router.post('/', upload.array('files', 20), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded.' });
  }
  const results = req.files.map(f => ({
    originalName: f.originalname,
    savedPath: f.path,
    size: f.size,
    text: extractText(f.path, f.originalname),
  }));
  res.json({ files: results.map(r => ({ name: r.originalName, size: r.size, textLength: r.text.length })), count: results.length });
});

/**
 * POST /api/upload/generate
 */
router.post('/generate', async (req, res) => {
  const { files = [], moduleTitle } = req.body;
  if (files.length === 0) {
    return res.status(400).json({ error: 'No file content provided.' });
  }

  const combinedText = files.map(f => `--- ${f.name} ---\n${f.text}`).join('\n\n');

  const prompt = `You are an instructional designer. Based on the following training material, generate a structured lesson module for faculty onboarding at Hartnell College (Canvas LMS training).

The module must include exactly 3 steps in this order:
1. A "text" step — an introduction summarizing the key concepts
2. A "flashcard" step — with 4-6 flashcards (each has "front" = question, "back" = answer)
3. A "quiz" step — with 3 questions:
   - 1 multiple_choice question (4 options, one correct)
   - 1 fill_blank question (with a hint)
   - 1 matching question (4 pairs with "left" and "right")

Return ONLY valid JSON matching this schema (no markdown, no explanation):
{
  "title": "Module Title",
  "description": "Brief module description",
  "estimatedMinutes": 45,
  "steps": [
    { "step_id": "1-1", "tool_id": "canvas-lms", "title": "Introduction", "type": "text", "content": "...", "s3LessonText": "..." },
    { "step_id": "1-2", "tool_id": "canvas-lms", "title": "Flashcard Review", "type": "flashcard", "cards": [{ "front": "?", "back": "." }] },
    { "step_id": "1-3", "tool_id": "canvas-lms", "title": "Knowledge Check", "type": "quiz", "questions": [
      { "id": "q1", "question": "...", "type": "multiple_choice", "options": ["A","B","C","D"], "correct": "A" },
      { "id": "q2", "question": "The __ is...", "type": "fill_blank", "correct": "Answer", "hint": "Hint" },
      { "id": "q3", "question": "Match items.", "type": "matching", "pairs": [{"left":"X","right":"Y"}] }
    ]}
  ]
}

Training material:
${combinedText.slice(0, 6000)}`;

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 3000,
    });

    let content = completion.choices[0].message.content.trim();
    if (content.startsWith('```')) {
      content = content.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const lesson = JSON.parse(content);
    if (moduleTitle) lesson.title = moduleTitle;

    const modules = loadModules();
    const moduleId = modules.length + 1;
    lesson.id = moduleId;
    lesson.steps.forEach((step, i) => { step.step_id = `${moduleId}-${i + 1}`; });

    modules.push(lesson);
    saveModules(modules);

    res.json({ success: true, moduleId, lesson });
  } catch (err) {
    console.error('Generate error:', err.message);
    res.status(500).json({ error: 'Failed to generate module.', detail: err.message });
  }
});

/**
 * GET /api/upload/modules
 */
router.get('/modules', (_req, res) => {
  const modules = loadModules();
  res.json({ modules, count: modules.length });
});

module.exports = router;
