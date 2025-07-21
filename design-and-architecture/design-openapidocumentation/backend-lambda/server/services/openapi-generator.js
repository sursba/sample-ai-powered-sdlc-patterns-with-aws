// Core dependencies
const fs = require('fs');

// External dependencies
const { v4: uuidv4 } = require('uuid');
const yaml = require('js-yaml');

// AWS SDK dependencies
const { 
  BedrockAgentRuntimeClient, 
  InvokeAgentCommand 
} = require('@aws-sdk/client-bedrock-agent-runtime');
const { NodeHttpHandler } = require("@smithy/node-http-handler");

/**
 * Generate OpenAPI description using AWS Bedrock agent
 * @param {string} prompt - Description of the API to generate
 * @param {string} [outputPath='openapi-spec.json'] - Path to save the generated OpenAPI spec
 * @returns {object} Generated OpenAPI specification
 */

async function generateOpenAPI(prompt, outputPath = null) {
  try {
    const client = new BedrockAgentRuntimeClient({
      region: process.env.SERVER_REGION || process.env.AWS_REGION || 'eu-west-1',
      requestHandler: new NodeHttpHandler({
        connectionTimeout: 60000,
        socketTimeout: 300000
      })
    });

    const sessionId = uuidv4();
    const command = new InvokeAgentCommand({
      agentId: process.env.BEDROCK_AGENT_ID,
      agentAliasId: process.env.BEDROCK_AGENT_ALIAS_ID,
      sessionId: sessionId,
      inputText: JSON.stringify(prompt),
      enableTrace: true // Optional: for debugging
    });

    // Handle streaming response
    let aggregatedResponse = '';
    const response = await client.send(command);

    // Check if response is async iterable (streaming)
    if (response.completion && Symbol.asyncIterator in response.completion) {
      console.log("Processing streaming response...");
      
      for await (const chunk of response.completion) {
        if (chunk.chunk?.bytes) {
          const decodedChunk = Buffer.from(chunk.chunk.bytes).toString('utf-8');
          console.log(`Received chunk: ${decodedChunk.substring(0, 50)}...`);
          aggregatedResponse += decodedChunk;
        }
      }
    } else {
      // Handle non-streaming response (fallback)
      console.log("Received non-streaming response");
      aggregatedResponse = response.completion;
    }

    // Process the complete response
    return processCompletionContent(aggregatedResponse, outputPath);

  } catch (error) {
    console.error('Error generating OpenAPI spec:', error);
    throw error;
  }
}

/**
 * Process the completion content
 */
function processCompletionContent(completionContent, outputPath) {
  console.log(`Completion content length: ${completionContent.length}`);
  if (completionContent) {
    console.log(`First 200 chars: ${completionContent.substring(0, 200)}...`);
  }


  // Process the response content
  if (completionContent.trim()) {
    // First, check if it's a JSON response
    try {
      const responseBody = JSON.parse(completionContent);
      
      if (responseBody.openApiSpec) {
        const result = responseBody.openApiSpec;
        // Save the processed result if outputPath is provided
        if (outputPath) {
          fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
          console.log(`OpenAPI specification saved to ${outputPath}`);
        }
        return result;
      } else if (responseBody.raw_response) {
        // Process raw_response which might contain YAML
        const yamlContent = extractYamlOrJson(responseBody.raw_response);
        if (yamlContent) {
          const result = yamlToJson(yamlContent);
          if (outputPath) {
            fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
            console.log(`Converted YAML saved to ${outputPath}`);
          }
          return result;
        }
        return responseBody;
      } else {
        // If we have JSON but no openApiSpec, return the whole response
        console.log('No openApiSpec found in response, returning full response');
        if (outputPath) {
          fs.writeFileSync(outputPath, JSON.stringify(responseBody, null, 2));
          console.log(`Response saved to ${outputPath}`);
        }
        return responseBody;
      }
    } catch (error) {
      console.log('Failed to parse as JSON, trying to extract YAML or JSON from text');
      
      // Not valid JSON, check for YAML content
      const yamlContent = extractYamlOrJson(completionContent);
      
      if (yamlContent) {
        const result = yamlToJson(yamlContent);
        if (outputPath) {
          fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
          console.log(`Converted YAML saved to ${outputPath}`);
        }
        return result;
      }
      
      // Look for JSON-like patterns
      const jsonPattern = /\{[\s\S]*\}/;
      const match = completionContent.match(jsonPattern);
      if (match) {
        try {
          const potentialJson = match[0];
          const responseBody = JSON.parse(potentialJson);
          console.log("Found embedded JSON");
          if (outputPath) {
            fs.writeFileSync(outputPath, JSON.stringify(responseBody, null, 2));
          }
          return responseBody;
        } catch (error) {
          console.error("Error parsing embedded JSON:", error);
        }
      }
      
      // If all else fails, return the raw content
      console.log('Returning raw content');
      const result = { raw_response: completionContent };
      if (outputPath) {
        fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
        console.log(`Raw content saved to ${outputPath}`);
      }
      return result;
    }
  } else {
    console.log('Empty completion content');
    return { error: 'Empty response from Bedrock agent' };
  }
}

/**
 * Extract YAML or JSON content from markdown code blocks or plain text
 * @param {string} content - Content to extract from
 * @returns {string|null} Extracted YAML/JSON content or null
 */
function extractYamlOrJson(content) {
  // Try to extract content from markdown code blocks with backticks
  const codeBlockRegex = /```(?:yaml|json)?\n([\s\S]*?)\n```/;
  const codeBlockMatch = content.match(codeBlockRegex);
  
  if (codeBlockMatch && codeBlockMatch[1]) {
    return codeBlockMatch[1];
  }
  
  // Try to extract content from blocks with triple single quotes
  const singleQuoteRegex = /'''(?:yaml|json)?([^']*?)'''/;
  const singleQuoteMatch = content.match(singleQuoteRegex);
  
  if (singleQuoteMatch && singleQuoteMatch[1]) {
    return singleQuoteMatch[1];
  }
  
  // If no code blocks, look for OpenAPI-specific content
  if (content.trim().startsWith('openapi:')) {
    return content;
  }
  
  // Look for JSON content
  if (content.trim().startsWith('{')) {
    try {
      // Simple JSON extraction
      let braceCount = 0;
      let start = content.indexOf('{');
      
      if (start >= 0) {
        for (let i = start; i < content.length; i++) {
          if (content[i] === '{') {
            braceCount++;
          } else if (content[i] === '}') {
            braceCount--;
            if (braceCount === 0) {
              // Found complete JSON object
              return content.substring(start, i + 1);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error extracting JSON:', error);
    }
  }
  
  // Look for OpenAPI-like structure without explicit markers
  const openapiRegex = /(?:^|\n)\s*openapi:\s*[0-9.]+\s*(?:\n|$)/;
  const openapiMatch = content.match(openapiRegex);
  
  if (openapiMatch) {
    const start = openapiMatch.index;
    return content.substring(start);
  }
  
  return null;
}

/**
 * Convert YAML content to JSON
 * @param {string} yamlContent - YAML content to convert
 * @returns {object} Converted JSON object
 */
function yamlToJson(yamlContent) {
  try {
    // Parse YAML to JavaScript object
    return yaml.load(yamlContent);
  } catch (error) {
    console.error('Error converting YAML to JSON:', error);
    
    // If parsing fails, return a minimal valid OpenAPI spec
    return {
      openapi: '3.0.0',
      info: { title: 'Generated API', version: '1.0.0' },
      paths: {},
      _raw_yaml: yamlContent // Keep the raw content for debugging
    };
  }
}

module.exports = {
  generateOpenAPI
};