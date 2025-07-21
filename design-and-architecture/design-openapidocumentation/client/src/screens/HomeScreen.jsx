import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/apiClient';
import authService from '../services/authService';
import { useAuth } from '../contexts/AuthContext';

// Import components
import StageIndicator from '../components/StageIndicator';
import ProjectSelector from '../components/ProjectSelector';
const DomainAnalysisStage = lazy(() => import('../components/DomainAnalysisStage'));
const SecuritySpecsStage = lazy(() => import('../components/SecuritySpecsStage'));

// Helper function to normalize analysis result and ensure business context analysis is properly handled
const normalizeAnalysisResult = (result) => {
  if (!result || typeof result !== 'object') {
    return null;
  }

  // Create a normalized copy of the result
  const normalized = { ...result };

  // Ensure both businessContextAnalysis and boundedContextAnalysis are consistent
  const contextAnalysis = result.businessContextAnalysis || result.boundedContextAnalysis;

  if (contextAnalysis) {
    normalized.businessContextAnalysis = contextAnalysis;
    normalized.boundedContextAnalysis = contextAnalysis;
  }

  return normalized;
};

// Helper function to validate analysis result structure
const validateAnalysisResult = (result) => {
  if (!result || typeof result !== 'object') {
    return { isValid: false, error: 'Analysis result is not a valid object' };
  }

  // More flexible validation - check for any analysis content
  const hasAnalysisData = result.domainAnalysis ||
    result.businessContextAnalysis ||
    result.boundedContextAnalysis ||
    result.extractedText ||
    result.body ||
    result.success; // Even if it just has success flag, it's valid

  if (!hasAnalysisData) {
    console.log('Analysis result structure:', result);
    return { isValid: false, error: 'Analysis result does not contain expected analysis data' };
  }

  return { isValid: true, error: null };
};

// Helper function to safely set analysis result with proper error handling
const safeSetAnalysisResult = (result, setAnalysisResult, setError) => {
  try {
    const validation = validateAnalysisResult(result);

    if (!validation.isValid) {
      console.error('Invalid analysis result:', validation.error);
      setError(`Analysis validation failed: ${validation.error}`);
      return false;
    }

    const normalizedResult = normalizeAnalysisResult(result);
    setAnalysisResult(normalizedResult);

    // Log for debugging
    console.log('Analysis result set successfully:', {
      hasDomainAnalysis: !!normalizedResult.domainAnalysis,
      hasBusinessContextAnalysis: !!normalizedResult.businessContextAnalysis,
      hasBoundedContextAnalysis: !!normalizedResult.boundedContextAnalysis
    });

    return true;
  } catch (error) {
    console.error('Error setting analysis result:', error);
    setError(`Failed to process analysis result: ${error.message}`);
    return false;
  }
};

// Helper function to check if business context analysis is available and valid
const hasValidBusinessContextAnalysis = (analysisResult) => {
  if (!analysisResult) return false;

  const contextAnalysis = analysisResult.businessContextAnalysis || analysisResult.boundedContextAnalysis;
  return contextAnalysis && typeof contextAnalysis === 'string' && contextAnalysis.trim().length > 0;
};

// Helper function to get business context analysis with fallback
const getBusinessContextAnalysis = (analysisResult) => {
  if (!analysisResult) return null;

  return analysisResult.businessContextAnalysis || analysisResult.boundedContextAnalysis || null;
};

// Helper function to convert file to base64
const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      // Remove data:image/jpeg;base64, prefix
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
};

// Helper function to create a hash of input data for cache invalidation
const createInputHash = (domainAnalysis, businessContext) => {
  const input = `${domainAnalysis || ''}|${businessContext || ''}`;
  // Simple hash function (for cache invalidation, not security)
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString();
};

// Helper function to invalidate ASCII diagram cache when inputs change
const invalidateAsciiDiagramCache = (newDomainAnalysis, newBusinessContext) => {
  try {
    const cachedHash = localStorage.getItem('openapi_ascii_diagram_hash');
    if (!cachedHash) return false; // No cache to invalidate

    const newHash = createInputHash(newDomainAnalysis || '', newBusinessContext || '');

    if (newHash !== cachedHash) {
      console.log('🗑️ Invalidating ASCII diagram cache due to input changes');
      console.log('   Old hash:', cachedHash);
      console.log('   New hash:', newHash);
      localStorage.removeItem('openapi_ascii_diagram');
      localStorage.removeItem('openapi_ascii_diagram_hash');
      return true; // Cache was invalidated
    }

    return false; // Cache is still valid
  } catch (error) {
    console.error('Error invalidating ASCII diagram cache:', error);
    return false;
  }
};

export default function HomeScreen() {
  // Authentication state
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  // Add error boundary state
  const [componentError, setComponentError] = useState(null);

  // Basic state
  const [prompt, setPrompt] = useState(() => {
    // Try to load from localStorage
    try {
      return localStorage.getItem('openapi_prompt') || '';
    } catch (error) {
      return '';
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [specId, setSpecId] = useState(() => {
    // Try to load from localStorage
    return localStorage.getItem('openapi_spec_id') || null;
  });
  const [openApiSpec, setOpenApiSpec] = useState(() => {
    // Try to load from localStorage
    try {
      const savedSpec = localStorage.getItem('openapi_spec_content');
      return savedSpec ? JSON.parse(savedSpec) : null;
    } catch (error) {
      localStorage.removeItem('openapi_spec_content');
      return null;
    }
  });
  const [success, setSuccess] = useState(() => {
    // Initialize success state based on whether we have both specId and openApiSpec
    const savedSpecId = localStorage.getItem('openapi_spec_id');
    const savedSpec = localStorage.getItem('openapi_spec_content');
    return !!(savedSpecId && savedSpec);
  });

  // Image upload state
  const [imageFile, setImageFile] = useState(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [hasUploadedImage, setHasUploadedImage] = useState(false);
  const [uploadedImageName, setUploadedImageName] = useState('');

  // Analysis state
  const [analysisResult, setAnalysisResult] = useState(() => {
    // Try to load from localStorage with better error handling
    try {
      const savedAnalysis = localStorage.getItem('openapi_analysis_result');
      if (savedAnalysis) {
        const parsed = JSON.parse(savedAnalysis);
        // Ensure business context analysis is properly normalized
        return normalizeAnalysisResult(parsed);
      }
    } catch (error) {
      // If there's an error, clear the corrupted data
      localStorage.removeItem('openapi_analysis_result');
    }
    return null;
  });
  const [analyzing, setAnalyzing] = useState(false);

  // Multi-stage workflow state
  const [currentStage, setCurrentStage] = useState(() => {
    // Check if user has set a project (not default)
    const currentProject = apiClient.getProjectName();
    const hasProject = currentProject && currentProject !== 'default-project';
    
    if (!hasProject) {
      // If no project is set, start with project selection
      return 'project';
    }
    
    // Try to load from localStorage or default to 'input'
    const savedStage = localStorage.getItem('openapi_current_stage') || 'input';
    // Normalize old stage names
    if (savedStage === 'domain-input') return 'input';
    return savedStage;
  });
  const [boundedContexts, setBoundedContexts] = useState(() => {
    // Try to load from localStorage with better error handling
    try {
      const saved = localStorage.getItem('openapi_business_contexts');
      return saved || '';
    } catch (error) {
      return '';
    }
  });
  const [asciiDiagram, setAsciiDiagram] = useState(() => {
    // Try to load from localStorage with cache validation
    try {
      const cachedDiagram = localStorage.getItem('openapi_ascii_diagram');
      const cachedHash = localStorage.getItem('openapi_ascii_diagram_hash');

      if (!cachedDiagram || !cachedHash) {
        return '';
      }

      // Try to get current input data to validate cache
      const savedAnalysis = localStorage.getItem('openapi_analysis_result');
      const savedBusinessContext = localStorage.getItem('openapi_business_contexts');

      let currentDomainAnalysis = '';
      let currentBusinessContext = savedBusinessContext || '';

      if (savedAnalysis) {
        try {
          const parsedAnalysis = JSON.parse(savedAnalysis);
          currentDomainAnalysis = parsedAnalysis.domainAnalysis || '';
        } catch (e) {
          // If we can't parse the analysis, invalidate cache
          console.log('🗑️ Cache invalidated: Could not parse saved analysis');
          localStorage.removeItem('openapi_ascii_diagram');
          localStorage.removeItem('openapi_ascii_diagram_hash');
          return '';
        }
      }

      // Create hash of current input data
      const currentHash = createInputHash(currentDomainAnalysis, currentBusinessContext);

      // If hashes don't match, invalidate cache
      if (currentHash !== cachedHash) {
        console.log('🗑️ Cache invalidated: Input data has changed since last diagram generation');
        localStorage.removeItem('openapi_ascii_diagram');
        localStorage.removeItem('openapi_ascii_diagram_hash');
        return '';
      }

      console.log('✅ Using cached ASCII diagram (input data unchanged)');
      return cachedDiagram;
    } catch (error) {
      console.error('Error loading cached ASCII diagram:', error);
      // Clear potentially corrupted cache
      localStorage.removeItem('openapi_ascii_diagram');
      localStorage.removeItem('openapi_ascii_diagram_hash');
      return '';
    }
  });
  const [domainDescription, setDomainDescription] = useState(() => {
    // Try to load from localStorage
    return localStorage.getItem('openapi_domain_description') || '';
  });
  const [securitySpecs, setSecuritySpecs] = useState(() => {
    // Try to load from localStorage with better error handling
    try {
      const savedSpecs = localStorage.getItem('openapi_security_specs');
      return savedSpecs ? JSON.parse(savedSpecs) : null;
    } catch (error) {
      localStorage.removeItem('openapi_security_specs');
      return null;
    }
  });
  const [generatingSecuritySpecs, setGeneratingSecuritySpecs] = useState(false);

  const navigate = useNavigate();

  // Error boundary effect
  useEffect(() => {
    const handleError = (error) => {
      setComponentError(error.message);
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  // If there's a component error, show a fallback UI
  if (componentError) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        <h3 className="font-bold">Something went wrong</h3>
        <p>Error: {componentError}</p>
        <button
          onClick={() => {
            setComponentError(null);
            localStorage.clear();
            window.location.reload();
          }}
          className="mt-2 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
        >
          Reset Application
        </button>
      </div>
    );
  }

  // Save state to localStorage when it changes
  useEffect(() => {
    try {
      if (prompt) localStorage.setItem('openapi_prompt', prompt);
      if (specId) localStorage.setItem('openapi_spec_id', specId);
      if (openApiSpec) localStorage.setItem('openapi_spec_content', JSON.stringify(openApiSpec));
      localStorage.setItem('openapi_success', success.toString());
      if (analysisResult) {
        // Validate before saving
        const validation = validateAnalysisResult(analysisResult);
        if (validation.isValid) {
          localStorage.setItem('openapi_analysis_result', JSON.stringify(analysisResult));
        } else {
          console.warn('Skipping localStorage save for invalid analysis result:', validation.error);
        }
      }
      if (currentStage) localStorage.setItem('openapi_current_stage', currentStage);
      if (domainDescription) localStorage.setItem('openapi_domain_description', domainDescription);
      if (securitySpecs) localStorage.setItem('openapi_security_specs', JSON.stringify(securitySpecs));
      if (boundedContexts) localStorage.setItem('openapi_business_contexts', boundedContexts);
      if (asciiDiagram) {
        // Save ASCII diagram with input hash for cache invalidation
        const domainAnalysisText = analysisResult?.domainAnalysis || '';
        const businessContextText = boundedContexts || '';
        const inputHash = createInputHash(domainAnalysisText, businessContextText);

        localStorage.setItem('openapi_ascii_diagram', asciiDiagram);
        localStorage.setItem('openapi_ascii_diagram_hash', inputHash);

        console.log('💾 Saved ASCII diagram with hash:', inputHash);
      }
    } catch (error) {
      console.error('Error saving state to localStorage:', error);
      setError('Failed to save application state. Some data may be lost on page refresh.');
    }
  }, [prompt, specId, analysisResult, currentStage, domainDescription, securitySpecs, boundedContexts, asciiDiagram]);

  // Cache invalidation: Clear ASCII diagram cache when inputs change
  useEffect(() => {
    const domainAnalysisText = analysisResult?.domainAnalysis || '';
    const businessContextText = boundedContexts || '';

    // Only check for cache invalidation if we have some input data
    if (domainAnalysisText || businessContextText) {
      const wasInvalidated = invalidateAsciiDiagramCache(domainAnalysisText, businessContextText);

      if (wasInvalidated) {
        // Clear the current ASCII diagram state if cache was invalidated
        setAsciiDiagram('');
        console.log('🔄 ASCII diagram state cleared due to input changes');
      }
    }
  }, [analysisResult?.domainAnalysis, boundedContexts]);

  const generateOpenAPI = async (e) => {
    e.preventDefault();

    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await apiClient.post('/api/generate', { prompt });

      setLoading(false);

      if (response.success) {
        setSuccess(true);
        setSpecId(response.specId);

        // Save specId to localStorage
        localStorage.setItem('openapi_spec_id', response.specId);

        // Set the analysis result if available
        if (response.analysisResult) {
          const success = safeSetAnalysisResult(response.analysisResult, setAnalysisResult, setError);
          if (!success) {
            console.error('Failed to set analysis result from generate response');
            return;
          }

          const normalizedResult = normalizeAnalysisResult(response.analysisResult);
          const contextAnalysis = normalizedResult.businessContextAnalysis || normalizedResult.boundedContextAnalysis;

          // Also set domain description if business context analysis is available
          console.log('HomeScreen: Checking for business context analysis:', {
            hasBusinessContextAnalysis: !!normalizedResult.businessContextAnalysis,
            hasBoundedContextAnalysis: !!normalizedResult.boundedContextAnalysis,
            hasContextAnalysis: !!contextAnalysis
          });

          if (contextAnalysis) {
            console.log('Setting domain description and bounded contexts from context analysis');
            setDomainDescription(contextAnalysis);
            setBoundedContexts(contextAnalysis);

            // Navigate to the analysis stage
            goToStage('analysis');
          } else if (normalizedResult.domainAnalysis) {
            // If we have domain analysis but no business context, generate it first
            setLoading(true);
            try {
              const businessContextResponse = await apiClient.post('/api/generate-bounded-contexts', {
                domainAnalysis: normalizedResult.domainAnalysis
              });

              if (businessContextResponse.success) {
                // Create updated analysis result with business context
                const businessContextAnalysis = businessContextResponse.businessContextAnalysis || businessContextResponse.boundedContextAnalysis;

                if (!businessContextAnalysis) {
                  console.warn('Business context response missing analysis data');
                  setError('Business context analysis was generated but no data was returned. Proceeding with domain analysis only.');
                } else {
                  const updatedAnalysisResult = {
                    ...normalizedResult,
                    businessContextAnalysis: businessContextAnalysis,
                    boundedContextAnalysis: businessContextAnalysis
                  };

                  console.log('Business context response:', {
                    hasBusinessContextAnalysis: !!businessContextAnalysis,
                    contextLength: businessContextAnalysis ? businessContextAnalysis.length : 0
                  });

                  // Use safe setter for the updated result
                  const success = safeSetAnalysisResult(updatedAnalysisResult, setAnalysisResult, setError);
                  if (success) {
                    setDomainDescription(businessContextAnalysis);
                    setBoundedContexts(businessContextAnalysis);

                    console.log('Successfully updated analysis result with business context');
                  }
                }
              } else {
                console.warn('Business context generation failed:', businessContextResponse.error);
                setError(`Business context generation failed: ${businessContextResponse.error || 'Unknown error'}. Proceeding with domain analysis only.`);
              }
            } catch (businessContextError) {
              console.error('Error generating business contexts:', businessContextError);
              setError(`Failed to generate business context analysis: ${businessContextError.message}. Proceeding with domain analysis only.`);
            } finally {
              setLoading(false);
              // Navigate to the analysis stage even if business context generation fails
              goToStage('analysis');
            }
          } else {
            // Navigate to the analysis stage
            goToStage('analysis');
          }
        } else {
          // Navigate to the analysis stage
          goToStage('analysis');
        }
      } else {
        setError(response.error || 'Unknown error occurred');
      }
    } catch (error) {
      setLoading(false);
      setError(error.message || 'An error occurred');
    }
  };

  const viewSwagger = () => {
    // Save current state before navigating
    localStorage.setItem('openapi_current_stage', currentStage);
    if (analysisResult) localStorage.setItem('openapi_analysis_result', JSON.stringify(analysisResult));
    if (domainDescription) localStorage.setItem('openapi_domain_description', domainDescription);

    // Navigate to Swagger UI
    navigate(`/swagger/${specId}`);
  };

  // Check if image already exists on component mount
  useEffect(() => {
    // Clean up any old localStorage keys that might cause issues
    const cleanupOldData = () => {
      const currentStageValue = localStorage.getItem('openapi_current_stage');
      if (currentStageValue === 'domain-input') {
        localStorage.setItem('openapi_current_stage', 'input');
      }
    };

    cleanupOldData();

    // Add a longer delay to ensure authentication is fully settled
    const timer = setTimeout(() => {
      // Only check image status if user is authenticated
      if (authService.isAuthenticated()) {
        checkImageStatus();
      } else {
        // Fallback to localStorage if not authenticated yet
        const savedImageName = localStorage.getItem('uploaded_image_name');
        if (savedImageName) {
          setHasUploadedImage(true);
          setUploadedImageName(savedImageName);
        }
      }
    }, 2000); // Increased delay to 2 seconds

    return () => clearTimeout(timer);
  }, []);

  const checkImageStatus = async () => {
    try {
      // Double-check authentication before making API call
      if (!authService.isAuthenticated()) {
        console.log('User not authenticated, skipping image status check');
        // Fallback to localStorage
        const savedImageName = localStorage.getItem('uploaded_image_name');
        if (savedImageName) {
          setHasUploadedImage(true);
          setUploadedImageName(savedImageName);
        }
        return;
      }

      const response = await apiClient.get('/api/image-status');
      setHasUploadedImage(response.hasImage);
      if (response.hasImage) {
        setUploadedImageName(response.originalName);
      }
    } catch (error) {
      console.log('Image status check failed, using localStorage fallback:', error.message);

      // Don't treat this as a critical error - just use localStorage fallback
      const savedImageName = localStorage.getItem('uploaded_image_name');
      if (savedImageName) {
        setHasUploadedImage(true);
        setUploadedImageName(savedImageName);
      } else {
        setHasUploadedImage(false);
        setUploadedImageName('');
      }
    }
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setImageFile(file);
    setImageUploading(true);
    setError(null);

    try {
      console.log('Uploading file:', {
        name: file.name,
        size: file.size,
        type: file.type
      });

      // Use the Express server for image upload
      const response = await apiClient.uploadFile('/api/upload-image', file);

      console.log('Upload response:', response);

      if (response.success) {
        setHasUploadedImage(true);
        setUploadedImageName(response.originalName);
        setImageUploading(false);

        // Store the image name in localStorage
        localStorage.setItem('uploaded_image_name', response.originalName);
      }
    } catch (error) {
      console.error('Upload error:', error);
      setImageUploading(false);
      setError(error.message || 'Error uploading image');
    }
  };

  // Function to clear saved state
  const clearSavedState = () => {
    try {
      localStorage.removeItem('openapi_prompt');
      localStorage.removeItem('openapi_spec_id');
      localStorage.removeItem('openapi_analysis_result');
      localStorage.removeItem('openapi_current_stage');
      localStorage.removeItem('openapi_domain_description');
      localStorage.removeItem('openapi_security_specs');
      localStorage.removeItem('openapi_business_contexts');
      localStorage.removeItem('openapi_ascii_diagram');
      localStorage.removeItem('openapi_ascii_diagram_hash');

      console.log('Cleared all saved state from localStorage');
    } catch (error) {
      console.error('Error clearing saved state:', error);
      setError('Failed to clear saved application state. Some data may persist.');
    }
  };

  // Function to organize extracted text into a more structured format
  const organizeExtractedText = (text) => {
    // Split text into lines
    const lines = text.split('\n').filter(line => line.trim() !== '');

    // Identify potential entities (lines that look like class/entity names)
    const entities = {};
    let currentEntity = null;

    for (const line of lines) {
      // Check if this line might be an entity name (capitalized, no special chars)
      const isEntityName = /^[A-Z][a-zA-Z0-9]*$/.test(line.trim()) ||
        /^[A-Z][a-zA-Z0-9]*(\s+[A-Z][a-zA-Z0-9]*)*$/.test(line.trim());

      if (isEntityName) {
        currentEntity = line.trim();
        entities[currentEntity] = [];
      } else if (currentEntity && line.trim()) {
        // This is likely an attribute or relationship
        entities[currentEntity].push(line.trim());
      }
    }

    // Format the organized text
    let organized = '';

    for (const [entity, attributes] of Object.entries(entities)) {
      organized += `Entity: ${entity}\n`;

      if (attributes.length > 0) {
        organized += 'Attributes/Relationships:\n';
        attributes.forEach(attr => {
          organized += `- ${attr}\n`;
        });
      }

      organized += '\n';
    }

    // If we couldn't organize it well, return the original text
    if (organized.trim() === '') {
      return text;
    }

    return organized;
  };

  const handleAnalyzeImage = async () => {
    setAnalyzing(true);
    setError(null);

    // Start with a structured prompt format
    let basePrompt = 'I want to create a comprehensive API system based on the uploaded domain model with the following essential domains and requirements:\n\n';
    setPrompt(basePrompt + '🔄 Starting analysis...');

    // Simulate progress updates
    const progressSteps = [
      '📁 Processing image...',
      '🔍 Extracting text content...',
      '🏗️ Analyzing domain structure...',
      '🎯 Identifying business contexts...',
      '✨ Finalizing analysis...'
    ];

    let stepIndex = 0;
    const progressInterval = setInterval(() => {
      if (stepIndex < progressSteps.length) {
        setPrompt(basePrompt + progressSteps[stepIndex]);
        stepIndex++;
      }
    }, 2000);

    try {
      // Convert file to base64 for analysis (same format as upload)
      const base64Data = await fileToBase64(imageFile);

      // Send the image for analysis with additional data in base64 JSON format
      const response = await apiClient.post('/api/analyze-image', {
        image: {
          name: imageFile.name,
          type: imageFile.type,
          size: imageFile.size,
          data: base64Data
        },
        analysisType: 'full' // Request full analysis including bounded contexts
      });

      clearInterval(progressInterval);

      if (response.success && response.analysisResult) {
        // Clear any existing errors first
        setError(null);

        // Debug: Log the actual response structure
        console.log('Image analysis response:', response);
        console.log('Analysis result structure:', response.analysisResult);

        // Use safe setter for analysis result
        const success = safeSetAnalysisResult(response.analysisResult, setAnalysisResult, setError);
        if (!success) {
          console.error('Failed to set analysis result from image analysis');
          return;
        }

        const normalizedResult = normalizeAnalysisResult(response.analysisResult);
        const contextAnalysis = normalizedResult.businessContextAnalysis || normalizedResult.boundedContextAnalysis;

        // Create a structured prompt with the analysis
        let structuredPrompt = 'I want to create a comprehensive API system based on the analyzed domain model with the following essential domains and requirements:\n\n';

        if (normalizedResult.extractedText) {
          const organizedText = organizeExtractedText(normalizedResult.extractedText);
          structuredPrompt += '📋 EXTRACTED ENTITIES & COMPONENTS:\n' + organizedText + '\n\n';
        }

        if (normalizedResult.domainAnalysis) {
          structuredPrompt += '🏗️ DOMAIN ANALYSIS:\n' + normalizedResult.domainAnalysis + '\n\n';
        }

        // Use business context analysis if available
        const imageContextAnalysis = normalizedResult.businessContextAnalysis || normalizedResult.boundedContextAnalysis;
        if (imageContextAnalysis) {
          structuredPrompt += '🎯 BUSINESS CONTEXTS & API REQUIREMENTS:\n' + imageContextAnalysis + '\n\n';

          // Set the bounded context as the domain description for editing
          setDomainDescription(imageContextAnalysis);
          setBoundedContexts(imageContextAnalysis);
        } else {
          console.warn('No business context analysis found in image analysis result');
        }

        structuredPrompt += '📝 Please generate a complete OpenAPI specification that includes all the identified entities, relationships, and bounded contexts with appropriate REST endpoints, request/response schemas, and proper API documentation.';

        setPrompt(structuredPrompt);
        setAnalyzing(false);

        // Automatically move to the analysis stage
        if (normalizedResult.domainAnalysis) {
          goToStage('analysis');
        } else {
          console.warn('No domain analysis found in result, staying on input stage');
          setError('Image analysis completed but no domain analysis was generated. Please try with a different image or provide a text description.');
        }
      }
    } catch (error) {
      clearInterval(progressInterval);
      setAnalyzing(false);
      setError(error.message || 'Error analyzing image');
    }
  };

  const handleRemoveImage = async () => {
    try {
      const response = await apiClient.delete('/api/remove-image');
      if (response.success) {
        setHasUploadedImage(false);
        setImageFile(null);
        setUploadedImageName('');
        setAnalysisResult(null);
        setPrompt(''); // Clear textarea when removing image

        // Clear saved state
        clearSavedState();
      }
    } catch (error) {
      setError(error.message || 'Error removing image');
    }
  };

  const populateTextareaWithAnalysis = async () => {
    try {
      const response = await apiClient.get('/analysis-content');
      console.log('Analysis content response:', response);
      if (response.hasContent) {
        console.log('Setting prompt with content:', response.content.substring(0, 100) + '...');
        setPrompt(response.content);
      } else {
        console.log('No content available');
      }
    } catch (error) {
      console.error('Error getting analysis content:', error);
    }
  };

  const handleUploadAnother = () => {
    // Reset current image state
    setHasUploadedImage(false);
    setImageFile(null);
    setUploadedImageName('');
    setAnalysisResult(null);
    setError(null);

    // Clear saved state
    clearSavedState();

    // Clear the file input value to allow selecting the same file again
    const fileInput = document.getElementById('imageInput');
    if (fileInput) {
      fileInput.value = '';
      fileInput.click();
    }
  };

  // Function to handle stage navigation
  const goToStage = (stage) => {
    setCurrentStage(stage);
  };

  // Function to generate the final OpenAPI spec after user approval
  const generateFinalOpenAPI = async (e) => {
    e.preventDefault();

    if (!prompt.trim()) {
      setError('Please enter API requirements');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await apiClient.post('/api/generate-openapi', { prompt });

      setLoading(false);

      if (response.success) {
        setSuccess(true);
        setSpecId(response.specId);

        // Save both specId and the actual OpenAPI spec content
        localStorage.setItem('openapi_spec_id', response.specId);

        if (response.openApiSpec) {
          setOpenApiSpec(response.openApiSpec);
          localStorage.setItem('openapi_spec_content', JSON.stringify(response.openApiSpec));
        }
      } else {
        setError(response.error || 'Unknown error occurred');
      }
    } catch (error) {
      setLoading(false);
      setError(error.message || 'An error occurred');
    }
  };

  const handleGenerateSecuritySpecs = async (options) => {
    setGeneratingSecuritySpecs(true);
    setError(null);

    try {
      // Call the API to generate security specs
      const response = await apiClient.post('/api/generate-security', {
        specId,
        options
      });

      setSecuritySpecs(response);
    } catch (error) {
      setError(error.message || 'Error generating security specifications');
    } finally {
      setGeneratingSecuritySpecs(false);
    }
  };

  // No need to import components here as they're imported at the top

  // Handle project confirmation (when user sets up their project)
  const handleProjectConfirmed = (projectName) => {
    console.log('Project confirmed:', projectName);
    // Move to the input stage after project is set
    goToStage('input');
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Stage indicator - hide during project setup */}
      {currentStage !== 'project' && (
        <StageIndicator currentStage={currentStage} />
      )}

      {/* Error display */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          <p className="font-bold">Error</p>
          <p>{error}</p>
        </div>
      )}

      {/* Show reset button if there are issues */}
      {(currentStage !== 'project' && currentStage !== 'input' && currentStage !== 'analysis' && currentStage !== 'openapi' && currentStage !== 'security') && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p className="text-sm mb-2">
            <strong>⚠️ Application State Issue:</strong> The application is in an unexpected state.
          </p>
          <button
            onClick={() => {
              localStorage.clear();
              window.location.reload();
            }}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 text-sm"
          >
            Reset Application
          </button>
        </div>
      )}

      {/* Stage 0: Project Setup */}
      {currentStage === 'project' && (
        <ProjectSelector onProjectConfirmed={handleProjectConfirmed} />
      )}

      {/* Stage 1: Domain Input */}
      {currentStage === 'input' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4">Domain Model Input</h2>

          {/* Image Upload Section */}
          <div className="mb-6 p-4 border-2 border-dashed border-gray-300 rounded-lg">
            <h3 className="text-lg font-semibold mb-3">Upload Domain Model Image</h3>

            {!hasUploadedImage ? (
              <div className="text-center">
                <input
                  id="imageInput"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => document.getElementById('imageInput').click()}
                  className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:opacity-50"
                  disabled={imageUploading}
                >
                  {imageUploading ? 'Uploading...' : 'Upload Domain Model Image'}
                </button>
                <p className="text-gray-600 text-sm mt-2">
                  Upload an image of your domain model for analysis
                </p>
              </div>
            ) : (
              <div className="text-center">
                <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded mb-3">
                  <p className="font-bold">📁 {uploadedImageName}</p>
                  <p className="text-sm mt-1">Image uploaded successfully</p>
                </div>

                {!analysisResult ? (
                  <button
                    type="button"
                    onClick={handleAnalyzeImage}
                    className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 disabled:opacity-50 mb-3"
                    disabled={analyzing}
                  >
                    {analyzing ? 'Analyzing Domain Model...' : 'Analyze Domain Model'}
                  </button>
                ) : (
                  <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-3">
                    <p className="font-bold">✓ Analysis completed successfully!</p>
                    {!hasValidBusinessContextAnalysis(analysisResult) && (
                      <p className="text-sm mt-1 text-yellow-600">
                        ⚠️ Business context analysis needs refinement. You can proceed to review and improve it.
                      </p>
                    )}
                    <button
                      onClick={() => goToStage('analysis')}
                      className="mt-2 bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-dark"
                    >
                      Review Analysis
                    </button>
                  </div>
                )}

                <div className="flex justify-center space-x-3">
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600"
                  >
                    Remove Image
                  </button>
                  <button
                    type="button"
                    onClick={handleUploadAnother}
                    className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
                  >
                    Upload Another Image
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Text Description Section */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3">Or Describe Your Domain Model</h3>
            <textarea
              id="prompt"
              className="w-full border border-gray-300 rounded-md p-3 h-40"
              placeholder="Example: I am building a bookstore system with User, Book, Order, and Payment entities. Users can browse books, add them to cart, and place orders..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
            <p className="text-gray-600 text-sm mt-1">
              Provide a detailed description of your domain model, including entities, relationships, and business rules.
            </p>

            <button
              type="button"
              onClick={() => {
                // Validate analysis result before proceeding
                if (analysisResult) {
                  const validation = validateAnalysisResult(analysisResult);
                  if (!validation.isValid) {
                    setError(`Cannot proceed with invalid analysis result: ${validation.error}`);
                    return;
                  }
                  goToStage('analysis');
                } else {
                  generateOpenAPI();
                }
              }}
              className="w-full bg-primary text-white py-3 rounded-md font-bold hover:bg-primary-dark disabled:opacity-50 mt-4"
              disabled={loading || (!prompt.trim() && !analysisResult)}
            >
              {loading ? 'Analyzing Domain Model...' : analysisResult ? 'Continue to Analysis' : 'Analyze Text Description'}
            </button>
          </div>
        </div>
      )}

      {/* Stage 2: Domain Analysis */}
      {currentStage === 'analysis' && (
        <Suspense fallback={<div>Loading analysis component...</div>}>
          <DomainAnalysisStage
            analysisResult={analysisResult}
            setAnalysisResult={(newResult) => {
              const success = safeSetAnalysisResult(newResult, setAnalysisResult, setError);
              if (!success) {
                console.error('Failed to update analysis result from DomainAnalysisStage');
              }
            }}
            domainDescription={domainDescription}
            setDomainDescription={setDomainDescription}
            boundedContexts={boundedContexts}
            setBoundedContexts={setBoundedContexts}
            asciiDiagram={asciiDiagram}
            setAsciiDiagram={setAsciiDiagram}
            hasBusinessContextAnalysis={hasValidBusinessContextAnalysis(analysisResult)}
            businessContextAnalysis={getBusinessContextAnalysis(analysisResult)}
            onPrevious={() => goToStage('input')}
            onNext={() => {
              // Use the business context description for OpenAPI generation
              const boundedContextText = domainDescription || boundedContexts || getBusinessContextAnalysis(analysisResult) || '';
              const domainAnalysisText = analysisResult?.domainAnalysis || '';

              // Validate that we have sufficient data for OpenAPI generation
              if (!domainAnalysisText && !boundedContextText) {
                setError('Cannot proceed to OpenAPI generation without domain analysis or business context analysis. Please ensure the analysis is complete.');
                return;
              }

              // Create a structured prompt with both domain analysis and bounded contexts
              let structuredPrompt = 'I want to create a comprehensive API system based on the following domain analysis and business contexts:\n\n';

              if (domainAnalysisText) {
                structuredPrompt += '## DOMAIN ANALYSIS:\n' + domainAnalysisText + '\n\n';
              }

              if (boundedContextText) {
                structuredPrompt += '## BUSINESS CONTEXTS:\n' + boundedContextText + '\n\n';
              } else {
                console.warn('No business context analysis available for OpenAPI generation');
              }

              structuredPrompt += 'Please generate a complete OpenAPI specification that includes all the identified entities, relationships, and business contexts with appropriate REST endpoints, request/response schemas, and proper API documentation.';

              setPrompt(structuredPrompt);
              goToStage('openapi');
            }}
          />
        </Suspense>
      )}

      {/* Stage 3: OpenAPI Generation */}
      {currentStage === 'openapi' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4">OpenAPI Specification Generation</h2>

          {/* Notice about reviewing the analysis */}
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded mb-4">
            <p className="text-sm">
              <strong>📝 Final Review:</strong> The API requirements below are based on your domain analysis and business contexts.
              Please review and make any final adjustments before generating the OpenAPI specification.
            </p>
          </div>

          <form onSubmit={(e) => {
            e.preventDefault();
            generateFinalOpenAPI(e);
          }}>
            <div className="mb-4">
              <label htmlFor="openapi-prompt" className="block mb-2 font-medium">
                API Requirements
              </label>
              <textarea
                id="openapi-prompt"
                className="w-full border border-gray-300 rounded-md p-3 h-40"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                required
              />
              <p className="text-gray-600 text-sm mt-1">
                Review and edit the API requirements before generating the OpenAPI specification.
              </p>
            </div>

            <button
              type="submit"
              className="w-full bg-primary text-white py-3 rounded-md font-bold hover:bg-primary-dark disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Generating OpenAPI Specification...' : 'Generate OpenAPI Specification'}
            </button>
          </form>

          {loading && (
            <div className="text-center mt-4">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
              <p className="mt-2 text-gray-600">
                Creating your OpenAPI specification... This may take up to 5 minutes.
              </p>
            </div>
          )}

          {success && (
            <div className="mt-4">
              <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
                <h4 className="font-bold">Success!</h4>
                <p>OpenAPI specification generated successfully!</p>
              </div>
              <div className="flex space-x-3 mt-3">
                <button
                  onClick={viewSwagger}
                  className="flex-1 bg-secondary text-white py-3 rounded-md font-bold hover:bg-secondary-dark"
                >
                  View in Swagger UI
                </button>
                <button
                  onClick={() => goToStage('security')}
                  className="flex-1 bg-primary text-white py-3 rounded-md font-bold hover:bg-primary-dark"
                >
                  Add Security Specs
                </button>
              </div>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex justify-between mt-6">
            <button
              onClick={() => goToStage('analysis')}
              className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
            >
              Back to Analysis
            </button>
          </div>
        </div>
      )}

      {/* Stage 4: Security Specifications */}
      {currentStage === 'security' && (
        <Suspense fallback={<div>Loading security component...</div>}>
          <SecuritySpecsStage
            specId={specId}
            openApiSpec={openApiSpec}
            securitySpecs={securitySpecs}
            setSecuritySpecs={setSecuritySpecs}
            generatingSecuritySpecs={generatingSecuritySpecs}
            onGenerateSecuritySpecs={handleGenerateSecuritySpecs}
            onPrevious={() => goToStage('openapi')}
            analysisResult={analysisResult}
            domainDescription={domainDescription}
            boundedContexts={boundedContexts}
            asciiDiagram={asciiDiagram}
          />
        </Suspense>
      )}
    </div>
  );
}