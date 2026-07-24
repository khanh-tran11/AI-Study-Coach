import boto3
from datetime import datetime
from botocore.exceptions import ClientError

# Initialize DynamoDB resource
dynamodb = boto3.resource("dynamodb", region_name="us-west-2")
table = dynamodb.Table("AITrainerProgress")


def update_module_progress(user_name: str, module_name: str, completed: bool = True) -> dict:
    """
    Update a user's module progress in DynamoDB.

    Args:
        user_name:   The user's name (partition key)
        module_name: The module they completed (sort key)
        completed:   Whether the module is marked complete (default True)

    Returns:
        The updated DynamoDB item attributes.
    """
    timestamp = datetime.utcnow().isoformat()
    progress_status = "completed" if completed else "in_progress"

    try:
        response = table.update_item(
            Key={
                "userId": user_name,
                "module": module_name,
            },
            UpdateExpression=(
                "SET progress = :progress, "
                "last_updated = :timestamp"
            ),
            ExpressionAttributeValues={
                ":progress": progress_status,
                ":timestamp": timestamp,
            },
            ReturnValues="ALL_NEW",
        )
        updated_item = response.get("Attributes", {})
        print(f"Updated: {user_name} | {module_name} | {progress_status}")
        return updated_item

    except ClientError as e:
        print(f"Error updating DynamoDB: {e.response['Error']['Message']}")
        raise


def get_user_progress(user_name: str) -> list:
    """
    Retrieve all module progress records for a given user.

    Args:
        user_name: The user's name to look up.

    Returns:
        List of progress records for that user.
    """
    try:
        response = table.query(
            KeyConditionExpression=boto3.dynamodb.conditions.Key("userId").eq(user_name)
        )
        items = response.get("Items", [])
        return items

    except ClientError as e:
        print(f"Error querying DynamoDB: {e.response['Error']['Message']}")
        raise


def mark_module_complete(user_name: str, module_name: str) -> None:
    """
    Convenience function to mark a module as completed.

    Args:
        user_name:   The user's name.
        module_name: The module they finished.
    """
    updated = update_module_progress(user_name, module_name, completed=True)
    print(f"Progress saved: {updated}")


# --- Example usage ---
if __name__ == "__main__":
    # Mark a module complete for a user
    mark_module_complete(user_name="khanh", module_name="Intro to AI")

    # Check all progress for a user
    records = get_user_progress("khanh")
    print("\nAll progress for khanh:")
    for record in records:
        print(f"  Module: {record['module']} | Progress: {record['progress']} | Last updated: {record['last_updated']}")
