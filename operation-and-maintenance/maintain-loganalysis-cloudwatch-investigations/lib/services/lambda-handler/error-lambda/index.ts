import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import * as AWSXRay from 'aws-xray-sdk-core';


// Instrument DynamoDB client with X-Ray
const ddbClient = AWSXRay.captureAWSv3Client(new DynamoDBClient({}));
const dynamodb = DynamoDBDocumentClient.from(ddbClient);
const TABLE_NAME = process.env.TABLE_NAME;
const RECORD_ID_PREFIX = 'throttle-read-test';

async function logWithContext(message: string, error: Error | null = null) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    lambdaName: process.env.LAMBDA_NAME,
    message: message,
    ...(error && {
      errorType: error.name,
      errorMessage: error.message,
      stackTrace: error.stack
    })
  };
  console.log(JSON.stringify(logEntry));
}

async function simulateError() {
  const id = Date.now().toString();
  
  try {
    switch (process.env.ERROR_CODE) {
      //memory error simulation in lambda 
      case 'WRITE-THROTTLING': // Write throttling simulation
        const items = Array(100).fill(null).map((_, i) => ({
          PutRequest: {
            Item: { id: `${id}-${i}`, data: 'x'.repeat(100000) }
          }
        }));
        
        await Promise.all(items.map(item => 
          dynamodb.send(new PutCommand({ TableName: TABLE_NAME, Item: item.PutRequest.Item }))
        ));
        const writeError = new Error('Critical: unable to write');
        writeError.name = 'WriteError';
        throw writeError;
        
      case 'READ-THROTTLING':
        const readItems = Array.from({ length: 100 }, (_, i) => `${RECORD_ID_PREFIX}-${i}`)
        await Promise.all(readItems.map(id =>
          dynamodb.send(new GetCommand({ TableName: TABLE_NAME, Key: { id }}))
        ));
        const readError = new Error('Critical: Unable to read');
        readError.name = 'ReadError';
        throw readError;        
    }
  } catch (error) {
    await logWithContext('Operation failed', error as Error);
    throw error;
  }
}

export const handler = async function(event: any, context: any) {
  await logWithContext('Lambda execution started');
  
  try {
    await simulateError();
    } catch (error) {
    throw error;
  }
}