# Hartnell AI Trainer — One-command startup
# Run from the repo root: .\start.ps1
#
# Starts:
#   1. Node/Express + React dev server  (http://localhost:3000)
#   2. Flask manager dashboard backend  (http://localhost:5001)  [optional]

$repoRoot    = $PSScriptRoot
$appDir      = Join-Path $repoRoot "hartnell-trainer"
$managerDir  = Join-Path $repoRoot "manager-side"

Write-Host ""
Write-Host "=== Hartnell AI Trainer ===" -ForegroundColor Cyan
Write-Host ""

# ── Check node_modules ────────────────────────────────────────────────────────
if (-not (Test-Path (Join-Path $appDir "node_modules"))) {
    Write-Host "[1/3] Installing server dependencies..." -ForegroundColor Yellow
    Push-Location $appDir
    npm install
    Pop-Location
}
if (-not (Test-Path (Join-Path $appDir "client\node_modules"))) {
    Write-Host "[2/3] Installing client dependencies..." -ForegroundColor Yellow
    Push-Location (Join-Path $appDir "client")
    npm install
    Pop-Location
}

# ── Check .env ────────────────────────────────────────────────────────────────
if (-not (Test-Path (Join-Path $appDir ".env"))) {
    Write-Host ""
    Write-Host "WARNING: hartnell-trainer/.env not found." -ForegroundColor Red
    Write-Host "Copy hartnell-trainer/.env.example to hartnell-trainer/.env and fill in your values." -ForegroundColor Red
    Write-Host ""
    exit 1
}

# ── Start Flask manager backend (optional) ────────────────────────────────────
$flaskEnv = Join-Path $managerDir ".env"
if (Test-Path (Join-Path $managerDir "app.py")) {
    Write-Host "[3/3] Starting Flask manager backend on :5001..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$managerDir'; python app.py" -WindowStyle Normal
    Start-Sleep -Seconds 2
} else {
    Write-Host "[3/3] manager-side/app.py not found - skipping Flask startup." -ForegroundColor DarkGray
}

# ── Start main app ────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "Starting Hartnell Trainer (Express :4000 + React :3000)..." -ForegroundColor Green
Write-Host "App will open at http://localhost:3000" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop." -ForegroundColor DarkGray
Write-Host ""

Push-Location $appDir
npm run dev
Pop-Location
