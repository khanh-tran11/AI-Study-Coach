// Lambda: GET /progress/{userId}  and  POST /progress/update
// Stores completion data in DynamoDB table "HartnellProgress"
import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

const db    = new DynamoDBClient({ region: process.env.AWS_REGION ?? 'us-west-2' });
const TABLE = process.env.PROGRESS_TABLE ?? 'HartnellProgress';
const TOTAL = 10;

const CORS = {
  'Access-Control-Allow-Origin':  process.env.FRONTEND_ORIGIN ?? '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

function ok(body)       { return { statusCode:200, headers:{...CORS,'Content-Type':'application/json'}, body:JSON.stringify(body) }; }
function err(code, msg) { return { statusCode:code, headers:CORS, body:JSON.stringify({error:msg}) }; }

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode:200, headers:CORS, body:'' };

  const method = event.httpMethod;
  const path   = event.path ?? '';

  // ── GET /progress/{userId} ──────────────────────────────────────────────────
  if (method === 'GET') {
    const userId = event.pathParameters?.userId;
    if (!userId) return err(400, 'userId required');

    try {
      const res  = await db.send(new GetItemCommand({ TableName:TABLE, Key:marshall({ userId }) }));
      const item = res.Item ? unmarshall(res.Item) : null;
      return ok(buildStats(userId, item));
    } catch (e) {
      console.error(e);
      return ok(buildStats(userId, null)); // return empty stats on error
    }
  }

  // ── POST /progress/update ───────────────────────────────────────────────────
  if (method === 'POST') {
    let body;
    try { body = JSON.parse(event.body ?? '{}'); } catch { return err(400, 'Invalid JSON'); }

    const { userId, moduleId, stepId, status, timeSpentSeconds = 0 } = body;
    if (!userId || !moduleId || !stepId) return err(400, 'userId, moduleId, stepId required');

    // Upsert step into DynamoDB item using UpdateExpression
    const stepKey = `m${moduleId}_${stepId}`;
    const now     = new Date().toISOString();

    try {
      await db.send(new UpdateItemCommand({
        TableName: TABLE,
        Key: marshall({ userId }),
        UpdateExpression: `
          SET stepStatuses.#sk = :sv,
              totalSeconds = if_not_exists(totalSeconds, :zero) + :ts
        `,
        ExpressionAttributeNames:  { '#sk': stepKey },
        ExpressionAttributeValues: marshall({
          ':sv':   { status, updatedAt: now },
          ':ts':   timeSpentSeconds,
          ':zero': 0,
        }),
      }));
    } catch (e) {
      // Table may not exist yet (local dev) — log and continue
      console.warn('DynamoDB write skipped:', e.message);
    }

    return ok({ success:true });
  }

  return err(405, 'Method not allowed');
};

function buildStats(userId, item) {
  if (!item) return { userId, completedModules:0, totalModules:TOTAL, completionPct:0, totalHours:0, modules:{} };
  const steps    = item.stepStatuses ?? {};
  // Count distinct completed modules
  const modsDone = new Set(
    Object.entries(steps)
      .filter(([, v]) => v.status === 'completed')
      .map(([k]) => k.split('_')[0])   // e.g. "m1"
  ).size;
  const pct = Math.round((modsDone / TOTAL) * 100);
  return {
    userId,
    completedModules: modsDone,
    totalModules:     TOTAL,
    completionPct:    pct,
    totalHours:       +((item.totalSeconds ?? 0) / 3600).toFixed(1),
    modules:          steps,
  };
}
