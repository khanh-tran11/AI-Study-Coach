# Hartnell College AI Trainer

Canvas faculty onboarding platform — React + Express + AWS S3 + OpenAI.

## Quick Start

### 1. Install Node.js
Download from https://nodejs.org (LTS version recommended).

### 2. Install dependencies
```bash
cd hartnell-trainer
npm install
```

### 3. Configure environment
```bash
cp .env.example .env
```
Edit `.env` and fill in:
| Variable | Value |
|---|---|
| `AWS_REGION` | e.g. `us-west-2` |
| `AWS_ACCESS_KEY_ID` | Your AWS key |
| `AWS_SECRET_ACCESS_KEY` | Your AWS secret |
| `S3_BUCKET_NAME` | Your S3 bucket name |
| `OPENAI_API_KEY` | Your OpenAI API key |

### 4. Run (dev mode — API + React together)
```bash
npm run dev
```
- React app → http://localhost:3000  
- Express API → http://localhost:4000

## Demo Credentials
| Role | Email | Password |
|---|---|---|
| Admin/Owner | admin@hartnell.edu | admin123 |
| Faculty | m.santos@hartnell.edu | faculty123 |

## S3 Bucket Structure
```
hartnell-trainer-assets/
  modules/
    1/
      lesson.json       ← lesson schema (see server/routes/training.js for shape)
      videos/           ← .mp4 / .mov files
      images/           ← .jpg / .png files
    2/
      ...
```
If `lesson.json` is missing, the API falls back to built-in mock data automatically.

## Project Structure
```
hartnell-trainer/
  server/
    index.js                ← Express entry point
    routes/
      auth.js               ← POST /api/auth/login
      training.js           ← GET  /api/training/:moduleId
      progress.js           ← GET/POST /api/progress
      chat.js               ← POST /api/chat (OpenAI)
  client/src/
    index.jsx               ← React entry point
    App.jsx                 ← Router + role guards
    AuthContext.jsx         ← Session state
    HartnellLogo.jsx        ← SVG logo & panther mark
    theme.css               ← Official Hartnell brand tokens
    pages/
      LoginPage.jsx         ← Split hero login, role selector
      TrainingPage.jsx      ← Faculty training interface
      AdminPage.jsx         ← Upload, module gen, applicant table
    components/
      Flashcard.jsx         ← 3D flip cards (framer-motion)
      Quiz.jsx              ← MC + fill-in-blank + retry queue
      Matching.jsx          ← Click-to-pair matching
      ProgressDashboard.jsx ← Animated ring, module path, escalation
      ChatPanel.jsx         ← Floating Panther AI side-panel
```
