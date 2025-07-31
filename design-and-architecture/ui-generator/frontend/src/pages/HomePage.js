import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Typography, 
  Box, 
  Alert, 
  Snackbar, 
  Paper, 
  CircularProgress,
  Button
} from '@mui/material';
import PromptForm from '../components/PromptForm';
import SimpleResults from '../components/SimpleResults';
import api from '../services/api';

const HomePage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [mockupResult, setMockupResult] = useState(null);
  const [multipleImagesResult, setMultipleImagesResult] = useState(null);
  const [descriptionResult, setDescriptionResult] = useState(null);
  const [componentsResult, setComponentsResult] = useState(null);
  const [error, setError] = useState(null);
  const [awsStatus, setAwsStatus] = useState({
    checking: true,
    credentialsOk: false,
    bedrockAccessOk: false,
    message: "Checking AWS configuration..."
  });

  useEffect(() => {
    const checkAwsConfiguration = async () => {
      try {
        // Skip AWS credential check in production environment
        // When deployed to AWS, the application will use IAM roles
        const isProduction = process.env.NODE_ENV === 'production';
        
        if (isProduction) {
          console.log('Running in production environment, assuming IAM roles are configured');
          setAwsStatus({
            checking: false,
            credentialsOk: true,
            bedrockAccessOk: true,
            message: "Running in production environment with IAM roles."
          });
          return;
        }
        
        // Only check credentials in development environment
        const credentialsResponse = await api.checkAwsCredentials();
        
        if (credentialsResponse.success) {
          // If credentials are valid, check Bedrock access
          const bedrockResponse = await api.checkBedrockAccess();
          
          setAwsStatus({
            checking: false,
            credentialsOk: true,
            bedrockAccessOk: bedrockResponse.success && bedrockResponse.has_all_required_models,
            message: bedrockResponse.success && bedrockResponse.has_all_required_models
              ? "AWS configuration is valid. You can generate designs."
              : `Missing access to required Bedrock models: ${bedrockResponse.missing_models?.join(', ')}`,
            missingModels: bedrockResponse.missing_models || []
          });
        } else {
          setAwsStatus({
            checking: false,
            credentialsOk: false,
            bedrockAccessOk: false,
            message: "AWS credentials are not properly configured."
          });
        }
      } catch (err) {
        console.error('Error checking AWS configuration:', err);
        setAwsStatus({
          checking: false,
          credentialsOk: false,
          bedrockAccessOk: false,
          message: "Failed to check AWS configuration. Please ensure AWS CLI is configured correctly."
        });
      }
    };

    checkAwsConfiguration();
  }, []);

  const handleSubmit = async (formData) => {
    setIsLoading(true);
    setError(null);
    
    // Clear previous results
    setMockupResult(null);
    setMultipleImagesResult(null);
    
    try {
      // Generate all three results in parallel, but handle each one separately
      const mockupPromise = api.generateMockup(
        formData.prompt, 
        formData.width, 
        formData.height, 
        formData.quality
      );
      
      const descriptionPromise = api.generateDescription(formData.prompt);
      const componentsPromise = api.generateComponents(formData.prompt);
      
      // Use Promise.allSettled to handle partial success
      const results = await Promise.allSettled([
        mockupPromise,
        descriptionPromise,
        componentsPromise
      ]);
      
      // Process mockup result
      if (results[0].status === 'fulfilled') {
        const mockupRes = results[0].value;
        console.log('Mockup result:', mockupRes);
        setMockupResult(mockupRes);
        if (!mockupRes.success) {
          setError(`Error generating mockup: ${mockupRes.error}`);
        }
      } else {
        console.error('Mockup generation failed:', results[0].reason);
        setError('Failed to generate mockup. Please try again.');
      }
      
      // Process description result
      if (results[1].status === 'fulfilled') {
        const descriptionRes = results[1].value;
        console.log('Description result:', descriptionRes);
        setDescriptionResult(descriptionRes);
        if (!descriptionRes.success && !error) {
          setError(`Error generating description: ${descriptionRes.error}`);
        }
      } else {
        console.error('Description generation failed:', results[1].reason);
        setDescriptionResult({
          success: false,
          error: 'Timed out. Try again or use a simpler prompt.'
        });
      }
      
      // Process components result
      if (results[2].status === 'fulfilled') {
        const componentsRes = results[2].value;
        console.log('Components result:', componentsRes);
        setComponentsResult(componentsRes);
        if (!componentsRes.success && !error) {
          setError(`Error generating components: ${componentsRes.error}`);
        }
      } else {
        console.error('Components generation failed:', results[2].reason);
        setComponentsResult({
          success: false,
          error: 'Timed out. Try again or use a simpler prompt.'
        });
      }
      
    } catch (err) {
      console.error('Error generating results:', err);
      setError('An error occurred while generating your design. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMultipleSubmit = async (formData) => {
    setIsLoading(true);
    setError(null);
    
    // Clear previous results
    setMockupResult(null);
    setMultipleImagesResult(null);
    
    try {
      // Generate multiple images and other results in parallel
      const multipleImagesPromise = api.generateMultipleMockups(
        formData.prompt,
        formData.numImages,
        formData.width,
        formData.height,
        formData.quality
      );
      
      const descriptionPromise = api.generateDescription(formData.prompt);
      const componentsPromise = api.generateComponents(formData.prompt);
      
      // Use Promise.allSettled to handle partial success
      const results = await Promise.allSettled([
        multipleImagesPromise,
        descriptionPromise,
        componentsPromise
      ]);
      
      // Process multiple images result
      if (results[0].status === 'fulfilled') {
        const multipleImagesRes = results[0].value;
        console.log('Multiple images result:', multipleImagesRes);
        setMultipleImagesResult(multipleImagesRes);
        if (!multipleImagesRes.success) {
          setError(`Error generating images: ${multipleImagesRes.error}`);
        }
      } else {
        console.error('Multiple images generation failed:', results[0].reason);
        setError('Failed to generate multiple images. Please try again.');
      }
      
      // Process description result
      if (results[1].status === 'fulfilled') {
        const descriptionRes = results[1].value;
        console.log('Description result:', descriptionRes);
        setDescriptionResult(descriptionRes);
        if (!descriptionRes.success && !error) {
          setError(`Error generating description: ${descriptionRes.error}`);
        }
      } else {
        console.error('Description generation failed:', results[1].reason);
        setDescriptionResult({
          success: false,
          error: 'Timed out. Try again or use a simpler prompt.'
        });
      }
      
      // Process components result
      if (results[2].status === 'fulfilled') {
        const componentsRes = results[2].value;
        console.log('Components result:', componentsRes);
        setComponentsResult(componentsRes);
        if (!componentsRes.success && !error) {
          setError(`Error generating components: ${componentsRes.error}`);
        }
      } else {
        console.error('Components generation failed:', results[2].reason);
        setComponentsResult({
          success: false,
          error: 'Timed out. Try again or use a simpler prompt.'
        });
      }
      
    } catch (err) {
      console.error('Error generating results:', err);
      setError('An error occurred while generating your design. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderAwsStatusMessage = () => {
    if (awsStatus.checking) {
      return (
        <Paper elevation={1} sx={{ p: 2, mb: 3, display: 'flex', alignItems: 'center' }}>
          <CircularProgress size={20} sx={{ mr: 2 }} />
          <Typography>Checking AWS configuration...</Typography>
        </Paper>
      );
    }
    
    if (!awsStatus.credentialsOk) {
      return (
        <Alert severity="error" sx={{ mb: 3 }}>
          <Typography variant="subtitle1">AWS credentials are not properly configured</Typography>
          <Typography variant="body2">
            Please run 'aws configure' in your terminal to set up your AWS credentials.
          </Typography>
          <Button 
            variant="outlined" 
            size="small" 
            color="error" 
            sx={{ mt: 1 }}
            onClick={() => window.open('https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-quickstart.html', '_blank')}
          >
            View AWS CLI Configuration Guide
          </Button>
        </Alert>
      );
    }
    
    if (!awsStatus.bedrockAccessOk) {
      return (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="subtitle1">Missing access to required Bedrock models</Typography>
          <Typography variant="body2">
            You need to request access to the following models in the Amazon Bedrock console:
          </Typography>
          <ul>
            {awsStatus.missingModels?.map(model => (
              <li key={model}>{model}</li>
            ))}
          </ul>
          <Button 
            variant="outlined" 
            size="small" 
            color="warning" 
            sx={{ mt: 1 }}
            onClick={() => window.open('https://docs.aws.amazon.com/bedrock/latest/userguide/model-access.html', '_blank')}
          >
            View Bedrock Model Access Guide
          </Button>
        </Alert>
      );
    }
    
    return (
      <Alert severity="success" sx={{ mb: 3 }}>
        AWS configuration is valid. You can generate designs.
      </Alert>
    );
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom align="center">
          AI-Powered UI/UX Design Generator
        </Typography>
        <Typography variant="subtitle1" align="center" color="text.secondary" paragraph>
          Transform your ideas into beautiful UI/UX designs with the power of AI.
          Simply describe what you need, and we'll generate mockups, specifications, and Figma component details.
        </Typography>
        
        {renderAwsStatusMessage()}
        
        <PromptForm 
          onSubmit={handleSubmit}
          onMultipleSubmit={handleMultipleSubmit}
          isLoading={isLoading} 
          disabled={awsStatus.checking || !awsStatus.credentialsOk || !awsStatus.bedrockAccessOk}
        />
        
        <SimpleResults 
          mockupResult={mockupResult}
          multipleImagesResult={multipleImagesResult}
          descriptionResult={descriptionResult}
          componentsResult={componentsResult}
        />
      </Box>
      
      <Snackbar open={!!error} autoHideDuration={6000} onClose={() => setError(null)}>
        <Alert onClose={() => setError(null)} severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default HomePage;
