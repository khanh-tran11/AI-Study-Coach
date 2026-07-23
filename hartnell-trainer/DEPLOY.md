# Deployment Guide — Hartnell AI Trainer
No local Node.js required after setup. Everything runs on AWS.

---

## Prerequisites (one-time installs)

| Tool | Purpose | Install |
|---|---|---|
| AWS CLI | Deploy from terminal | https://aws.amazon.com/cli/ |
| AWS SAM CLI | Package + deploy Lambda | https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html |
| Git | Push code to trigger Amplify | https://git-scm.com |

Both AWS CLI and SAM CLI are small installers — no Node.js needed.

---

## Step 1 — Configure AWS credentials

Open a terminal (PowerShell or CMD) and run:

```bash
aws configure
```

Enter:
- AWS Access Key ID
- AWS Secret Access Key
- Default region (e.g. `us-west-2`)
- Output format: `json`

---

## Step 2 — Install Lambda dependencies

Each Lambda function needs its own `node_modules`. Run once before deploying:

```bash
cd hartnell-trainer/lambda/training  && npm install
cd ../progress                       && npm install
cd ../chat                           && npm install
cd ../auth                           && npm install
cd ../../..
```

> You only need Node.js for this step. After this, AWS runs your code — not your machine.

---

## Step 3 — Deploy backend (Lambda + API Gateway + DynamoDB + S3)

From the `hartnell-trainer` folder:

```bash
cd hartnell-trainer

# First deploy — creates an S3 bucket for SAM artifacts automatically
sam deploy --guided
```

When prompted:

| Prompt | Value |
|---|---|
| Stack name | `hartnell-trainer` |
| AWS Region | `us-west-2` (or your region) |
| OpenAIApiKey | Your OpenAI API key |
| AmplifyAppId | `placeholder` (update after step 4) |
| Confirm changes | `Y` |
| Allow SAM to create IAM roles | `Y` |
| Save config to samconfig.toml | `Y` |

After deploy finishes, copy the **ApiUrl** from the Outputs section:
```
ApiUrl = https://xxxxxxxxxx.execute-api.us-west-2.amazonaws.com/prod
```

---

## Step 4 — Host frontend on AWS Amplify

### Option A — Amplify Console (easiest, no CLI needed)

1. Push your code to GitHub (or CodeCommit)
2. Go to **AWS Amplify Console** → https://console.aws.amazon.com/amplify
3. Click **New app → Host web app**
4. Connect your GitHub repo, select the `main` branch
5. Amplify auto-detects `amplify.yml` — click **Next**
6. Under **Environment variables**, add:

   | Variable | Value |
   |---|---|
   | `REACT_APP_API_URL` | The ApiUrl from Step 3 output |

7. Click **Save and deploy**

Amplify builds and hosts your React app automatically. Every `git push` to `main` triggers a new deploy.

### Option B — Amplify CLI

```bash
npm install -g @aws-amplify/cli   # one-time
amplify init
amplify add hosting
amplify publish
```

---

## Step 5 — Update CORS to lock down to your Amplify domain

After Amplify gives you a URL (e.g. `https://main.abc123.amplifyapp.com`):

1. Open `template.yaml`
2. Find `FRONTEND_ORIGIN` and replace `*` with your Amplify URL
3. Re-deploy: `sam deploy`

---

## Step 6 — Upload training materials to S3

The S3 bucket name is in the SAM deploy Outputs (`TrainingBucketName`).

```bash
# Upload a lesson schema
aws s3 cp lesson.json s3://YOUR-BUCKET/modules/1/lesson.json

# Upload a video
aws s3 cp canvas-intro.mp4 s3://YOUR-BUCKET/modules/1/videos/canvas-intro.mp4

# Upload an image
aws s3 cp screenshot.png s3://YOUR-BUCKET/modules/1/images/screenshot.png
```

**lesson.json format:**
```json
{
  "id": "1",
  "title": "Canvas Orientation",
  "description": "Get comfortable with the Canvas dashboard.",
  "estimatedMinutes": 45,
  "steps": [
    {
      "step_id": "1-1",
      "tool_id": "canvas-lms",
      "title": "Introduction",
      "type": "text",
      "content": "Welcome to Canvas...",
      "s3LessonText": "Context passed to the AI assistant."
    },
    {
      "step_id": "1-2",
      "tool_id": "canvas-lms",
      "title": "Flashcard Review",
      "type": "flashcard",
      "cards": [
        { "front": "What is a Canvas Shell?", "back": "A course container." }
      ]
    }
  ]
}
```

---

## Architecture Summary

```
GitHub repo
    │  git push
    ▼
AWS Amplify ──── builds React app ──── serves at amplifyapp.com
                        │
                        │  REACT_APP_API_URL
                        ▼
              API Gateway (HTTP API)
              /auth  /training  /progress  /chat
                        │
              ┌─────────┼──────────┬──────────┐
              ▼         ▼          ▼          ▼
         Lambda      Lambda     Lambda    Lambda
          auth      training   progress    chat
                        │          │         │
                        ▼          ▼         ▼
                     S3 Bucket  DynamoDB   OpenAI
                  (lessons,     (progress   API
                  videos,       tracking)
                  images)
```

---

## Re-deploying after code changes

**Backend changes** (Lambda code):
```bash
cd hartnell-trainer
sam deploy
```

**Frontend changes** (React):
```bash
git add .
git commit -m "update"
git push origin main
# Amplify auto-builds and deploys
```

---

## Costs (approximate, free tier friendly)

| Service | Free tier | After free tier |
|---|---|---|
| Lambda | 1M requests/month free | ~$0.20 per 1M |
| API Gateway | 1M calls/month free | ~$1.00 per 1M |
| DynamoDB | 25 GB + 25 WCU free | Pay per request |
| S3 | 5 GB free | ~$0.023/GB |
| Amplify | 1000 build mins/month free | ~$0.01/min |

For a college pilot with a few dozen faculty, monthly cost is effectively **$0**.
