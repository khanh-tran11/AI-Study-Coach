# Canvas AI Trainer — Bedrock Knowledge Base Query Backend

`canvas_ai_trainer_query.py` queries an AWS Bedrock knowledge base built from
processed Canvas training content (lessons, quizzes, assignments, discussions)
and returns a grounded, cited answer to a natural-language question.

## Live API endpoint

The query pipeline is deployed as a public HTTP API (frontend teammates can
call this directly from a browser, CORS is enabled with
`Access-Control-Allow-Origin: *`):

```
POST https://yhpt0ck7c7.execute-api.us-west-2.amazonaws.com/ask
```

**Request body:**

```json
{ "question": "How do I change the name of my course?" }
```

**Response body (200):**

```json
{
  "answer": "Based on the source document \"lesson-changing-course-names.json\"...",
  "grounded": true,
  "sources": ["lesson-changing-course-names.json"]
}
```

Out-of-scope questions return `"grounded": false` and `"sources": []`, with
`answer` explaining that the information isn't available — this is a real
refusal, not a hallucinated guess (see `_is_refusal()` below).

**Error responses:** missing/empty `question` field or invalid JSON body →
`400` with `{"error": "..."}`; any unexpected server-side exception → `500`
with a generic `{"error": "Internal server error."}` (the real exception is
logged to CloudWatch, never returned to the client).

**Example curl command:**

```bash
curl -X POST https://yhpt0ck7c7.execute-api.us-west-2.amazonaws.com/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "How do I change the name of my course?"}'
```

**Infrastructure:** Lambda function `canvas-ai-trainer-query` (Python 3.12,
30s timeout, 256MB memory) behind API Gateway HTTP API `canvas-ai-trainer-api`
(`yhpt0ck7c7`), route `POST /ask`, `$default` stage with auto-deploy. Execution
role `canvas-ai-trainer-lambda-role` is scoped to `bedrock:Retrieve` on the
`canvasAITrainer-v2` KB plus `bedrock:InvokeModel`/`bedrock:Converse`, and
basic CloudWatch Logs access — nothing broader.

## Module progress tracking (DynamoDB)

Two more Lambdas on the same `canvas-ai-trainer-api` Gateway
(`yhpt0ck7c7`), built to match `hartnell-trainer`'s frontend contract
(`client/src/api.js`'s `fetchProgress`/`updateProgress`, consumed by
`ProgressDashboard.jsx` and `TrainingPage.jsx`) **field-for-field** — same
request/response shape as the reference in-memory implementation in
`hartnell-trainer/server/routes/progress.js`.

```
GET  https://yhpt0ck7c7.execute-api.us-west-2.amazonaws.com/api/progress/{userId}
POST https://yhpt0ck7c7.execute-api.us-west-2.amazonaws.com/api/progress/update
```

**POST body:**
```json
{ "userId": "2", "moduleId": 1, "stepId": "1-1", "status": "completed", "timeSpentSeconds": 120 }
```

**Response shape (both GET and the POST's `progress` field):**
```json
{
  "userId": "2",
  "completedModules": 1,
  "totalModules": 10,
  "completionPct": 10,
  "totalHours": 0.1,
  "modules": {
    "1": {
      "steps": { "1-1": { "status": "completed", "updatedAt": "2026-07-23T21:05:48.503304+00:00" } },
      "completedAt": "2026-07-23T21:05:48.503304+00:00"
    }
  }
}
```

A module's `completedAt` is set once every step *recorded so far* for that
module has `status: "completed"` — this matches the original Express
route's exact logic (and its exact quirk: if only 1 of 3 real steps has
been recorded, that alone satisfies "every step is completed"). Faithful
parity with the reference implementation, not something to "fix" without
also updating the frontend's assumption.

**Table:** `canvas-ai-trainer-module-progress` — partition key `userId`
(String) only, one item per user containing the full nested `modules` map.
Real `userId`s are `"1"`–`"5"`, defined in
`hartnell-trainer/server/routes/auth.js` (not to be confused with
`AITrainerProgress`, a separate table with partition key `name` + sort key
`module` — that one belongs to a different, unrelated feature — likely an
instructor-facing monitoring/alerts dashboard — and stores flat per-module
status for users/modules that don't exist in this app's actual auth system
or curriculum. Don't reuse it here.)

**Infrastructure:** Lambdas `canvas-ai-trainer-progress-get` and
`canvas-ai-trainer-progress-update` (Python 3.12, 15s timeout, 256MB),
role `canvas-ai-trainer-progress-lambda-role` scoped to `dynamodb:GetItem`/
`PutItem` on this table only, plus CloudWatch Logs.

**Verified end-to-end:** empty-state GET for a user with no record, a
3-step POST sequence for a real userId, GET read-back matching exactly,
and the missing-field 400 path — all tested against the live endpoint.

## Why a two-step retrieve → generate pattern

The knowledge base (`canvasAITrainer-v2`) is a Bedrock **MANAGED**-type
knowledge base. That type does not support Bedrock's built-in
`retrieve_and_generate` API — calling it returns:

```
ValidationException: This operation is not supported for managed knowledge bases.
```

So this script does the two steps manually:

1. **Retrieve** (`retrieve_chunks`) — calls `bedrock-agent-runtime.retrieve()`
   with `managedSearchConfiguration` (not `vectorSearchConfiguration` —
   that's the other error you'll hit if you copy a "normal" KB example) to
   get the top-N relevant chunks and their source metadata.
2. **Generate** (`generate_answer`) — feeds the chunks that clear
   `RELEVANCE_THRESHOLD` into Claude via `bedrock-runtime.converse()`, with a
   system prompt that instructs the model to answer only from the provided
   context and say so if it can't.

## How to run it

```bash
pip install boto3
python backend/canvas_ai_trainer_query.py
```

Requires AWS credentials for an identity with `bedrock:Retrieve` and
`bedrock:InvokeModel`/`bedrock:Converse` permissions in `us-west-2` (e.g. via
`AWS_PROFILE=<your-sso-profile>`). Import `query_knowledge_base(question)`
from your own code to use it as a library function — it returns a
`QueryResult` with `.answer`, `.grounded`, `.sources`, and `.raw_chunks`.

## Current Knowledge Base ID

```
KNOWLEDGE_BASE_ID = "3GKR6EM7I6"   # canvasAITrainer-v2, us-west-2
```

This is `canvasAITrainer-v2`, a rebuild of the original `canvasAITrainer` KB
(ID `ZYR4YFPTRB`), which disappeared from the account (deleted by someone —
CloudTrail lookup to confirm who/when is blocked by an org-level SCP on this
AWS account, so the cause is unconfirmed). The rebuild was verified to
reproduce the original's retrieval scores on the same test questions almost
to the decimal.

## Known gotcha: new S3 uploads require a manual sync

The knowledge base does **not** auto-sync when new files land in
`s3://dxhub-camp-2026-hartnell-ai-trainer/processed-content/`. The original
KB was only ever synced once, right after creation, and silently served
stale/deleted content for the rest of the hackathon until this was caught.

After uploading new processed content, trigger a sync manually:

```bash
aws bedrock-agent start-ingestion-job \
  --region us-west-2 \
  --knowledge-base-id 3GKR6EM7I6 \
  --data-source-id <data-source-id>
```

Poll `get-ingestion-job` until `status` is `COMPLETE` before querying — it
takes a couple of minutes for ~17 documents.

## What's tested and working

- Retrieval returns correct, relevant source chunks for in-scope questions,
  including paraphrased wording (not just exact-phrase matches) — validated
  against 11+ distinct questions covering course renaming, dashboard
  customization, assignments, quizzes, and discussions.
- Generation step produces accurate, well-cited answers grounded in the
  retrieved chunks.
- Out-of-scope questions (e.g. password reset, unrelated school policy)
  correctly trigger a refusal instead of a hallucinated answer, given the
  strict system prompt.
- `grounded` is derived from checking the model's actual answer text for
  refusal phrasing (`_is_refusal()`), not from retrieval score alone — an
  earlier version flagged `grounded=True` on some out-of-scope questions
  just because an irrelevant chunk happened to clear the score threshold,
  even though the model correctly refused to answer.
- Deployed as a live Lambda + API Gateway HTTP API endpoint (see "Live API
  endpoint" above) — tested end-to-end with real curl requests against the
  deployed endpoint, including both in-scope and out-of-scope questions, and
  both error paths (missing field, invalid JSON).

## What's not built yet

- No authentication/rate-limiting on the API endpoint — it's open to anyone
  with the URL (`AuthorizationType: NONE`). Fine for a hackathon demo, not
  for anything beyond that.
- No automatic re-sync when S3 content changes (see gotcha above) — someone
  has to trigger `start-ingestion-job` by hand.
- No guardrail attached to the knowledge base (`guardrailAction` is always
  `null` in raw retrieve responses).
- `RELEVANCE_THRESHOLD` (currently `0.50`) was derived from a small sample
  of test questions and may need retuning as more content/question types are
  added.
- No automated test suite (pytest etc.) — validation so far has been manual
  script runs against real AWS resources, not CI-friendly unit/integration
  tests with mocked responses.
