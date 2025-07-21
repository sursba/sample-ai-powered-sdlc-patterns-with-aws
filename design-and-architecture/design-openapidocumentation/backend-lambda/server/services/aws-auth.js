// AWS SDK dependencies
const { SignatureV4 } = require('@aws-sdk/signature-v4');
const { HttpRequest } = require('@aws-sdk/protocol-http');
const { defaultProvider } = require('@aws-sdk/credential-provider-node');
const { Hash } = require('@aws-sdk/hash-node');

// External dependencies
const axios = require('axios');

/**
 * Create a signed request to AWS API Gateway
 * @param {string} url - The API Gateway URL
 * @param {string} method - The HTTP method (GET, POST, etc.)
 * @param {object} body - The request body
 * @param {string} region - The AWS region
 * @returns {Promise<object>} - The signed request config for axios
 */
async function createSignedRequest(url, method, body, region = 'eu-north-1') {
    console.log(`Creating signed request to ${url}`);

    const urlObj = new URL(url);

    // Create a request object
    const request = new HttpRequest({
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method,
        headers: {
            'Content-Type': 'application/json',
            'host': urlObj.hostname
        },
        body: JSON.stringify(body)
    });

    // Create a signer
    const signer = new SignatureV4({
        credentials: defaultProvider(),
        region,
        service: 'execute-api',
        sha256: Hash.bind(null, 'sha256')
    });

    // Sign the request
    const signedRequest = await signer.sign(request);

    // Convert to axios config
    return {
        url,
        method,
        headers: signedRequest.headers,
        data: body
    };
}

/**
 * Send a signed request to AWS API Gateway
 * @param {string} url - The API Gateway URL
 * @param {string} method - The HTTP method (GET, POST, etc.)
 * @param {object} body - The request body
 * @param {string} region - The AWS region
 * @returns {Promise<object>} - The response data
 */
async function sendSignedRequest(url, method, body, region = 'eu-north-1') {
    try {
        const requestConfig = await createSignedRequest(url, method, body, region);
        console.log('Sending signed request with headers:', Object.keys(requestConfig.headers).join(', '));

        // Increase timeout to 120 seconds (120000ms)
        requestConfig.timeout = 120000;

        const response = await axios(requestConfig);
        return response.data;
    } catch (error) {
        console.error('Error sending signed request:', error.message);

        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);

            // Handle specific error cases
            if (error.response.status === 504) {
                return {
                    success: false,
                    error: 'The request timed out. The Lambda function is taking too long to process your request. Try with a smaller input or check the Lambda function configuration.'
                };
            }
        }

        throw error;
    }
}

module.exports = { createSignedRequest, sendSignedRequest };