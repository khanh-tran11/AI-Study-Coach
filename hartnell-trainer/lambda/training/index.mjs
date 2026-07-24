// Lambda: GET /training/{moduleId}
// Fetches lesson.json + lists S3 assets + returns presigned URLs
import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3     = new S3Client({ region: process.env.AWS_REGION ?? 'us-west-2' });
const BUCKET = process.env.S3_BUCKET_NAME;

const CORS = {
  'Access-Control-Allow-Origin':  process.env.FRONTEND_ORIGIN ?? '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
};

function ok(body)  { return { statusCode: 200, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }; }
function err(code, msg) { return { statusCode: code, headers: CORS, body: JSON.stringify({ error: msg }) }; }

async function s3ToString(key) {
  const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  const chunks = [];
  for await (const chunk of res.Body) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf-8');
}

async function presign(key) {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn: 3600 });
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  const moduleId = event.pathParameters?.moduleId;
  if (!moduleId) return err(400, 'moduleId is required');

  const prefix = `modules/${moduleId}/`;

  // 1. Load lesson schema
  let lesson;
  try {
    lesson = JSON.parse(await s3ToString(`${prefix}lesson.json`));
  } catch {
    lesson = getMockLesson(moduleId);
  }

  // 2. List assets
  let assets = [];
  try {
    const list = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix }));
    assets = list.Contents ?? [];
  } catch { /* no bucket configured — use empty */ }

  // 3. Presign videos + images
  const videoKeys = assets.filter(o => /\.(mp4|mov|webm)$/i.test(o.Key)).map(o => o.Key);
  const imageKeys = assets.filter(o => /\.(jpg|jpeg|png|gif|webp)$/i.test(o.Key)).map(o => o.Key);

  const [videoUrls, imageUrls] = await Promise.all([
    Promise.all(videoKeys.map(async k => ({ key: k, url: await presign(k) }))),
    Promise.all(imageKeys.map(async k => ({ key: k, url: await presign(k) }))),
  ]);

  return ok({ moduleId, lesson, assets: { videos: videoUrls, images: imageUrls } });
};

// ── Mock lesson (used when S3 is not yet configured) ──────────────────────────
function getMockLesson(moduleId) {
  const titles = {
    '1':'Canvas Orientation','2':'Setting Up Your Shell','3':'Course Content Upload',
    '4':'Assignments & Quizzes','5':'Gradebook & Exports','6':'Communication Tools',
    '7':'Accessibility Standards','8':'Student View & Testing','9':'LMS Admin Intro','10':'Capstone & Certification',
  };
  return {
    id: moduleId, title: titles[moduleId] ?? `Module ${moduleId}`,
    description: 'Learn the essentials of Canvas for distance education at Hartnell College.',
    estimatedMinutes: 45,
    steps: [
      { step_id:`${moduleId}-1`, tool_id:'canvas-lms', title:'Introduction', type:'text',
        content:'Welcome to this Canvas training module. Read through each section carefully.',
        s3LessonText:'This is the lesson context passed to the AI assistant.' },
      { step_id:`${moduleId}-2`, tool_id:'canvas-lms', title:'Flashcard Review', type:'flashcard',
        cards:[
          { front:'What is a Canvas Shell?', back:'A course container holding content, assignments, gradebook, and students.' },
          { front:'Where do students see grades?', back:'In the Grades section of the course navigation menu.' },
          { front:'What does publishing a course mean?', back:'Making it visible and accessible to enrolled students.' },
        ]},
      { step_id:`${moduleId}-3`, tool_id:'canvas-lms', title:'Knowledge Check', type:'quiz',
        questions:[
          { id:'q1', question:'Which section shows all active courses on login?', type:'multiple_choice',
            options:['Dashboard','Inbox','Files','Settings'], correct:'Dashboard' },
          { id:'q2', question:'The ________ is the internal messaging system in Canvas.', type:'fill_blank',
            correct:'Inbox', hint:'Think of it like an email system inside Canvas.' },
          { id:'q3', question:'Match each Canvas tool to its purpose.', type:'matching',
            pairs:[
              { left:'Gradebook',    right:'Track and post student scores' },
              { left:'Modules',      right:'Organize course content sequentially' },
              { left:'Announcements',right:'Broadcast messages to all students' },
              { left:'People',       right:'Manage student enrollment' },
            ]},
        ]},
    ],
  };
}
