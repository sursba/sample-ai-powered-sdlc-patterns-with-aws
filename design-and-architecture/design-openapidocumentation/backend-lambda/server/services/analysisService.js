// Internal services
const UnifiedLambdaClient = require('./unified-lambda-client');
const { invokeLambda } = require('./unified-lambda-client');

// Initialize the Unified Lambda client with the Lambda ARN
const domainAnalyzerLambda = new UnifiedLambdaClient({
  lambdaArn: process.env.DOMAIN_ANALYZER_FUNCTION_ARN || process.env.DOMAIN_ANALYZER_LAMBDA_ARN,
  region: process.env.SERVER_REGION || process.env.AWS_REGION || 'eu-west-1',
  invocationType: 'direct'
});

// Generate bounded contexts from text prompt
const generateBoundedContexts = async (prompt) => {
  return await domainAnalyzerLambda.generateBoundedContexts(prompt);
};

// Analyze domain model from image
const analyzeDomainModel = async (imageBuffer, analysisType, prompt, sessionId = null) => {
  return await domainAnalyzerLambda.analyzeDomainModel(imageBuffer, analysisType, prompt, sessionId);
};

// Process image analysis result to ensure proper structure
const processImageAnalysisResult = (analysisResult) => {
  let processedResult = { ...analysisResult };
  
  // Check if the result is wrapped in a body property
  if (analysisResult.body && !analysisResult.domainAnalysis) {
    try {
      const parsedBody = typeof analysisResult.body === 'string' ? 
        JSON.parse(analysisResult.body) : analysisResult.body;
      
      if (parsedBody.domainAnalysis || parsedBody.boundedContextAnalysis) {
        processedResult = { ...parsedBody, success: true };
      }
    } catch (parseError) {
      // Check if the body itself is the domain analysis text
      if (typeof analysisResult.body === 'string' && 
          (analysisResult.body.includes('# Domain Model Analysis') || 
           analysisResult.body.includes('## ENTITIES'))) {
        processedResult = {
          success: true,
          domainAnalysis: analysisResult.body,
          format: 'plain-text'
        };
      }
    }
  }
  
  // Check if the result itself is the domain analysis
  if (!processedResult.domainAnalysis && !processedResult.boundedContextAnalysis) {
    const responseStr = JSON.stringify(analysisResult);
    if (responseStr.includes('# Domain Model Analysis') || responseStr.includes('## ENTITIES')) {
      const match = responseStr.match(/"(# Domain Model Analysis[\s\S]*?)"(?:,|\}|$)/);
      if (match && match[1]) {
        processedResult = {
          success: true,
          domainAnalysis: match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"'),
          format: 'extracted-text'
        };
      }
    }
  }
  
  // If we still don't have domain analysis, check if the statusCode and body structure
  if (!processedResult.domainAnalysis && analysisResult.statusCode && analysisResult.body) {
    if (typeof analysisResult.body === 'string') {
      try {
        const bodyObj = JSON.parse(analysisResult.body);
        if (bodyObj.domainAnalysis) {
          processedResult = {
            success: true,
            domainAnalysis: bodyObj.domainAnalysis,
            imageS3Key: bodyObj.imageS3Key,
            analysisS3Key: bodyObj.analysisS3Key
          };
        }
      } catch (e) {
        // Error parsing body as JSON - continue with other processing
      }
    }
  }
  
  return processedResult;
};

// Extract analysis content from various result formats
const extractAnalysisContent = (latestAnalysisResult) => {
  let content = '';
  
  // Check for nested structure in case the response is wrapped
  if (latestAnalysisResult.body) {
    try {
      // If body is a string, try to parse it as JSON
      if (typeof latestAnalysisResult.body === 'string') {
        // Check if the body itself is the domain analysis
        if (latestAnalysisResult.body.includes('# Domain Model Analysis') || 
            latestAnalysisResult.body.includes('## ENTITIES')) {
          content = latestAnalysisResult.body;
        } else {
          // Try to parse as JSON
          try {
            const parsedBody = JSON.parse(latestAnalysisResult.body);
            
            if (parsedBody.domainAnalysis) {
              content = parsedBody.domainAnalysis;
            } else if (parsedBody.boundedContextAnalysis) {
              content = parsedBody.boundedContextAnalysis;
            }
          } catch (jsonError) {
            // Error parsing body as JSON
          }
        }
      } else {
        // Body is an object
        const parsedBody = latestAnalysisResult.body;
        
        if (parsedBody.domainAnalysis) {
          content = parsedBody.domainAnalysis;
        } else if (parsedBody.boundedContextAnalysis) {
          content = parsedBody.boundedContextAnalysis;
        }
      }
    } catch (parseError) {
      // Error processing body
    }
  }
  
  // If we didn't find content in a nested structure, check the top level
  if (!content) {
    if (latestAnalysisResult.domainAnalysis) {
      content = latestAnalysisResult.domainAnalysis;
    } else if (latestAnalysisResult.boundedContextAnalysis) {
      content = latestAnalysisResult.boundedContextAnalysis;
    } else if (latestAnalysisResult.analysisResult && latestAnalysisResult.analysisResult.domainAnalysis) {
      content = latestAnalysisResult.analysisResult.domainAnalysis;
    }
  }
  
  // If we still don't have content, check if the entire result is a string
  if (!content && typeof latestAnalysisResult === 'string') {
    content = latestAnalysisResult;
  }
  
  // If we still don't have content, try to extract it from the stringified result
  if (!content) {
    const resultStr = JSON.stringify(latestAnalysisResult);
    if (resultStr.includes('# Domain Model Analysis') || resultStr.includes('## ENTITIES')) {
      const match = resultStr.match(/"(# Domain Model Analysis[\s\S]*?)"(?:,|\}|$)/);
      if (match && match[1]) {
        content = match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
      }
    }
  }

  return content;
};

// Generate business contexts with timeout handling
const generateBusinessContextsWithTimeout = async (domainAnalysis, context = {}) => {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error('Request timed out after 45 seconds'));
    }, 45000);
  });
  
  // Create payload with context information
  const payload = {
    analysisType: 'bounded',
    domainAnalysis: domainAnalysis,
    context: {
      projectName: context.projectName
    }
  };
  
  const lambdaPromise = domainAnalyzerLambda.invoke(payload);
  
  return await Promise.race([lambdaPromise, timeoutPromise])
    .catch(error => {
      if (error.message.includes('timed out')) {
        return {
          success: false,
          error: 'The business context generation is taking too long. Try with a simpler domain model or check the Lambda function configuration.',
          businessContextAnalysis: 'The analysis timed out. Please try again with a simpler domain model.'
        };
      }
      throw error;
    });
};

// Generate ASCII diagram with timeout handling
const generateAsciiDiagramWithTimeout = async (domainAnalysis, businessContext) => {
  let combinedInput = '';
  
  if (domainAnalysis && businessContext) {
    combinedInput = `# Domain Model Analysis

${domainAnalysis}

# Business Context Analysis

${businessContext}

Please create an ASCII diagram that shows both the domain entities and their organization into business contexts.`;
  } else if (businessContext) {
    combinedInput = `# Business Context Analysis

${businessContext}

Please create an ASCII diagram that shows the business contexts and their relationships.`;
  } else {
    combinedInput = `# Domain Model Analysis

${domainAnalysis}

Please create an ASCII diagram that shows the domain entities and their relationships.`;
  }
  
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error('Request timed out after 45 seconds'));
    }, 45000);
  });
  
  const lambdaPromise = invokeLambda(
    process.env.DOMAIN_ANALYZER_FUNCTION_ARN || process.env.DOMAIN_ANALYZER_LAMBDA_ARN,
    {
      analysisType: 'ascii',
      prompt: combinedInput
    },
    process.env.SERVER_REGION || process.env.AWS_REGION || 'eu-west-1'
  );
  
  return await Promise.race([lambdaPromise, timeoutPromise])
    .catch(error => {
      if (error.message.includes('timed out')) {
        return {
          success: false,
          error: 'The ASCII diagram generation is taking too long. Try with a simpler domain model or check the Lambda function configuration.',
          retryable: true
        };
      }
      throw error;
    });
};

// Process ASCII diagram result to extract diagram content
const processAsciiDiagramResult = (result) => {
  let processedResult = result;
  
  // If the result has a body property, try to extract the actual response
  if (result?.body && !result.asciiDiagram) {
    try {
      const bodyContent = typeof result.body === 'string' ? JSON.parse(result.body) : result.body;
      
      // Check if there's a nested body structure
      if (bodyContent.body && !bodyContent.asciiDiagram) {
        try {
          const nestedBodyContent = typeof bodyContent.body === 'string' ? JSON.parse(bodyContent.body) : bodyContent.body;
          
          if (nestedBodyContent.asciiDiagram || nestedBodyContent.success !== undefined) {
            processedResult = nestedBodyContent;
          }
        } catch (nestedParseError) {
          // Check if the nested body itself is the ASCII diagram
          if (typeof bodyContent.body === 'string' && (bodyContent.body.includes('┌') || bodyContent.body.includes('│') || bodyContent.body.includes('└'))) {
            processedResult = {
              success: true,
              asciiDiagram: bodyContent.body
            };
          }
        }
      } else if (bodyContent.asciiDiagram || bodyContent.success !== undefined) {
        processedResult = bodyContent;
      }
    } catch (parseError) {
      // Check if the body itself is the ASCII diagram
      if (typeof result.body === 'string' && (result.body.includes('┌') || result.body.includes('│') || result.body.includes('└'))) {
        processedResult = {
          success: true,
          asciiDiagram: result.body
        };
      }
    }
  }
  
  // Check if we have an ASCII diagram
  if (!processedResult.asciiDiagram) {
    // Use the helper function to search for ASCII diagram anywhere in the response
    const foundDiagram = findAsciiDiagram(result);
    
    if (foundDiagram) {
      processedResult = {
        success: true,
        asciiDiagram: foundDiagram
      };
    }
  }
  
  return processedResult;
};

// Helper function to recursively search for ASCII diagram in nested objects
const findAsciiDiagram = (obj, depth = 0) => {
  if (depth > 5) return null; // Prevent infinite recursion
  
  if (typeof obj === 'string') {
    // Check if this string contains ASCII diagram patterns
    const asciiPatterns = ['┌', '│', '└', '┐', '┘', '├', '┤', '┬', '┴', '┼'];
    if (asciiPatterns.some(pattern => obj.includes(pattern)) && obj.length > 50) {
      return obj;
    }
  } else if (typeof obj === 'object' && obj !== null) {
    // Check common property names first
    const commonProps = ['asciiDiagram', 'ascii_diagram', 'diagram', 'content', 'result', 'output'];
    for (const prop of commonProps) {
      if (obj[prop] && typeof obj[prop] === 'string') {
        const diagram = findAsciiDiagram(obj[prop], depth + 1);
        if (diagram) return diagram;
      }
    }
    
    // Then check all properties
    for (const [key, value] of Object.entries(obj)) {
      const diagram = findAsciiDiagram(value, depth + 1);
      if (diagram) return diagram;
    }
  }
  
  return null;
};

module.exports = {
  generateBoundedContexts,
  analyzeDomainModel,
  processImageAnalysisResult,
  extractAnalysisContent,
  generateBusinessContextsWithTimeout,
  generateAsciiDiagramWithTimeout,
  processAsciiDiagramResult
};