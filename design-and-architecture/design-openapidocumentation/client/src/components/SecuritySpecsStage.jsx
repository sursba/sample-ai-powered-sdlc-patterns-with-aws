import React, { useState, useEffect, Component } from 'react';
import apiClient from '../services/apiClient';
import SimpleSecurityTab from './SimpleSecurityTab';
import SimplePoliciesTab from './SimplePoliciesTab';
import SimpleDocumentationTab from './SimpleDocumentationTab';
import SimpleVersioningTab from './SimpleVersioningTab';

// Error Boundary component to catch rendering errors
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-700">Something went wrong.</p>
          <p className="text-sm text-red-600 mt-2">{this.state.error?.message || 'Unknown error'}</p>
        </div>
      );
    }

    return this.props.children;
  }
}



export default function SecuritySpecsStage({
  specId,
  openApiSpec,
  securitySpecs,
  setSecuritySpecs,
  generatingSecuritySpecs,
  onGenerateSecuritySpecs,
  onPrevious,
  analysisResult,
  domainDescription,
  boundedContexts,
  asciiDiagram
}) {
  const [documentation, setDocumentation] = useState(null);
  const [generatingDocs, setGeneratingDocs] = useState(false);
  const [docsError, setDocsError] = useState(null);
  const [fetchedOpenApiSpec, setFetchedOpenApiSpec] = useState(null);
  const [activeTab, setActiveTab] = useState('security'); // Default to security tab
  const [downloadingJson, setDownloadingJson] = useState(false);
  const [downloadingMarkdown, setDownloadingMarkdown] = useState(false);
  const [securityOptions, setSecurityOptions] = useState({
    oauth2: false,
    apiKey: true,
    basic: false,
    jwt: true,
    rateLimit: true,
    cors: true
  });

  const handleOptionChange = (option) => {
    setSecurityOptions({
      ...securityOptions,
      [option]: !securityOptions[option]
    });
  };

  // Function to load existing documentation from S3 on component mount
  const loadExistingDocumentation = async () => {
    if (!specId) return;
    
    try {
      console.log('Attempting to load existing documentation for spec:', specId);
      
      // Try to fetch existing documentation without regenerating
      const response = await apiClient.get(`/api/documentation/${specId}`);
      
      if (response && response.documentation) {
        console.log('Found existing documentation in S3');
        setDocumentation(response.documentation);
      } else {
        console.log('No existing documentation found in S3');
      }
    } catch (error) {
      // If documentation doesn't exist, that's fine - user can generate it
      if (error.status === 404) {
        console.log('No existing documentation found (404) - user can generate new documentation');
      } else {
        console.error('Error loading existing documentation:', error);
      }
    }
  };

  // Load existing documentation when component mounts or specId changes
  useEffect(() => {
    loadExistingDocumentation();
  }, [specId]);
  // Function to fetch the OpenAPI specification
  const fetchOpenApiSpec = async () => {
    if (!specId) return null;
    
    try {
      const response = await apiClient.get(`/api/openapi/${specId}`);
      setFetchedOpenApiSpec(response);
      return response;
    } catch (error) {
      console.error('Error fetching OpenAPI spec:', error);
      return null;
    }
  };

  // Function to fetch documentation from S3 (for downloads)
  const fetchDocumentationFromS3 = async () => {
    if (!specId) return null;
    
    try {
      // Try to get the latest documentation from the backend
      const response = await apiClient.post('/api/generate-documentation', { 
        specId,
        openApiSpec: openApiSpec
      });
      
      if (response && response.documentation) {
        return response.documentation;
      }
      
      // Fallback to current documentation state
      return documentation;
    } catch (error) {
      console.error('Error fetching documentation from S3:', error);
      // Fallback to current documentation state
      return documentation;
    }
  };

  // Function to generate comprehensive documentation using the Lambda
  const generateDocumentation = async () => {
    if (!specId) {
      setDocsError('Specification ID is required');
      return;
    }

    setGeneratingDocs(true);
    setDocsError(null);

    try {
      const response = await apiClient.post('/api/generate-documentation', { 
        specId,
        openApiSpec: openApiSpec
      });

      // Process the response

      if (response) {
        // The server returns the documentation in a property called 'documentation'
        const docData = response.documentation || response;

        
        // Ensure we have a valid object to work with
        if (typeof docData === 'object' && docData !== null) {
          // If there's no parsed_json property, create one to maintain consistent structure
          if (!docData.parsed_json && (docData.securityDefinitions || docData.policies || 
              docData.documentation || docData.versioning)) {
            docData.parsed_json = {
              securityDefinitions: docData.securityDefinitions || {},
              policies: docData.policies || {},
              documentation: docData.documentation || {},
              versioning: docData.versioning || {}
            };
          }
          
          // Fix nested result structure if needed
          if (docData.parsed_json) {
            // Handle nested security definitions
            if (docData.parsed_json.securityDefinitions && 
                typeof docData.parsed_json.securityDefinitions === 'object' &&
                docData.parsed_json.securityDefinitions.result && 
                docData.parsed_json.securityDefinitions.result.securityDefinitions) {
              docData.parsed_json.securityDefinitions = docData.parsed_json.securityDefinitions.result.securityDefinitions;

            }
            
            // Handle nested policies
            if (docData.parsed_json.policies && 
                typeof docData.parsed_json.policies === 'object' &&
                docData.parsed_json.policies.result && 
                docData.parsed_json.policies.result.policies) {
              docData.parsed_json.policies = docData.parsed_json.policies.result.policies;

            }
            
            // Handle nested documentation
            if (docData.parsed_json.documentation && 
                typeof docData.parsed_json.documentation === 'object' &&
                docData.parsed_json.documentation.result && 
                docData.parsed_json.documentation.result.documentation) {
              docData.parsed_json.documentation = docData.parsed_json.documentation.result.documentation;

            }
            
            // Handle nested versioning
            if (docData.parsed_json.versioning && 
                typeof docData.parsed_json.versioning === 'object' &&
                docData.parsed_json.versioning.result && 
                docData.parsed_json.versioning.result.versioning) {
              docData.parsed_json.versioning = docData.parsed_json.versioning.result.versioning;

            }
          }
          
          setDocumentation(docData);
          
          // Show a warning if using fallback documentation
          if (docData.fallback) {

          }
          
          // Check for Lambda errors
          if (!docData.success || docData.parsed_json?.error) {
            const errorMessage = docData.parsed_json?.error || docData.error || 'Some Lambda functions failed';

            setDocsError(`Warning: ${errorMessage}. Some documentation sections may be incomplete.`);
          }
        } else {

          setDocsError('Failed to generate documentation - invalid response format');
        }
      } else {
        setDocsError('Failed to generate documentation - empty response');
      }
    } catch (error) {

      setDocsError(error.response?.data?.error || error.message || 'An error occurred');
      
      // Set a fallback documentation object to prevent UI from breaking
      setDocumentation({
        success: false,
        error: error.response?.data?.error || error.message || 'An error occurred',
        fallback: true,
        parsed_json: {
          securityDefinitions: {},
          policies: {},
          documentation: {},
          versioning: {}
        }
      });
    } finally {
      setGeneratingDocs(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-bold mb-4">Security & Additional Specifications</h2>

      <div className="mb-6">
        <p className="text-gray-600 mb-4">
          Enhance your API with security features and additional specifications.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="border border-gray-200 rounded-md p-4">
            <h3 className="font-semibold mb-3">Authentication & Authorization</h3>

            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="form-checkbox h-5 w-5 text-primary"
                  checked={securityOptions.oauth2}
                  onChange={() => handleOptionChange('oauth2')}
                />
                <span className="ml-2">OAuth 2.0</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="form-checkbox h-5 w-5 text-primary"
                  checked={securityOptions.apiKey}
                  onChange={() => handleOptionChange('apiKey')}
                />
                <span className="ml-2">API Key</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="form-checkbox h-5 w-5 text-primary"
                  checked={securityOptions.basic}
                  onChange={() => handleOptionChange('basic')}
                />
                <span className="ml-2">Basic Authentication</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="form-checkbox h-5 w-5 text-primary"
                  checked={securityOptions.jwt}
                  onChange={() => handleOptionChange('jwt')}
                />
                <span className="ml-2">JWT Token</span>
              </label>
            </div>
          </div>

          <div className="border border-gray-200 rounded-md p-4">
            <h3 className="font-semibold mb-3">API Protection & Policies</h3>

            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="form-checkbox h-5 w-5 text-primary"
                  checked={securityOptions.rateLimit}
                  onChange={() => handleOptionChange('rateLimit')}
                />
                <span className="ml-2">Rate Limiting</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="form-checkbox h-5 w-5 text-primary"
                  checked={securityOptions.cors}
                  onChange={() => handleOptionChange('cors')}
                />
                <span className="ml-2">CORS Policy</span>
              </label>
            </div>
          </div>
        </div>

        <button
          onClick={() => onGenerateSecuritySpecs(securityOptions)}
          className="w-full bg-primary text-white py-3 rounded-md font-bold hover:bg-primary-dark disabled:opacity-50 mb-4"
          disabled={generatingSecuritySpecs}
        >
          {generatingSecuritySpecs ? 'Generating Security Specs...' : 'Generate Security Specifications'}
        </button>

        {securitySpecs && (
          <div className="mt-6">
            <h3 className="font-semibold mb-2">Generated Security Specifications</h3>
            <div className="border border-gray-300 rounded-md p-3 h-64 overflow-auto bg-gray-50">
              <pre className="whitespace-pre-wrap font-mono text-sm">
                {JSON.stringify(securitySpecs, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* Comprehensive Documentation Section */}
      <div className="mt-8 border-t pt-6">
        <h3 className="text-xl font-bold mb-4">Comprehensive API Documentation</h3>
        <p className="text-gray-600 mb-4">
          Generate detailed API documentation including security definitions, policies, and versioning strategies.
        </p>

        <button
          onClick={generateDocumentation}
          className="w-full bg-secondary text-white py-3 rounded-md font-bold hover:bg-secondary-dark disabled:opacity-50 mb-4"
          disabled={generatingDocs}
        >
          {generatingDocs ? (
            <div className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Generating Documentation...
            </div>
          ) : 'Generate Comprehensive Documentation'}
        </button>

        {generatingDocs && (
          <div className="mb-4 bg-blue-50 p-3 rounded-md border border-blue-200">
            <div className="text-sm font-medium text-blue-700 mb-2">Generating Documentation</div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div className="bg-blue-600 h-2.5 rounded-full animate-pulse" style={{ width: '100%' }}></div>
            </div>
            <div className="text-xs text-gray-500 mt-2">This may take a minute as we process your API specification...</div>
          </div>
        )}

        {docsError && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <p className="font-bold">Error</p>
            <p>{docsError}</p>
            {docsError.includes('JSONDecodeError') && (
              <div className="mt-2">
                <p className="font-semibold">Possible Solutions:</p>
                <ul className="list-disc pl-5 mt-1">
                  <li>Check if your OpenAPI specification is valid JSON</li>
                  <li>Ensure there are no unterminated strings in your specification</li>
                  <li>Try simplifying complex parts of your API specification</li>
                  <li>Check for special characters that might need escaping</li>
                </ul>
              </div>
            )}
          </div>
        )}

        {documentation && (
          <div className="mt-4">
            <h4 className="font-semibold mb-2">Generated Documentation</h4>
            {documentation.fallback && (
              <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
                <p className="font-bold">Note</p>
                <p>Using locally generated documentation. This provides comprehensive security recommendations based on your API specification.</p>
                {documentation.error && (
                  <div>
                    <p className="mt-2 text-sm">Reason: {documentation.error}</p>
                    {documentation.error.includes('ThrottlingException') && (
                      <p className="mt-1 text-sm">The AI service is currently rate limited. The local documentation generator is providing equivalent functionality.</p>
                    )}
                  </div>
                )}
              </div>
            )}
            {documentation.parsed_json && documentation.parsed_json.error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                <p className="font-bold">Lambda Error</p>
                <p>{documentation.parsed_json.error}</p>
                <p className="mt-2 text-sm">Type: {documentation.parsed_json.type || 'Unknown'}</p>
                <p className="mt-1 text-sm">Some Lambda functions failed to process the request. The documentation may be incomplete.</p>
              </div>
            )}

            {/* Display documentation in a more structured way with tabs */}
            <div className="border border-gray-300 rounded-md p-3 bg-gray-50">
              {/* Tab navigation */}
              <div className="flex border-b mb-4">
                <button
                  onClick={() => setActiveTab('security')}
                  className={`px-4 py-2 font-medium ${activeTab === 'security' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
                >
                  Security
                </button>
                <button
                  onClick={() => setActiveTab('policies')}
                  className={`px-4 py-2 font-medium ${activeTab === 'policies' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
                >
                  Policies
                </button>
                <button
                  onClick={() => setActiveTab('documentation')}
                  className={`px-4 py-2 font-medium ${activeTab === 'documentation' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
                >
                  Documentation
                </button>
                <button
                  onClick={() => setActiveTab('versioning')}
                  className={`px-4 py-2 font-medium ${activeTab === 'versioning' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
                >
                  Versioning
                </button>
              </div>

              {/* Summary section */}
              <div className="mb-4 bg-blue-50 p-3 rounded-md border border-blue-200">
                <h5 className="font-bold text-blue-700 mb-2">API Documentation Summary</h5>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium">Security Schemes</div>
                    <div className="text-sm text-gray-600">
                      {documentation.parsed_json?.securityDefinitions?.securityDefinitions?.schemes ?
                        (Array.isArray(documentation.parsed_json.securityDefinitions.securityDefinitions.schemes) ?
                          documentation.parsed_json.securityDefinitions.securityDefinitions.schemes.length + ' defined' :
                          Object.keys(documentation.parsed_json.securityDefinitions.securityDefinitions.schemes).length + ' defined') :
                        documentation.parsed_json?.securityDefinitions?.schemes ?
                          (Array.isArray(documentation.parsed_json.securityDefinitions.schemes) ?
                            documentation.parsed_json.securityDefinitions.schemes.length + ' defined' :
                            Object.keys(documentation.parsed_json.securityDefinitions.schemes).length + ' defined') :
                          'None defined'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium">Endpoints Documented</div>
                    <div className="text-sm text-gray-600">
                      {documentation.parsed_json?.documentation ?
                        (typeof documentation.parsed_json.documentation === 'object' ?
                          Object.keys(documentation.parsed_json.documentation).length : 'Available') :
                        documentation.documentation ?
                          (typeof documentation.documentation === 'object' ?
                            Object.keys(documentation.documentation).length : 'Available') :
                          'None'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium">Versioning Strategy</div>
                    <div className="text-sm text-gray-600">
                      {documentation.parsed_json?.versioning?.versioning?.recommendedApproach ||
                        documentation.parsed_json?.versioning?.recommended_approach ||
                        documentation.parsed_json?.versioning?.strategy ||
                        documentation.versioning?.strategy ||
                        'Not specified'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium">Generated</div>
                    <div className="text-sm text-gray-600">{new Date().toLocaleString()}</div>
                  </div>
                </div>
              </div>

              {/* Tab content */}
              <div className="h-96 overflow-auto">
                {documentation ? (
                  <>
                    
                    {/* Security Definitions Tab */}
                    {activeTab === 'security' && (
                      <div className="error-boundary">
                        <ErrorBoundary fallback={<div className="p-4 bg-red-50 border border-red-200 rounded-md">
                          <p className="text-red-700">Error rendering security tab.</p>
                          <p className="text-sm text-red-600 mt-2">There might be an issue with the security data format.</p>
                        </div>}>
                          <SimpleSecurityTab documentation={documentation} />
                        </ErrorBoundary>
                      </div>
                    )}

                    {/* Policies Tab */}
                    {activeTab === 'policies' && (
                      <div className="error-boundary">
                        <ErrorBoundary fallback={<div className="p-4 bg-red-50 border border-red-200 rounded-md">
                          <p className="text-red-700">Error rendering policies tab.</p>
                          <p className="text-sm text-red-600 mt-2">There might be an issue with the policies data format.</p>
                        </div>}>
                          <SimplePoliciesTab documentation={documentation} />
                        </ErrorBoundary>
                      </div>
                    )}

                    {/* Documentation Tab */}
                    {activeTab === 'documentation' && (
                      <div className="error-boundary">
                        <ErrorBoundary fallback={<div className="p-4 bg-red-50 border border-red-200 rounded-md">
                          <p className="text-red-700">Error rendering documentation tab.</p>
                          <p className="text-sm text-red-600 mt-2">There might be an issue with the documentation data format.</p>
                        </div>}>
                          <SimpleDocumentationTab documentation={documentation} />
                        </ErrorBoundary>
                      </div>
                    )}

                    {/* Versioning Tab */}
                    {activeTab === 'versioning' && (
                      <div className="error-boundary">
                        <ErrorBoundary fallback={<div className="p-4 bg-red-50 border border-red-200 rounded-md">
                          <p className="text-red-700">Error rendering versioning tab.</p>
                          <p className="text-sm text-red-600 mt-2">There might be an issue with the versioning data format.</p>
                        </div>}>
                          <SimpleVersioningTab documentation={documentation} />
                        </ErrorBoundary>
                      </div>
                    )}
                  </>
                ) : (
                  // Handle the case when no documentation is available
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                    <p className="text-yellow-700">No documentation available.</p>
                    <p className="text-sm text-yellow-600 mt-2">Please generate documentation first.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-3 flex justify-end space-x-3">
              <button
                onClick={async () => {
                  setDownloadingJson(true);
                  try {
                    // Fetch the latest documentation from S3
                    const latestDocumentation = await fetchDocumentationFromS3();
                    
                    // Fetch the OpenAPI specification
                    const openApiSpecData = await fetchOpenApiSpec();
                    
                    // Create a comprehensive downloadable document in JSON format
                    let downloadData;

                  // Handle both formats - use latest documentation from S3
                  if (latestDocumentation?.parsed_json) {
                    // New format from Lambda
                    downloadData = latestDocumentation.parsed_json;
                  } else if (latestDocumentation) {
                    // Old format
                    downloadData = {
                      securityDefinitions: latestDocumentation.securityDefinitions || {},
                      policies: latestDocumentation.policies || {},
                      versioning: latestDocumentation.versioning || {},
                      documentation: latestDocumentation.documentation || {}
                    };
                  } else {
                    // Fallback to current state
                    downloadData = documentation?.parsed_json || {
                      securityDefinitions: documentation?.securityDefinitions || {},
                      policies: documentation?.policies || {},
                      versioning: documentation?.versioning || {},
                      documentation: documentation?.documentation || {}
                    };
                  }

                  // Create a comprehensive format for the download including all analysis data
                  const formattedData = {
                    apiDocumentation: {
                      metadata: {
                        generatedAt: new Date().toISOString(),
                        apiName: downloadData.info?.title || 'API Documentation',
                        apiVersion: downloadData.info?.version || '1.0.0',
                        description: 'Complete API documentation including domain analysis, business contexts, and security specifications'
                      },
                      domainAnalysis: {
                        title: 'Domain Analysis',
                        description: 'Structured analysis of the domain model including entities, attributes, and relationships',
                        content: analysisResult?.domainAnalysis || 'No domain analysis available'
                      },
                      businessContexts: {
                        title: 'Business Contexts',
                        description: 'Identified business domains and their bounded contexts',
                        content: boundedContexts || domainDescription || analysisResult?.businessContextAnalysis || analysisResult?.boundedContextAnalysis || 'No business context analysis available'
                      },
                      asciiDiagram: {
                        title: 'Business Context Diagram',
                        description: 'Visual representation of business contexts and their interactions',
                        content: asciiDiagram || 'No ASCII diagram available'
                      },
                      openApiSpecification: {
                        title: 'OpenAPI Specification',
                        description: 'Complete OpenAPI 3.0 specification with all endpoints, schemas, and security definitions',
                        content: openApiSpecData || 'OpenAPI specification not available'
                      },
                      sections: {
                        security: {
                          title: 'Security Definitions',
                          description: 'Security schemes and access control patterns',
                          content: downloadData.securityDefinitions || {}
                        },
                        governance: {
                          title: 'API Governance Policies',
                          description: 'Rate limiting, caching, and validation policies',
                          content: downloadData.policies || {}
                        },
                        endpoints: {
                          title: 'API Documentation',
                          description: 'Detailed endpoint documentation',
                          content: downloadData.documentation || {}
                        },
                        versioning: {
                          title: 'API Versioning Strategy',
                          description: 'Versioning approach and lifecycle management',
                          content: downloadData.versioning || {}
                        }
                      }
                    }
                  };

                  // Create a downloadable JSON file
                  const dataStr = JSON.stringify(formattedData, null, 2);
                  const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

                  const exportFileDefaultName = `complete-api-documentation-${new Date().toISOString().slice(0, 10)}.json`;

                  const linkElement = document.createElement('a');
                  linkElement.setAttribute('href', dataUri);
                  linkElement.setAttribute('download', exportFileDefaultName);
                  linkElement.click();
                  } catch (error) {
                    console.error('Error downloading JSON:', error);
                    alert('Failed to download documentation. Please try again.');
                  } finally {
                    setDownloadingJson(false);
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                disabled={downloadingJson}
              >
                {downloadingJson ? (
                  <div className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Downloading...
                  </div>
                ) : 'Download JSON'}
              </button>
              <button
                onClick={async () => {
                  setDownloadingMarkdown(true);
                  try {
                    // Fetch the latest documentation from S3
                    const latestDocumentation = await fetchDocumentationFromS3();
                  
                  // Fetch the OpenAPI specification
                  const openApiSpecData = await fetchOpenApiSpec();
                  
                  // Create a comprehensive downloadable document in Markdown format
                  let downloadData;

                  // Handle both formats - use latest documentation from S3
                  if (latestDocumentation?.parsed_json) {
                    // New format from Lambda
                    downloadData = latestDocumentation.parsed_json;
                  } else if (latestDocumentation) {
                    // Old format
                    downloadData = {
                      securityDefinitions: latestDocumentation.securityDefinitions || {},
                      policies: latestDocumentation.policies || {},
                      versioning: latestDocumentation.versioning || {},
                      documentation: latestDocumentation.documentation || {}
                    };
                  } else {
                    // Fallback to current state
                    downloadData = documentation?.parsed_json || {
                      securityDefinitions: documentation?.securityDefinitions || {},
                      policies: documentation?.policies || {},
                      versioning: documentation?.versioning || {},
                      documentation: documentation?.documentation || {}
                    };
                  }

                  // Create a comprehensive markdown document
                  let markdownContent = `# Complete API Documentation
Generated at: ${new Date().toISOString()}

## Domain Analysis

${analysisResult?.domainAnalysis || 'No domain analysis available'}

## Business Contexts

${boundedContexts || domainDescription || analysisResult?.businessContextAnalysis || analysisResult?.boundedContextAnalysis || 'No business context analysis available'}

${asciiDiagram ? `## Business Context Diagram

\`\`\`
${asciiDiagram}
\`\`\`

` : ''}## OpenAPI Specification

${openApiSpecData ? `\`\`\`json
${JSON.stringify(openApiSpecData, null, 2)}
\`\`\`

` : 'OpenAPI specification not available\n\n'}## Security Definitions

`;
                  if (downloadData.securityDefinitions?.schemes) {
                    markdownContent += `### Security Schemes

`;
                    if (Array.isArray(downloadData.securityDefinitions.schemes)) {
                      downloadData.securityDefinitions.schemes.forEach(scheme => {
                        markdownContent += `- **${scheme.name || 'Unnamed Scheme'}** (${scheme.type})
  - ${scheme.description || 'No description provided'}
`;
                      });
                    } else {
                      Object.entries(downloadData.securityDefinitions.schemes).forEach(([key, scheme]) => {
                        markdownContent += `- **${key}** (${scheme.type})
  - ${scheme.description || 'No description provided'}
`;
                      });
                    }
                  }

                  if (downloadData.securityDefinitions?.recommendations) {
                    markdownContent += `
### Security Recommendations

`;
                    if (Array.isArray(downloadData.securityDefinitions.recommendations)) {
                      downloadData.securityDefinitions.recommendations.forEach(rec => {
                        markdownContent += `- ${rec}
`;
                      });
                    } else {
                      Object.entries(downloadData.securityDefinitions.recommendations).forEach(([key, value]) => {
                        markdownContent += `- **${key}**: ${value}
`;
                      });
                    }
                  }

                  markdownContent += `
## API Governance Policies

`;
                  if (downloadData.policies) {
                    markdownContent += `\`\`\`json
${JSON.stringify(downloadData.policies, null, 2)}
\`\`\`
`;
                  } else {
                    markdownContent += `No governance policies defined.
`;
                  }

                  markdownContent += `
## API Documentation

`;
                  if (downloadData.documentation && Object.keys(downloadData.documentation).length > 0) {
                    markdownContent += `\`\`\`json
${JSON.stringify(downloadData.documentation, null, 2)}
\`\`\`
`;
                  } else {
                    markdownContent += `No detailed documentation available.
`;
                  }

                  markdownContent += `
## Versioning Strategy

`;
                  if (downloadData.versioning) {
                    markdownContent += `\`\`\`json
${JSON.stringify(downloadData.versioning, null, 2)}
\`\`\`
`;
                  } else {
                    markdownContent += `No versioning strategy defined.
`;
                  }

                  // Create a downloadable Markdown file
                  const dataStr = markdownContent;
                  const dataUri = 'data:text/markdown;charset=utf-8,' + encodeURIComponent(dataStr);

                  const exportFileDefaultName = `complete-api-documentation-${new Date().toISOString().slice(0, 10)}.md`;

                  const linkElement = document.createElement('a');
                  linkElement.setAttribute('href', dataUri);
                  linkElement.setAttribute('download', exportFileDefaultName);
                  linkElement.click();
                  } catch (error) {
                    console.error('Error downloading Markdown:', error);
                    alert('Failed to download documentation. Please try again.');
                  } finally {
                    setDownloadingMarkdown(false);
                  }
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
                disabled={downloadingMarkdown}
              >
                {downloadingMarkdown ? (
                  <div className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Downloading...
                  </div>
                ) : 'Download Markdown'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}