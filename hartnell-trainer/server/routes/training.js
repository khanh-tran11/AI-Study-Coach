const express = require('express');
const path    = require('path');
const fs      = require('fs');
const { S3Client, GetObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const router = express.Router();

// ── Load generated modules from disk ──
const MODULES_FILE = path.join(__dirname, '..', 'generated-modules.json');
function loadGeneratedModules() {
  try {
    if (fs.existsSync(MODULES_FILE)) return JSON.parse(fs.readFileSync(MODULES_FILE, 'utf-8'));
  } catch { /* ignore */ }
  return [];
}

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.S3_BUCKET_NAME;

// Helper: stream S3 object to string
async function s3ToString(key) {
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  const res = await s3.send(cmd);
  return new Promise((resolve, reject) => {
    const chunks = [];
    res.Body.on('data', c => chunks.push(c));
    res.Body.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    res.Body.on('error', reject);
  });
}

// Helper: generate presigned URL (1 hour)
async function presign(key) {
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3, cmd, { expiresIn: 3600 });
}

/**
 * GET /api/training
 * Returns the list of all available modules.
 */
router.get('/', (_req, res) => {
  const generated = loadGeneratedModules();
  const DEFAULT_MODULES = [
    { id: 1, title: 'Canvas Orientation', estimatedMinutes: 45 },
    { id: 2, title: 'Setting Up Your Shell', estimatedMinutes: 60 },
    { id: 3, title: 'Course Content Upload', estimatedMinutes: 50 },
    { id: 4, title: 'Assignments & Quizzes', estimatedMinutes: 55 },
    { id: 5, title: 'Gradebook & Exports', estimatedMinutes: 40 },
    { id: 6, title: 'Communication Tools', estimatedMinutes: 35 },
    { id: 7, title: 'Accessibility Standards', estimatedMinutes: 50 },
    { id: 8, title: 'Student View & Testing', estimatedMinutes: 30 },
    { id: 9, title: 'LMS Admin Intro', estimatedMinutes: 45 },
    { id: 10, title: 'Capstone & Certification', estimatedMinutes: 60 },
  ];
  const modules = generated.length > 0
    ? generated.map((m, i) => ({ id: m.id || i + 1, title: m.title, description: m.description, estimatedMinutes: m.estimatedMinutes || 45 }))
    : DEFAULT_MODULES;
  res.json({ modules, count: modules.length, source: generated.length > 0 ? 'generated' : 'default' });
});

/**
 * GET /api/training/:moduleId
 */
router.get('/:moduleId', async (req, res) => {
  const { moduleId } = req.params;
  const prefix = `modules/${moduleId}/`;

  try {
    // Check generated modules first
    const generatedModules = loadGeneratedModules();
    const genMod = generatedModules.find(m => String(m.id) === String(moduleId));
    if (genMod) {
      return res.json({ moduleId, lesson: genMod, assets: { videos: [], images: [] } });
    }

    // Try S3
    let lesson;
    try {
      const raw = await s3ToString(`${prefix}lesson.json`);
      lesson = JSON.parse(raw);
    } catch {
      // Fallback: return mock lesson so front-end works without live S3
      lesson = getMockLesson(moduleId);
    }

    // 2. List all assets in the module folder
    const listCmd = new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix });
    let assets = [];
    try {
      const listRes = await s3.send(listCmd);
      assets = listRes.Contents || [];
    } catch {
      assets = [];
    }

    // 3. Generate presigned URLs for videos and images
    const videoKeys = assets.filter(o => /\.(mp4|mov|webm)$/i.test(o.Key)).map(o => o.Key);
    const imageKeys = assets.filter(o => /\.(jpg|jpeg|png|gif|webp)$/i.test(o.Key)).map(o => o.Key);

    const [videoUrls, imageUrls] = await Promise.all([
      Promise.all(videoKeys.map(async k => ({ key: k, url: await presign(k) }))),
      Promise.all(imageKeys.map(async k => ({ key: k, url: await presign(k) }))),
    ]);

    res.json({ moduleId, lesson, assets: { videos: videoUrls, images: imageUrls } });
  } catch (err) {
    console.error('Training fetch error:', err);
    res.status(500).json({ error: 'Failed to load training module', detail: err.message });
  }
});

// ── Mock lesson schema (used when S3 is not configured) ──
const mockLessonsData = require('../mock-lessons');
function getMockLesson(moduleId) {
  return mockLessonsData[String(moduleId)] || mockLessonsData['1'];
}

module.exports = router;
