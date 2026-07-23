const express = require('express');
const { S3Client, GetObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const router = express.Router();

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
 * GET /api/training/:moduleId
 * Returns the parsed JSON lesson schema + presigned URLs for assets.
 *
 * S3 folder convention:
 *   modules/<moduleId>/lesson.json   — lesson schema
 *   modules/<moduleId>/videos/       — .mp4 / .mov files
 *   modules/<moduleId>/images/       — .jpg / .png files
 */
router.get('/:moduleId', async (req, res) => {
  const { moduleId } = req.params;
  const prefix = `modules/${moduleId}/`;

  try {
    // 1. Load lesson schema
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
function getMockLesson(moduleId) {
  const titles = {
    '1': 'Canvas Orientation',       '2': 'Setting Up Your Shell',
    '3': 'Course Content Upload',    '4': 'Assignments & Quizzes',
    '5': 'Gradebook & Exports',      '6': 'Communication Tools',
    '7': 'Accessibility Standards',  '8': 'Student View & Testing',
    '9': 'LMS Admin Intro',          '10': 'Capstone & Certification',
  };
  return {
    id: moduleId,
    title: titles[moduleId] || `Module ${moduleId}`,
    description: 'Learn the essentials of Canvas for distance education at Hartnell College.',
    estimatedMinutes: 45,
    steps: [
      {
        step_id: `${moduleId}-1`,
        tool_id: 'canvas-lms',
        title: 'Introduction',
        type: 'text',
        content: 'Welcome to this Canvas training module. Read through each section carefully.',
        s3LessonText: 'This is the lesson context passed to the AI assistant.',
      },
      {
        step_id: `${moduleId}-2`,
        tool_id: 'canvas-lms',
        title: 'Flashcard Review',
        type: 'flashcard',
        cards: [
          { front: 'What is a Canvas Shell?', back: 'A course container in Canvas that holds your content, assignments, gradebook, and students.' },
          { front: 'Where do students see their grades?', back: 'In the Grades section of the course navigation menu.' },
          { front: 'What does "publishing" a course mean?', back: 'Making it visible and accessible to enrolled students.' },
        ],
      },
      {
        step_id: `${moduleId}-3`,
        tool_id: 'canvas-lms',
        title: 'Knowledge Check',
        type: 'quiz',
        questions: [
          {
            id: 'q1',
            question: 'Which section of Canvas shows all active courses on login?',
            type: 'multiple_choice',
            options: ['Dashboard', 'Inbox', 'Files', 'Settings'],
            correct: 'Dashboard',
          },
          {
            id: 'q2',
            question: 'The ________ is the internal messaging system in Canvas.',
            type: 'fill_blank',
            correct: 'Inbox',
            hint: 'Think of it like an email system inside Canvas.',
          },
          {
            id: 'q3',
            question: 'Match each Canvas tool to its purpose.',
            type: 'matching',
            pairs: [
              { left: 'Gradebook',    right: 'Track and post student scores' },
              { left: 'Modules',      right: 'Organize course content sequentially' },
              { left: 'Announcements',right: 'Broadcast messages to all students' },
              { left: 'People',       right: 'Manage student enrollment' },
            ],
          },
        ],
      },
    ],
  };
}

module.exports = router;
