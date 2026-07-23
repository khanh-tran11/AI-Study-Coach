# Preprod Content Pipeline (testing/simulation)

This is a separate, fully isolated pipeline for testing the "upload raw
training material → AI generates a structured training module → new
knowledge base" flow, before it's wired into the main production KB
(`canvasAITrainer-v2`, see `../README.md`). Nothing here touches the
production bucket, KB, or Lambda.

## Architecture

```
admin-upload.html (real upload UI, on this branch)
        │
        │ 1. POST /upload-url  { filename }
        ▼
canvas-ai-trainer-preprod-upload-url (Lambda)
        │  generates a presigned S3 PUT URL
        ▼
Browser PUTs the file directly to S3:
  s3://canvas-ai-trainer-preprod-807462092040/raw/<uuid>-<filename>
        │
        │ 2. S3 ObjectCreated event
        ▼
canvas-ai-trainer-preprod-module-generator (Lambda)
        │  reads raw file → Bedrock Claude converse() → structured module JSON
        ▼
  s3://canvas-ai-trainer-preprod-807462092040/processed/<filename>.json
        │
        ├─── 3. GET /modules ──► canvas-ai-trainer-preprod-list-modules (Lambda)
        │                         lists+reads processed/*.json directly from S3
        │                         (what admin-upload.html polls to show real results)
        │
        └─── (manual) start-ingestion-job ──► canvasAITrainer-preprod (KB)
                                                indexes processed/ for retrieval
```

## Resources created

| Resource | Name/ID |
|---|---|
| S3 bucket | `canvas-ai-trainer-preprod-807462092040` (public access blocked, CORS enabled for browser PUT/GET) |
| Lambda (upload URL) | `canvas-ai-trainer-preprod-upload-url` → `POST /upload-url` |
| Lambda (module generator) | `canvas-ai-trainer-preprod-module-generator` (S3-triggered on `raw/*`, no HTTP route) |
| Lambda (list modules) | `canvas-ai-trainer-preprod-list-modules` → `GET /modules` |
| API Gateway HTTP API | `canvas-ai-trainer-preprod-api` (`ufmm75g65i`), base URL `https://ufmm75g65i.execute-api.us-west-2.amazonaws.com` |
| IAM role (Lambdas) | `canvas-ai-trainer-preprod-lambda-role` — S3 read/write/list on the preprod bucket only, `bedrock:InvokeModel`/`Converse`, CloudWatch Logs |
| IAM role (KB) | `canvas-ai-trainer-preprod-kb-role` — S3 read on the preprod bucket only |
| Knowledge base | `canvasAITrainer-preprod` (`ZYGJSF1RSR`), data source `IDCBYL8XTS` reading `processed/` |

## Verified working end-to-end

- Real browser test (via `admin-upload.html`, served locally, logged in as
  the demo admin account): uploaded a `.txt` file, watched it go through
  presigned-URL upload → S3 → Lambda trigger → Bedrock generation →
  displayed as a real generated module card in the UI (not the old
  hardcoded `MODULE_TEMPLATES`).
- **`.pdf` extraction confirmed working** (via `pdfplumber`) against a real
  uploaded PDF — generated a correct module in ~19s.
- Knowledge base sync + retrieval confirmed against a generated module.

## Known limitations

- **`.pptx` extraction has a real, unresolved issue.** The `python-pptx`
  text extraction itself works (completes in ~2s), but the subsequent
  Bedrock `converse()` call hung and never returned for one real test
  file — tried timeouts of 60s, 120s, and 300s, all exhausted with no
  exception raised (not a JSON/parsing error, the call itself never
  completed). Suspected cause: rapid repeated test invocations against
  the same model during debugging may have triggered Bedrock-side
  throttling, with boto3's automatic retry/backoff silently consuming the
  entire timeout window before surfacing anything catchable — **this is
  unconfirmed**, not verified via CloudWatch throttling metrics. Timeout
  is currently set back to 90s (fail fast rather than burn 5 minutes of
  billed compute per attempt) pending further investigation.
- **`.docx`, `.doc`, `.ppt`, `.mp4`, `.mov` are not implemented at all** —
  accepted by the dropzone (matching the existing UI's `accept` list) but
  the module-generator Lambda logs a warning and skips them, see
  `KNOWN_UNSUPPORTED_EXTENSIONS` in `module_generator.py`. Real support
  would need `python-docx` (DOCX) and a transcription step — e.g. Amazon
  Transcribe — for video.
- **Output length vs. Lambda timeout is a real tension for dense content.**
  `MAX_OUTPUT_TOKENS` (8192) and `MAX_INPUT_CHARS` (16,000) are tuned
  defaults, not guarantees — very bullet-dense source material can
  generate verbose structured JSON that takes longer than expected. If
  modules stop generating for a specific file, check CloudWatch logs for
  that Lambda first (`/aws/lambda/canvas-ai-trainer-preprod-module-generator`).
- **KB sync is still manual.** Same gotcha as production: uploading a file
  doesn't automatically sync `canvasAITrainer-preprod` — someone has to
  call `start-ingestion-job` (or a future automation would call it after
  the module-generator writes to `processed/`).
- **Deleting a source object does not remove it from the KB's vector
  index**, even after re-running ingestion — confirmed by testing.
  Removing a stale/deleted document requires explicitly calling
  `bedrock-agent delete-knowledge-base-documents` with the S3 URI.
- **No authentication on any of these 3 endpoints** — same caveat as the
  production API.
- **No dedup/versioning** — re-uploading a file with the same name creates
  a new UUID-prefixed object; it doesn't overwrite or merge with a
  previous generation of the same source file.

## Testing locally

```bash
cd AI-Study-Coach
python -m http.server 8123
# open http://127.0.0.1:8123/index.html, sign in as admin@college.edu / admin123
# go to Content & Modules, upload a .txt file, click Generate Modules
```
