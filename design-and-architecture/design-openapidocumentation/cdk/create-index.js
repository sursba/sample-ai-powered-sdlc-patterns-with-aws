#!/usr/bin/env node

/**
 * Create OpenSearch Serverless Vector Index
 * JavaScript version of create_index.py
 */

const { fromNodeProviderChain } = require('@aws-sdk/credential-providers');
const { CloudFormationClient, DescribeStacksCommand } = require('@aws-sdk/client-cloudformation');
const { defaultProvider } = require('@aws-sdk/credential-provider-node');
const { HttpRequest } = require('@aws-sdk/protocol-http');
const { SignatureV4 } = require('@aws-sdk/signature-v4');
const { Sha256 } = require('@aws-crypto/sha256-js');
const https = require('https');
const { URL } = require('url');

// Configuration
const REGION = process.env.AWS_REGION || 'eu-west-1';
const INDEX_NAME = 'openapi-index';
const STACK_NAME = 'OpenSearchStack';

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Get OpenSearch collection endpoint from CloudFormation stack
 */
async function getCollectionEndpoint() {
  try {
    const cfClient = new CloudFormationClient({ region: REGION });
    const command = new DescribeStacksCommand({ StackName: STACK_NAME });
    const response = await cfClient.send(command);
    
    const stack = response.Stacks[0];
    const collectionArnOutput = stack.Outputs.find(output => output.OutputKey === 'CollectionArn');
    
    if (!collectionArnOutput) {
      throw new Error('CollectionArn output not found in CloudFormation stack');
    }
    
    // Extract collection ID from ARN: arn:aws:aoss:region:account:collection/collection-id
    const collectionArn = collectionArnOutput.OutputValue;
    const collectionId = collectionArn.split('/').pop();
    const endpoint = `${collectionId}.${REGION}.aoss.amazonaws.com`;
    
    log('blue', `Found OpenSearch collection endpoint: ${endpoint}`);
    return endpoint;
  } catch (error) {
    log('red', `Error getting collection endpoint: ${error.message}`);
    throw error;
  }
}

/**
 * Sign HTTP request for OpenSearch Serverless
 */
async function signRequest(request, credentials) {
  const signer = new SignatureV4({
    credentials,
    region: REGION,
    service: 'aoss',
    sha256: Sha256
  });
  
  return await signer.sign(request);
}

/**
 * Make HTTP request to OpenSearch
 */
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const response = {
            statusCode: res.statusCode,
            headers: res.headers,
            body: body ? JSON.parse(body) : null
          };
          resolve(response);
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body
          });
        }
      });
    });
    
    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

/**
 * Check if index exists
 */
async function indexExists(endpoint, credentials) {
  try {
    const url = new URL(`https://${endpoint}/${INDEX_NAME}`);
    
    const request = new HttpRequest({
      method: 'HEAD',
      hostname: url.hostname,
      path: url.pathname,
      headers: {
        'Content-Type': 'application/json',
        'Host': url.hostname
      }
    });
    
    const signedRequest = await signRequest(request, credentials);
    
    const options = {
      hostname: signedRequest.hostname,
      path: signedRequest.path,
      method: signedRequest.method,
      headers: signedRequest.headers
    };
    
    const response = await makeRequest(options);
    return response.statusCode === 200;
  } catch (error) {
    log('yellow', `Error checking index existence: ${error.message}`);
    return false;
  }
}

/**
 * Delete index if it exists
 */
async function deleteIndex(endpoint, credentials) {
  try {
    const url = new URL(`https://${endpoint}/${INDEX_NAME}`);
    
    const request = new HttpRequest({
      method: 'DELETE',
      hostname: url.hostname,
      path: url.pathname,
      headers: {
        'Content-Type': 'application/json',
        'Host': url.hostname
      }
    });
    
    const signedRequest = await signRequest(request, credentials);
    
    const options = {
      hostname: signedRequest.hostname,
      path: signedRequest.path,
      method: signedRequest.method,
      headers: signedRequest.headers
    };
    
    const response = await makeRequest(options);
    
    if (response.statusCode === 200) {
      log('green', `Deleted existing index: ${INDEX_NAME}`);
      return true;
    } else {
      log('yellow', `Could not delete index (status: ${response.statusCode})`);
      return false;
    }
  } catch (error) {
    log('yellow', `Error deleting index: ${error.message}`);
    return false;
  }
}

/**
 * Create vector index
 */
async function createIndex(endpoint, credentials) {
  try {
    const indexBody = {
      settings: {
        index: {
          knn: true,
          'knn.algo_param.ef_search': 512
        }
      },
      mappings: {
        properties: {
          vector: {
            type: 'knn_vector',
            dimension: 1024,
            method: {
              name: 'hnsw',
              space_type: 'l2',
              engine: 'faiss'
            }
          },
          text: {
            type: 'text'
          },
          metadata: {
            type: 'text'
          }
        }
      }
    };
    
    const url = new URL(`https://${endpoint}/${INDEX_NAME}`);
    
    const request = new HttpRequest({
      method: 'PUT',
      hostname: url.hostname,
      path: url.pathname,
      headers: {
        'Content-Type': 'application/json',
        'Host': url.hostname
      },
      body: JSON.stringify(indexBody)
    });
    
    const signedRequest = await signRequest(request, credentials);
    
    const options = {
      hostname: signedRequest.hostname,
      path: signedRequest.path,
      method: signedRequest.method,
      headers: signedRequest.headers
    };
    
    const response = await makeRequest(options, indexBody);
    
    if (response.statusCode === 200 || response.statusCode === 201) {
      log('green', `✅ Index created successfully: ${INDEX_NAME}`);
      log('blue', `Response: ${JSON.stringify(response.body, null, 2)}`);
      return true;
    } else {
      log('red', `❌ Failed to create index (status: ${response.statusCode})`);
      log('red', `Response: ${JSON.stringify(response.body, null, 2)}`);
      return false;
    }
  } catch (error) {
    log('red', `❌ Error creating index: ${error.message}`);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    log('blue', '🔍 Creating OpenSearch Serverless Vector Index...');
    log('blue', '================================================');
    
    // Get AWS credentials
    log('blue', '📋 Getting AWS credentials...');
    const credentials = await defaultProvider()();
    
    // Get collection endpoint
    log('blue', '🔗 Getting OpenSearch collection endpoint...');
    const endpoint = await getCollectionEndpoint();
    
    // Check if index exists
    log('blue', '🔍 Checking if index exists...');
    const exists = await indexExists(endpoint, credentials);
    
    if (exists) {
      log('yellow', `⚠️  Index ${INDEX_NAME} already exists, deleting it...`);
      await deleteIndex(endpoint, credentials);
      // Wait a moment for deletion to complete
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Create the index
    log('blue', '🏗️  Creating vector index...');
    const success = await createIndex(endpoint, credentials);
    
    if (success) {
      log('green', '🎉 Vector index created successfully!');
      log('blue', '================================================');
      log('blue', `Index Name: ${INDEX_NAME}`);
      log('blue', `Endpoint: ${endpoint}`);
      log('blue', `Vector Dimension: 1024 (for Titan Embedding)`);
      log('blue', `Engine: FAISS with HNSW algorithm`);
      log('blue', '================================================');
    } else {
      log('red', '❌ Failed to create vector index');
      process.exit(1);
    }
    
  } catch (error) {
    log('red', `❌ Error: ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  createVectorIndex: main,
  getCollectionEndpoint,
  indexExists,
  deleteIndex,
  createIndex
};