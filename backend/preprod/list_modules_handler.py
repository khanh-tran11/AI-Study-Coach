"""
Lambda: GET /modules
Lists AI-generated training modules from processed/ in the preprod bucket
so the admin-upload.html frontend can display real generated content
instead of placeholder data.

Response body: {"modules": [{"title": ..., "content_blocks": [...],
                              "source_file": ..., "generated_at": ...}, ...]}
"""

import json
import logging
import os

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

BUCKET_NAME = os.environ.get("PREPROD_BUCKET", "canvas-ai-trainer-preprod-807462092040")

s3 = boto3.client("s3", region_name="us-west-2")

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json",
}


def _response(status_code: int, body: dict) -> dict:
    return {
        "statusCode": status_code,
        "headers": CORS_HEADERS,
        "body": json.dumps(body),
    }


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return _response(200, {})

    try:
        listing = s3.list_objects_v2(Bucket=BUCKET_NAME, Prefix="processed/")
        modules = []
        for item in listing.get("Contents", []):
            key = item["Key"]
            if not key.endswith(".json"):
                continue
            obj = s3.get_object(Bucket=BUCKET_NAME, Key=key)
            modules.append(json.loads(obj["Body"].read()))
        return _response(200, {"modules": modules})
    except Exception:
        logger.exception("Failed to list modules")
        return _response(500, {"error": "Internal server error."})
