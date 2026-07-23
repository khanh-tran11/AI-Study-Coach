# Running the Hartnell AI Trainer (local demo)

This is the **verified, working** way to run the app end-to-end. `progress`
and `chat` are wired to our real AWS backend (Bedrock + DynamoDB); `auth`,
`training`, and `upload` run as before, unchanged. The Admin "Applicants"
tab is wired to a real, separate Flask backend (`manager-side/`, Khanh's
DynamoDB-backed employee tracking + cheating-detection logic) — see its
own section below.

No cloud deployment yet — see "Cloud deployment (not done)" at the bottom
for why, and what's already scaffolded for later.

---

## Prerequisites

- **Node.js** (LTS) and npm — https://nodejs.org
- **Python 3** and pip (only needed for the Admin "Applicants" tab's real
  backend — everything else works without Python)
- Internet access (the app calls our live AWS API Gateway endpoint, and
  the manager-side Flask app calls DynamoDB/Bedrock directly)
- AWS credentials configured for the manager-side Flask app specifically
  (e.g. `AWS_PROFILE` set to an SSO profile with DynamoDB + Bedrock access
  in `us-west-2`) — the main Express/React app needs none of this itself.

---

## One-time setup

From the repo root:

```bash
cd hartnell-trainer
npm install

cd client
npm install
cd ..
```

A working `.env` is already checked into `hartnell-trainer/.env` with
`PORT=4000`. The AWS/OpenAI placeholder values in it are **not used** by
the routes we rely on (`progress`/`chat` now call our AWS endpoints
directly; their URLs are hardcoded in the route files, not read from
`.env`). Leave `.env` as-is unless you're working on `training.js` or
`upload.js`, which do still read the AWS/S3 variables.

---

## Start everything with one command

From `hartnell-trainer/`:

```bash
npm run dev
```

This runs the Express server (`:4000`, via nodemon) and the React dev
server (`:3000`, via `react-scripts start`) together. Wait for:

```
Hartnell Trainer API running on :4000
```
and
```
webpack compiled
```

Then open **http://localhost:3000**.

To stop: `Ctrl+C` in that terminal (or, on Windows, if it doesn't fully
release the ports: `Get-Process node | Stop-Process -Force` in PowerShell).

---

## Start the manager-side Flask backend (for the Admin "Applicants" tab)

From the repo root, in a separate terminal:

```bash
cd manager-side
pip install -r requirements.txt
python app.py
```

Wait for `Running on http://127.0.0.1:5001`. This must be running
*before* you open the Admin "Applicants" tab, or it'll show a "could not
load tracking data" error (Express's `server/routes/manager.js` proxies
to it and logs the real error to the Express terminal if it can't reach
it). It uses the **real** `AITrainerProgress` DynamoDB table — a 3-module
pilot curriculum ("Intro to AI", "Data Basics", "Machine Learning"), not
the Canvas Onboarding curriculum the rest of the app trains on. That's
intentional — this tab demonstrates the real employee-tracking and
cheating-detection backend as its own capability, separate from the
Canvas training content.

---

## Demo login credentials

From `server/routes/auth.js`:

| Email | Password | Role |
|---|---|---|
| `admin@hartnell.edu` | `admin123` | admin |
| `m.santos@hartnell.edu` | `faculty123` | faculty |
| `j.okafor@hartnell.edu` | `faculty123` | faculty |
| `l.cheng@hartnell.edu` | `faculty123` | faculty |
| `a.yusuf@hartnell.edu` | `faculty123` | faculty |

---

## What to expect

- **Login, module list, module content** — work exactly as before (no AWS
  dependency; `training.js` falls back to built-in mock lesson content if
  S3 isn't configured, which it isn't here).
- **"Ask Panther" chat** — now answers using our real Bedrock knowledge
  base instead of OpenAI. It answers Canvas-procedure questions well
  (e.g. "How do I change the name of my course?"). It does **not**
  remember earlier turns in the conversation and does **not** have the
  original warm "Panther" tutoring persona — each question is answered in
  isolation from the Canvas KB only. This is a known, documented tradeoff
  (see comments in `routes/chat.js`), not a bug.
- **Completing a step** — writes real progress to DynamoDB
  (`canvas-ai-trainer-module-progress` table) instead of an in-memory
  store that used to reset on every server restart. Refreshing the page,
  or restarting the server, no longer loses progress.
- **Admin → Applicants tab** — shows real employees (Lisa, John, Mike,
  Kevin, Sarah) from `AITrainerProgress`, with real completion %, real
  time-spent, and real cheating-detection status badges ("⚠️ Cheating
  Flagged" / "⚠️ Warning") computed by Khanh's `manager-side/db.py` logic
  — not mocked. Requires the Flask backend running (see above).

---

## Troubleshooting

- **`Error: Cannot find module 'multer'`** — means `npm install` wasn't
  run after pulling this branch (multer was a missing dependency in the
  original code that's now in `package.json`). Re-run `npm install` from
  `hartnell-trainer/`.
- **Chat or progress calls fail** — check your internet connection; both
  routes call `https://yhpt0ck7c7.execute-api.us-west-2.amazonaws.com`
  directly. Check the Express terminal for the actual error logged by
  `console.error(...)` in `routes/chat.js` / `routes/progress.js`.
- **Port already in use** — something didn't shut down cleanly from a
  previous run. On Windows: `Get-Process node | Stop-Process -Force`,
  then `npm run dev` again.

---

## Cloud deployment (not done — deliberately, for tonight)

`template.yaml` in this folder describes a fully serverless SAM
deployment (Lambda + API Gateway + its own DynamoDB table + Amplify
Hosting). **It has never actually been deployed** (no CloudFormation
stack, no Amplify app exist in the AWS account), and it predates this
integration — its own `progress`/`chat` Lambdas still point at OpenAI and
a separate, empty `HartnellProgress` table, and its API routes don't even
match what the frontend calls (`/progress/...` vs. the frontend's
`/api/progress/...`). Treat it as an unfinished, disconnected plan, not a
deploy target — reworking it or standing up Express somewhere like AWS
App Runner is future work, not something this local-demo setup depends on.
