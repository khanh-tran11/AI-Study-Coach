/**
 * server/routes/training.js
 *
 * Serves training modules to the learner frontend (TrainingPage.jsx).
 *
 * Priority order for a module:
 *   1. AI-generated module in generated-modules.json  (admin uploaded content)
 *   2. lesson.json in S3 at modules/<id>/lesson.json  (manually curated content)
 *   3. Mock lesson from mock-lessons.js               (local dev fallback)
 *
 * This means as soon as an admin uploads a file and generates a module,
 * learners automatically see the new content — no restart needed.
 */

const express  = require('express');
const path     = require('path');
const fs       = require('fs');
const { S3Client, GetObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const router   = express.Router();

// ── Generated modules cache (written by upload.js) ────────────────────────────
const MODULES_FILE = path.join(__dirname, '..', 'generated-modules.json');

function loadGeneratedModules() {
  try {
    if (fs.existsSync(MODULES_FILE)) {
      return JSON.parse(fs.readFileSync(MODULES_FILE, 'utf-8'));
    }
  } catch { /* ignore parse errors */ }
  return [];
}

// ── S3 client (used for curated content bucket) ───────────────────────────────
const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-west-2',
  ...(process.env.AWS_ACCESS_KEY_ID && {
    credentials: {
      accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  }),
});

const BUCKET = process.env.S3_BUCKET_NAME;

async function s3ToString(key) {
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  const res = await s3.send(cmd);
  return new Promise((resolve, reject) => {
    const chunks = [];
    res.Body.on('data', c => chunks.push(c));
    res.Body.on('end',  () => resolve(Buffer.concat(chunks).toString('utf-8')));
    res.Body.on('error', reject);
  });
}

async function presign(key) {
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3, cmd, { expiresIn: 3600 });
}

// ── Default module list (shown when nothing is generated yet) ─────────────────
const DEFAULT_MODULES = [
  { id: 1,  title: 'Canvas Orientation',      estimatedMinutes: 45 },
  { id: 2,  title: 'Setting Up Your Shell',   estimatedMinutes: 60 },
  { id: 3,  title: 'Course Content Upload',   estimatedMinutes: 50 },
  { id: 4,  title: 'Assignments & Quizzes',   estimatedMinutes: 55 },
  { id: 5,  title: 'Gradebook & Exports',     estimatedMinutes: 40 },
  { id: 6,  title: 'Communication Tools',     estimatedMinutes: 35 },
  { id: 7,  title: 'Accessibility Standards', estimatedMinutes: 50 },
  { id: 8,  title: 'Student View & Testing',  estimatedMinutes: 30 },
  { id: 9,  title: 'LMS Admin Intro',         estimatedMinutes: 45 },
  { id: 10, title: 'Capstone & Certification',estimatedMinutes: 60 },
];

// ── Mock lessons (local dev, no S3 needed) ────────────────────────────────────
const mockLessonsData = require('../mock-lessons');
function getMockLesson(moduleId) {
  return mockLessonsData[String(moduleId)] || mockLessonsData['1'];
}

/**
 * Normalise a generated lesson so TrainingPage.jsx always gets the
 * full step schema it expects, regardless of which AI produced it.
 *
 * Handles two source shapes:
 *   A) Amir's preprod generator → { title, content_blocks: [{tag,text}] }
 *   B) upload.js OpenAI/Bedrock → { title, description, estimatedMinutes, steps: [...] }
 */
function normaliseLesson(raw, moduleId) {
  // Shape B already has steps — just ensure required fields exist
  if (Array.isArray(raw.steps) && raw.steps.length > 0) {
    return {
      title:            raw.title            || `Module ${moduleId}`,
      description:      raw.description      || '',
      estimatedMinutes: raw.estimatedMinutes  || 45,
      steps: raw.steps.map((step, i) => ({
        step_id:      step.step_id      || `${moduleId}-${i + 1}`,
        tool_id:      step.tool_id      || 'canvas-lms',
        title:        step.title        || `Step ${i + 1}`,
        type:         step.type         || 'text',
        content:      step.content      || '',
        s3LessonText: step.s3LessonText || step.content || '',
        // flashcard fields
        cards:     step.cards     || undefined,
        // quiz fields
        questions: step.questions || undefined,
      })),
    };
  }

  // Shape A — convert content_blocks into a single text step
  if (Array.isArray(raw.content_blocks)) {
    const textContent = raw.content_blocks
      .map(b => b.text)
      .filter(Boolean)
      .join('\n\n');
    return {
      title:            raw.title || `Module ${moduleId}`,
      description:      raw.description || '',
      estimatedMinutes: raw.estimatedMinutes || 45,
      steps: [
        {
          step_id:      `${moduleId}-1`,
          tool_id:      'canvas-lms',
          title:        'Overview',
          type:         'text',
          content:      textContent,
          s3LessonText: textContent.slice(0, 300),
        },
      ],
    };
  }

  // Unknown shape — wrap as a single text step so the frontend never crashes
  return {
    title:            raw.title || `Module ${moduleId}`,
    description:      '',
    estimatedMinutes: 45,
    steps: [
      {
        step_id:      `${moduleId}-1`,
        tool_id:      'canvas-lms',
        title:        'Content',
        type:         'text',
        content:      JSON.stringify(raw),
        s3LessonText: '',
      },
    ],
  };
}

// ── GET /api/training ─────────────────────────────────────────────────────────
// Returns the ordered module list. Generated modules appear first; the
// remaining default slots fill in so the sidebar always shows all 10.
router.get('/', (_req, res) => {
  const generated = loadGeneratedModules();

  if (generated.length === 0) {
    return res.json({ modules: DEFAULT_MODULES, count: DEFAULT_MODULES.length, source: 'default' });
  }

  // Build a merged list: generated modules take positions 1…N,
  // default titles fill the rest up to 10.
  const merged = generated.map((m, i) => ({
    id:               m.id    || i + 1,
    title:            m.title || `Generated Module ${i + 1}`,
    description:      m.description || '',
    estimatedMinutes: m.estimatedMinutes || 45,
    source:           'generated',
  }));

  // Pad with defaults if fewer than 10 generated modules exist
  for (let i = merged.length; i < DEFAULT_MODULES.length; i++) {
    merged.push({ ...DEFAULT_MODULES[i], source: 'default' });
  }

  res.json({ modules: merged.slice(0, 10), count: merged.length, source: 'mixed' });
});

// ── GET /api/training/:moduleId ───────────────────────────────────────────────
router.get('/:moduleId', async (req, res) => {
  const { moduleId } = req.params;

  try {
    // ── Priority 1: AI-generated module ──────────────────────────────────────
    const generated = loadGeneratedModules();
    const genMod    = generated.find(m => String(m.id) === String(moduleId));

    if (genMod) {
      const lesson = normaliseLesson(genMod, moduleId);
      return res.json({ moduleId, lesson, assets: { videos: [], images: [] }, source: 'generated' });
    }

    // ── Priority 2: S3 curated content ───────────────────────────────────────
    if (BUCKET) {
      const prefix = `modules/${moduleId}/`;
      let lesson;

      try {
        const raw = await s3ToString(`${prefix}lesson.json`);
        lesson    = normaliseLesson(JSON.parse(raw), moduleId);
      } catch {
        // lesson.json not in S3 — fall through to mock
        lesson = null;
      }

      if (lesson) {
        // Fetch presigned URLs for any video/image assets in the module folder
        let assets = [];
        try {
          const listRes = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix }));
          assets = listRes.Contents || [];
        } catch { /* ignore */ }

        const videoKeys = assets.filter(o => /\.(mp4|mov|webm)$/i.test(o.Key)).map(o => o.Key);
        const imageKeys = assets.filter(o => /\.(jpg|jpeg|png|gif|webp)$/i.test(o.Key)).map(o => o.Key);

        const [videoUrls, imageUrls] = await Promise.all([
          Promise.all(videoKeys.map(async k => ({ key: k, url: await presign(k) }))),
          Promise.all(imageKeys.map(async k => ({ key: k, url: await presign(k) }))),
        ]);

        return res.json({
          moduleId, lesson,
          assets: { videos: videoUrls, images: imageUrls },
          source: 's3',
        });
      }
    }

    // ── Priority 3: Mock lesson (local dev fallback) ──────────────────────────
    const lesson = normaliseLesson(getMockLesson(moduleId), moduleId);
    res.json({ moduleId, lesson, assets: { videos: [], images: [] }, source: 'mock' });

  } catch (err) {
    console.error('[training] fetch error for module', moduleId, err.message);
    res.status(500).json({ error: 'Failed to load training module.', detail: err.message });
  }
});

module.exports = router;
