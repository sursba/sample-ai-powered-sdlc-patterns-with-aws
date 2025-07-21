import React, { useState, useEffect } from 'react';
import apiClient from '../services/apiClient';

export default function DomainAnalysisStage({ 
  analysisResult, 
  setAnalysisResult,
  domainDescription, 
  setDomainDescription, 
  onPrevious, 
  onNext,
  boundedContexts: externalBoundedContexts,
  setBoundedContexts: setExternalBoundedContexts,
  asciiDiagram: externalAsciiDiagram,
  setAsciiDiagram: setExternalAsciiDiagram,
  forceRefresh = false // New prop to force fresh generation
}) {
  const [activeTab, setActiveTab] = useState('domain');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [boundedContexts, setBoundedContextsInternal] = useState(externalBoundedContexts || null);
  const [asciiDiagram, setAsciiDiagramInternal] = useState(externalAsciiDiagram || null);
  const [diagramLoading, setDiagramLoading] = useState(false);
  const [diagramRetryCount, setDiagramRetryCount] = useState(0);
  const [diagramError, setDiagramError] = useState(null);
  const [loadingStartTime, setLoadingStartTime] = useState(null);
  const [loadingElapsed, setLoadingElapsed] = useState(0);
  
  // Use these functions to update both internal and external state
  const setBoundedContexts = (value) => {
    setBoundedContextsInternal(value);
    if (setExternalBoundedContexts) setExternalBoundedContexts(value);
  };
  
  const setAsciiDiagram = (value) => {
    setAsciiDiagramInternal(value);
    if (setExternalAsciiDiagram) setExternalAsciiDiagram(value);
  };
  
  // If no analysis result, show a message
  if (!analysisResult) {
    return (
      <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
        <p className="font-bold">No analysis available</p>
        <p>Please go back and analyze your domain model first.</p>
        <button
          onClick={onPrevious}
          className="mt-3 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
        >
          Go Back
        </button>
      </div>
    );
  }
  

  
  // Force the business context to be displayed if it exists in the analysis result
  useEffect(() => {
    if (!boundedContexts && analysisResult) {
      // Check for business context analysis in either property
      const contextAnalysis = analysisResult.businessContextAnalysis || analysisResult.boundedContextAnalysis;
      if (contextAnalysis) {
        setBoundedContexts(contextAnalysis);
        // Also set the active tab to bounded contexts if we have them
        setActiveTab('bounded');
      }
    }
  }, [analysisResult, boundedContexts]);
  
  // If we have domain analysis but no business context and not currently loading, show a loading state
  if (analysisResult?.domainAnalysis && 
      !boundedContexts && 
      !externalBoundedContexts && 
      !analysisResult.boundedContextAnalysis && 
      !analysisResult.businessContextAnalysis && 
      !loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold mb-4">Generating Business Contexts</h2>
        <div className="text-center py-10">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
          <p className="mt-4 text-gray-600">
            Generating business contexts from your domain analysis...<br />
            This may take a minute. Please wait.
          </p>
        </div>
      </div>
    );
  }
  
  // Set business contexts from analysis result or external state when component mounts
  useEffect(() => {
    console.log('DomainAnalysisStage useEffect triggered with:', {
      hasAnalysisResult: !!analysisResult,
      hasExternalBoundedContexts: !!externalBoundedContexts,
      hasBoundedContextAnalysis: !!analysisResult?.boundedContextAnalysis,
      hasBusinessContextAnalysis: !!analysisResult?.businessContextAnalysis,
      hasDomainAnalysis: !!analysisResult?.domainAnalysis,
      hasBoundedContexts: !!boundedContexts,
      forceRefresh: forceRefresh
    });
    
    // If forceRefresh is true, clear existing state and force regeneration
    if (forceRefresh) {
      console.log('Force refresh requested - clearing cached state');
      setBoundedContextsInternal('');
      setAsciiDiagramInternal('');
      if (setExternalBoundedContexts) setExternalBoundedContexts('');
      if (setExternalAsciiDiagram) setExternalAsciiDiagram('');
      return;
    }
    
    // Only use external state if it's not empty/null and we don't already have internal state
    if (externalBoundedContexts && externalBoundedContexts.trim() && !boundedContexts) {
      console.log('Using external bounded contexts');
      setBoundedContextsInternal(externalBoundedContexts);
    }
    // Otherwise, use the analysis result
    else if (analysisResult && !boundedContexts) {
      // Check for business context analysis in either property
      const contextAnalysis = analysisResult.businessContextAnalysis || analysisResult.boundedContextAnalysis;
      
      if (contextAnalysis && contextAnalysis.trim()) {
        console.log('Using analysis result business context:', {
          source: analysisResult.businessContextAnalysis ? 'businessContextAnalysis' : 'boundedContextAnalysis',
          length: contextAnalysis.length
        });
        setBoundedContexts(contextAnalysis);
        setDomainDescription(contextAnalysis);
        // Also set the active tab to bounded contexts if we have them
        setActiveTab('bounded');
      }
      // If we have domain analysis but no business contexts, automatically generate them
      else if (analysisResult.domainAnalysis && !boundedContexts) {
        console.log('Generating business contexts automatically');
        // Set a small delay to ensure the component is fully mounted
        const timer = setTimeout(() => {
          generateBoundedContexts();
        }, 500);
        return () => clearTimeout(timer);
      }
    }
    
    // Only use external ASCII diagram if it's not empty/null and we don't already have internal state
    if (externalAsciiDiagram && externalAsciiDiagram.trim() && !asciiDiagram) {
      setAsciiDiagramInternal(externalAsciiDiagram);
    }
  }, [analysisResult, externalBoundedContexts, externalAsciiDiagram, forceRefresh]);
  
  // Function to generate business contexts
  const generateBoundedContexts = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Show a message to the user that this might take some time
      setBoundedContexts('Generating business contexts... This may take up to a minute.');
      setActiveTab('bounded');
      
      // Validate that we have domain analysis to work with
      const domainAnalysisText = analysisResult?.domainAnalysis || domainDescription;
      if (!domainAnalysisText) {
        setError('No domain analysis available to generate business contexts from.');
        setBoundedContexts(null);
        setLoading(false);
        return;
      }
      
      // Set a longer timeout for the request (60 seconds)
      const response = await apiClient.post('/api/generate-bounded-contexts', {
        domainAnalysis: domainAnalysisText
      }, {
        timeout: 60000 // 60 seconds timeout
      });
      
      if (response.success === false) {
        setError(response.error || 'Error generating business contexts');
        setBoundedContexts(null);
      } else if (!response.businessContextAnalysis && !response.boundedContextAnalysis) {
        setError('No business context analysis was returned from the server.');
        setBoundedContexts(null);
      } else {
        // Use businessContextAnalysis if available, otherwise fall back to boundedContextAnalysis
        const contextAnalysis = response.businessContextAnalysis || response.boundedContextAnalysis;
        setBoundedContexts(contextAnalysis);
        
        // Also update the analysis result
        if (setAnalysisResult && contextAnalysis) {
          setAnalysisResult(prev => ({
            ...prev,
            boundedContextAnalysis: contextAnalysis,
            businessContextAnalysis: contextAnalysis
          }));
        }
      }
    } catch (error) {
      setError(error.response?.data?.error || 'Error generating business contexts. The request may have timed out due to the complexity of the analysis.');
      setBoundedContexts(null);
    } finally {
      setLoading(false);
    }
  };

  // Function to generate ASCII diagram with retry logic
  const generateAsciiDiagram = async (retryAttempt = 0) => {
    setDiagramLoading(true);
    setError(null);
    setDiagramError(null);
    
    try {
      // Clear any existing diagram content to show loading state
      setAsciiDiagram(null);
      setActiveTab('ascii');
      
      // Prepare comprehensive data for the request
      const domainAnalysisText = analysisResult?.domainAnalysis || domainDescription || '';
      const businessContextText = boundedContexts || analysisResult?.boundedContextAnalysis || analysisResult?.businessContextAnalysis || '';
      
      // Validate input data completeness
      if (!domainAnalysisText && !businessContextText) {
        const errorMsg = 'Cannot generate diagram without domain analysis or business context data. Please ensure the analysis is complete.';
        setError(errorMsg);
        setDiagramError(errorMsg);
        setAsciiDiagram(null);
        setDiagramLoading(false);
        return;
      }
      
      // Log data availability for debugging
      console.log('ASCII diagram generation data:', {
        hasDomainAnalysis: !!domainAnalysisText,
        hasBusinessContext: !!businessContextText,
        domainAnalysisLength: domainAnalysisText.length,
        businessContextLength: businessContextText.length,
        retryAttempt: retryAttempt,
        totalPayloadSize: (domainAnalysisText.length + businessContextText.length)
      });
      
      // Check if payload is too large for AWS SigV4 signing (common issue with large requests)
      const totalSize = domainAnalysisText.length + businessContextText.length;
      let truncatedDomainAnalysis = domainAnalysisText;
      let truncatedBusinessContext = businessContextText;
      
      if (totalSize > 50000) { // 50KB limit to avoid signing issues
        console.warn('Large payload detected, truncating for ASCII diagram generation');
        
        // Truncate each text to a reasonable size while preserving important content
        const maxDomainSize = 20000; // 20KB max for domain analysis
        const maxBusinessSize = 20000; // 20KB max for business context
        
        if (domainAnalysisText.length > maxDomainSize) {
          // Try to truncate at a natural break point (paragraph or section)
          const truncatePoint = domainAnalysisText.lastIndexOf('\n\n', maxDomainSize) || 
                               domainAnalysisText.lastIndexOf('\n', maxDomainSize) || 
                               maxDomainSize;
          truncatedDomainAnalysis = domainAnalysisText.substring(0, truncatePoint) + 
                                   '\n\n[Content truncated for diagram generation]';
        }
        
        if (businessContextText.length > maxBusinessSize) {
          const truncatePoint = businessContextText.lastIndexOf('\n\n', maxBusinessSize) || 
                               businessContextText.lastIndexOf('\n', maxBusinessSize) || 
                               maxBusinessSize;
          truncatedBusinessContext = businessContextText.substring(0, truncatePoint) + 
                                    '\n\n[Content truncated for diagram generation]';
        }
        
        console.log('Payload truncated:', {
          originalDomainSize: domainAnalysisText.length,
          truncatedDomainSize: truncatedDomainAnalysis.length,
          originalBusinessSize: businessContextText.length,
          truncatedBusinessSize: truncatedBusinessContext.length,
          newTotalSize: truncatedDomainAnalysis.length + truncatedBusinessContext.length
        });
      }
      
      // Combine data for comprehensive diagram generation
      const combinedData = {
        domainAnalysis: truncatedDomainAnalysis,
        businessContext: truncatedBusinessContext,
        // Include metadata for better processing
        hasComprehensiveData: !!(truncatedDomainAnalysis && truncatedBusinessContext),
        dataSource: {
          domainFromAnalysis: !!analysisResult?.domainAnalysis,
          businessFromBoundedContexts: !!boundedContexts,
          businessFromAnalysis: !!(analysisResult?.boundedContextAnalysis || analysisResult?.businessContextAnalysis)
        },
        retryCount: retryAttempt,
        previousError: diagramError,
        truncated: totalSize > 50000 // Flag to indicate content was truncated
      };
      
      // Adjust timeout based on retry attempt (shorter timeouts for retries)
      const timeout = retryAttempt === 0 ? 60000 : (retryAttempt === 1 ? 45000 : 30000);
      
      // Set a timeout for the request
      const response = await apiClient.post('/api/generate-ascii-diagram', combinedData, {
        timeout: timeout
      });
      
      if (response.success === false) {
        const errorMsg = response.error || 'Unable to create diagram.';
        setDiagramError(errorMsg);
        
        // Check if this is a retryable error and we haven't exceeded max retries
        const isRetryable = response.retryable !== false; // Default to retryable unless explicitly false
        const maxRetries = 2;
        
        if (isRetryable && retryAttempt < maxRetries) {
          setError(`${errorMsg} Retrying automatically...`);
          setDiagramRetryCount(retryAttempt + 1);
          
          // Automatically retry after a short delay
          setTimeout(() => {
            generateAsciiDiagram(retryAttempt + 1);
          }, 2000);
          return;
        } else {
          setError(`${errorMsg} ${retryAttempt >= maxRetries ? 'Maximum retry attempts reached. ' : ''}You can try again or continue without the diagram.`);
          setAsciiDiagram(null);
          setDiagramLoading(false);
          setDiagramRetryCount(retryAttempt + 1); // Keep the retry count for manual retry
        }
      } else if (response.asciiDiagram) {
        setAsciiDiagram(response.asciiDiagram);
        setDiagramRetryCount(0);
        setDiagramError(null);
      } else {
        // Success but no ASCII diagram - treat as retryable error
        const errorMsg = 'ASCII diagram was generated but no content was returned.';
        setDiagramError(errorMsg);
        
        const maxRetries = 2;
        if (retryAttempt < maxRetries) {
          setError(`${errorMsg} Retrying automatically...`);
          setDiagramRetryCount(retryAttempt + 1);
          
          // Automatically retry after a short delay
          setTimeout(() => {
            generateAsciiDiagram(retryAttempt + 1);
          }, 2000);
          return;
        } else {
          setError(`${errorMsg} Maximum retry attempts reached. You can try again or continue without the diagram.`);
          setAsciiDiagram(null);
          setDiagramLoading(false);
          setDiagramRetryCount(retryAttempt + 1);
        }
      }
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Unable to create diagram. This may be due to complexity or network issues.';
      setDiagramError(errorMsg);
      
      // Check if this is a timeout or network error (retryable)
      const isRetryable = error.code === 'ECONNABORTED' || error.message.includes('timeout') || error.message.includes('Network Error');
      const maxRetries = 2;
      
      if (isRetryable && retryAttempt < maxRetries) {
        setError(`${errorMsg} Preparing to retry...`);
        setDiagramRetryCount(retryAttempt + 1);
        // Don't set asciiDiagram to null yet, keep the loading message
      } else {
        setError(`${errorMsg} ${retryAttempt >= maxRetries ? 'Maximum retry attempts reached. ' : ''}You can try again or continue without the diagram.`);
        setAsciiDiagram(null);
        setDiagramLoading(false);
        setDiagramRetryCount(0);
      }
    } finally {
      setDiagramLoading(false);
    }
  };

  // Function to retry ASCII diagram generation
  const retryAsciiDiagram = async () => {
    await generateAsciiDiagram(diagramRetryCount);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-bold mb-4">Domain Analysis Review</h2>
      
      {/* Notice about manual editing */}
      <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded mb-4">
        <p className="text-sm">
          <strong>💡 Review & Edit:</strong> The generated analysis and business contexts may contain inaccuracies. 
          Please review and edit the content below to ensure accuracy before proceeding to OpenAPI generation.
        </p>
      </div>
      
      {/* Error display */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p className="font-bold">Error</p>
          <p>{error}</p>
        </div>
      )}
      
      {/* Tabs for different analysis views */}
      <div className="border-b border-gray-200 mb-4">
        <nav className="flex -mb-px">
          <button
            className={`py-2 px-4 font-medium ${
              activeTab === 'domain'
                ? 'border-b-2 border-primary text-primary'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('domain')}
          >
            Domain Analysis
          </button>

          <button
            className={`py-2 px-4 font-medium ${
              activeTab === 'bounded'
                ? 'border-b-2 border-primary text-primary'
                : 'text-gray-500 hover:text-gray-700'
            } ${
              !boundedContexts && !analysisResult?.businessContextAnalysis && !analysisResult?.boundedContextAnalysis && !loading
                ? 'opacity-50 cursor-not-allowed'
                : ''
            }`}
            onClick={() => {
              // Only switch to bounded tab if we have business contexts or are loading them
              if (boundedContexts || analysisResult?.businessContextAnalysis || analysisResult?.boundedContextAnalysis || loading) {
                setActiveTab('bounded');
              } else {
                // If no business contexts, start generating them
                generateBoundedContexts();
              }
            }}
          >
            Business Contexts
            {loading && (
              <span className="ml-2 inline-block animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></span>
            )}
          </button>
          <button
            className={`py-2 px-4 font-medium ${
              activeTab === 'ascii'
                ? 'border-b-2 border-primary text-primary'
                : 'text-gray-500 hover:text-gray-700'
            } ${
              !asciiDiagram && !analysisResult?.asciiDiagram && !diagramLoading
                ? 'opacity-50 cursor-not-allowed'
                : ''
            }`}
            onClick={() => {
              // Only switch to ASCII tab if we have a diagram or are loading one
              if (asciiDiagram || analysisResult?.asciiDiagram || diagramLoading) {
                setActiveTab('ascii');
              } else if (boundedContexts || analysisResult?.businessContextAnalysis || analysisResult?.boundedContextAnalysis) {
                // If we have business contexts but no diagram, generate one
                generateAsciiDiagram();
              }
            }}
          >
            ASCII Diagram
            {diagramLoading && (
              <span className="ml-2 inline-flex items-center">
                <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></span>
                <span className="ml-1 text-xs">
                  {diagramRetryCount > 0 ? `(${diagramRetryCount + 1}/3)` : ''}
                </span>
              </span>
            )}
          </button>

        </nav>
      </div>
      
      {/* Analysis content based on active tab */}
      <div className="mb-6">
        {activeTab === 'domain' && (
          <div>
            <p className="text-gray-600 mb-2">
              <strong>Review and edit the domain analysis</strong> below. The AI-generated analysis may contain errors or miss important details. 
              Please verify entities, attributes, and relationships are accurate for your domain.
            </p>
            <textarea
              className="w-full border border-gray-300 rounded-md p-3 h-96 font-mono text-sm"
              value={analysisResult.domainAnalysis || ''}
              onChange={(e) => {
                setAnalysisResult({
                  ...analysisResult,
                  domainAnalysis: e.target.value
                });
              }}
              placeholder="Domain analysis will appear here..."
            />
            
            {!boundedContexts && !loading && (
              <div className="mt-4 text-center">
                <button
                  onClick={generateBoundedContexts}
                  className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 disabled:opacity-50"
                  disabled={loading}
                >
                  {loading ? 'Generating Business Contexts...' : 'Generate Business Contexts'}
                </button>
              </div>
            )}
          </div>
        )}
        

        
        {activeTab === 'bounded' && (
          <div>
            <p className="text-gray-600 mb-2">
              <strong>Review and edit the business contexts</strong> below. The AI may have misidentified boundaries or missed important context relationships. 
              Please verify the business domains and their interactions are correct for your system.
            </p>
            {loading ? (
              <div className="text-center py-10">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
                <p className="mt-2 text-gray-600">
                  Generating business contexts... This may take a minute.
                </p>
              </div>
            ) : (
              <div>

                <textarea
                  className="w-full border border-gray-300 rounded-md p-3 h-96 font-mono text-sm"
                  value={
                    boundedContexts || 
                    analysisResult?.businessContextAnalysis || 
                    analysisResult?.boundedContextAnalysis || 
                    ''
                  }
                  onChange={(e) => {
                    setBoundedContexts(e.target.value);
                    if (setAnalysisResult) {
                      setAnalysisResult({
                        ...analysisResult,
                        boundedContextAnalysis: e.target.value,
                        businessContextAnalysis: e.target.value
                      });
                    }
                    // Also update the domain description for consistency
                    setDomainDescription(e.target.value);
                  }}
                  placeholder="Business contexts will appear here..."
                />
                {/* Add regenerate button if we already have business contexts */}
                {(boundedContexts || analysisResult?.businessContextAnalysis || analysisResult?.boundedContextAnalysis) && (
                  <div className="mt-2 text-right">
                    <button
                      onClick={generateBoundedContexts}
                      className="bg-blue-500 text-white px-3 py-1 rounded-md hover:bg-blue-600 text-sm"
                      disabled={loading}
                    >
                      Regenerate Business Contexts
                    </button>
                  </div>
                )}
              </div>
            )}
            {!loading && !boundedContexts && !analysisResult?.businessContextAnalysis && !analysisResult?.boundedContextAnalysis && (
              <div className="mt-4 text-center">
                <button
                  onClick={generateBoundedContexts}
                  className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600"
                >
                  Generate Business Contexts
                </button>
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'ascii' && (
          <div>
            <p className="text-gray-600 mb-2">
              <strong>Edit the ASCII diagram</strong> if needed. This visualizes the business contexts and their interactions.
            </p>
            {diagramLoading ? (
              <div className="text-center py-10">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
                <p className="mt-2 text-gray-600">
                  {diagramRetryCount > 0 
                    ? `Generating ASCII diagram... (Attempt ${diagramRetryCount + 1}/3)`
                    : 'Generating ASCII diagram... This may take a minute.'
                  }
                </p>
                {loadingElapsed > 0 && (
                  <p className="mt-1 text-sm text-gray-500">
                    Elapsed time: {loadingElapsed}s {loadingElapsed > 30 ? '(This is taking longer than usual)' : ''}
                  </p>
                )}
              </div>
            ) : asciiDiagram ? (
              <div>
                <textarea
                  className="w-full border border-gray-300 rounded-md p-3 h-96 font-mono text-sm"
                  value={asciiDiagram}
                  onChange={(e) => setAsciiDiagram(e.target.value)}
                  placeholder="ASCII diagram will appear here..."
                />
                {/* Show regenerate button */}
                <div className="mt-2 text-right">
                  <button
                    onClick={() => generateAsciiDiagram(0)}
                    className="bg-blue-500 text-white px-3 py-1 rounded-md hover:bg-blue-600 text-sm"
                    disabled={diagramLoading}
                  >
                    {diagramLoading ? 'Regenerating...' : 'Regenerate Diagram'}
                  </button>
                </div>
              </div>
            ) : analysisResult.asciiDiagram ? (
              <textarea
                className="w-full border border-gray-300 rounded-md p-3 h-96 font-mono text-sm"
                value={analysisResult.asciiDiagram}
                onChange={(e) => {
                  setAsciiDiagram(e.target.value);
                  setAnalysisResult({
                    ...analysisResult,
                    asciiDiagram: e.target.value
                  });
                }}
                placeholder="ASCII diagram will appear here..."
              />
            ) : (
              <div className="text-center py-10">
                <p>No ASCII diagram available.</p>
                
                {/* Show retry button if there was an error and we have retry count */}
                {diagramError && diagramRetryCount > 0 ? (
                  <div className="mt-4">
                    <p className="text-red-600 mb-2">Diagram generation failed. Would you like to try again?</p>
                    <div className="flex justify-center space-x-3">
                      <button
                        onClick={retryAsciiDiagram}
                        className="bg-orange-500 text-white px-4 py-2 rounded-md hover:bg-orange-600"
                        disabled={diagramLoading}
                      >
                        {diagramLoading ? 'Retrying...' : `Retry (${diagramRetryCount}/2)`}
                      </button>
                      <button
                        onClick={() => {
                          setDiagramError(null);
                          setDiagramRetryCount(0);
                        }}
                        className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
                      >
                        Skip Diagram
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => generateAsciiDiagram(0)}
                    className="mt-4 bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600"
                    disabled={!boundedContexts && !analysisResult.boundedContextAnalysis}
                  >
                    Generate ASCII Diagram
                  </button>
                )}
                
                {!boundedContexts && !analysisResult.boundedContextAnalysis && (
                  <p className="mt-2 text-sm text-gray-600">
                    You need to generate business contexts first before creating an ASCII diagram.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
        

      </div>
      
      {/* Navigation buttons */}
      <div className="flex justify-between">
        <button
          onClick={onPrevious}
          className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
        >
          Back to Domain Input
        </button>
        <button
          onClick={onNext}
          className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-dark"
        >
          Continue to OpenAPI Generation
        </button>
      </div>
    </div>
  );
}