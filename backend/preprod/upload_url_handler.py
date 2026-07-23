"""
Lambda: POST /upload-url
Generates a presigned S3 PUT URL so the browser can upload a file directly
to S3 (avoids routing large files, e.g. video, through Lambda/API Gateway
payload limits).

Request body: {"filename": "some-file.pdf"}
Response body: {"uploadUrl": "...", "key": "raw/<uuid>-some-file.pdf"}
"""

import json
import logging
import os
import re
import uuid

import boto3
from botocore.client import Config

logger = logging.getLogger()
logger.setLevel(logging.INFO)

BUCKET_NAME = os.environ.get("PREPROD_BUCKET", "canvas-ai-trainer-preprod-807462092040")
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc", ".txt", ".mp4", ".mov", ".pptx", ".ppt"}

# Force SigV4 (not the legacy SigV2 query-string scheme) so the presigned
# URL doesn't bake a specific Content-Type into the signature, which made
# direct curl/browser PUTs fail with SignatureDoesNotMatch.
s3 = boto3.client(
    "s3",
    region_name="us-west-2",
    config=Config(signature_version="s3v4", s3={"addressing_style": "virtual"}),
)

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
}


def _response(status_code: int, body: dict) -> dict:
    return {
        "statusCode": status_code,
        "headers": CORS_HEADERS,
        "body": json.dumps(body),
    }


def _safe_filename(filename: str) -> str:
    # Strip any path components (defends against "../../etc/passwd"-style input)
    # and keep only a conservative character set.
    base = os.path.basename(filename)
    return re.sub(r"[^A-Za-z0-9._-]", "_", base)


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return _response(200, {})

    try:
        payload = json.loads(event.get("body") or "{}")
    except (TypeError, json.JSONDecodeError):
        return _response(400, {"error": "Request body must be valid JSON."})

    filename = payload.get("filename")
    if not isinstance(filename, str) or not filename.strip():
        return _response(400, {"error": "Missing or empty 'filename' field."})

    safe_name = _safe_filename(filename)
    ext = os.path.splitext(safe_name)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        return _response(
            400,
            {"error": f"Unsupported file type '{ext}'. Allowed: {sorted(ALLOWED_EXTENSIONS)}"},
        )

    key = f"raw/{uuid.uuid4()}-{safe_name}"

    try:
        upload_url = s3.generate_presigned_url(
            "put_object",
            Params={"Bucket": BUCKET_NAME, "Key": key},
            ExpiresIn=300,
        )
    except Exception:
        logger.exception("Failed to generate presigned URL for key: %r", key)
        return _response(500, {"error": "Internal server error."})

    return _response(200, {"uploadUrl": upload_url, "key": key})
