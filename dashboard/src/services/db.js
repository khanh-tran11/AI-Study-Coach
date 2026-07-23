import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

// Configure client — reads from environment variables
const client = new DynamoDBClient({
  region: import.meta.env.VITE_AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID || '',
    secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY || '',
  },
});

const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = import.meta.env.VITE_DYNAMO_TABLE || 'LearnerProgress';

/**
 * Get all progress records for a specific learner.
 * Table key: PK = userId, SK = moduleId
 */
export async function getLearnerProgress(userId) {
  const command = new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'userId = :uid',
    ExpressionAttributeValues: { ':uid': userId },
  });
  const result = await docClient.send(command);
  return result.Items || [];
}

/**
 * Get all learner progress records for an educator (uses a GSI: educatorId-index).
 */
export async function getAllLearnersForEducator(educatorId) {
  const command = new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: 'educatorId-index',
    KeyConditionExpression: 'educatorId = :eid',
    ExpressionAttributeValues: { ':eid': educatorId },
  });
  const result = await docClient.send(command);
  return result.Items || [];
}

/**
 * Update step progress for a specific module.
 */
export async function updateStepProgress(userId, moduleId, step) {
  const command = new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { userId, moduleId },
    UpdateExpression: 'SET stepsCompleted = :step, lastActiveAt = :now',
    ExpressionAttributeValues: {
      ':step': step,
      ':now': new Date().toISOString(),
    },
  });
  await docClient.send(command);
}
