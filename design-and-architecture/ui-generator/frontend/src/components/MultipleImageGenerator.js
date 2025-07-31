import React, { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Grid,
  Card,
  CardMedia,
  CardActions,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider
} from '@mui/material';
import {
  Download as DownloadIcon,
  GetApp as GetAppIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  Description as DescriptionIcon,
  Code as CodeIcon
} from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import api from '../services/api';

const MultipleImageGenerator = () => {
  const [prompt, setPrompt] = useState('');
  const [numImages, setNumImages] = useState(2); // Default to 2
  const [images, setImages] = useState([]);
  const [descriptions, setDescriptions] = useState([]);
  const [components, setComponents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingDescriptions, setLoadingDescriptions] = useState(false);
  const [loadingComponents, setLoadingComponents] = useState(false);
  const [error, setError] = useState(null);
  const [generationStats, setGenerationStats] = useState(null);
  const [selectedTab, setSelectedTab] = useState(0);

  const generateImages = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setLoading(true);
    setError(null);
    setImages([]);
    setDescriptions([]);
    setComponents([]);
    setGenerationStats(null);
    setSelectedTab(0);

    try {
      // Generate images using batch API call
      const result = await api.generateMultipleMockups(prompt, numImages);
      
      if (result.success) {
        setImages(result.images);
        setGenerationStats({
          requested: result.requested_count,
          generated: result.total_count,
          errors: result.errors
        });
        
        if (result.errors && result.errors.length > 0) {
          setError(`Some images failed to generate: ${result.errors.join(', ')}`);
        }

        // Generate descriptions and components for each image
        await generateDescriptionsAndComponents(result.images, prompt);
      } else {
        setError(result.error || 'Failed to generate images');
      }
    } catch (err) {
      console.error('Error generating images:', err);
      setError('An error occurred while generating images');
    } finally {
      setLoading(false);
    }
  };

  const generateDescriptionsAndComponents = async (generatedImages, originalPrompt) => {
    setLoadingDescriptions(true);
    setLoadingComponents(true);

    try {
      // Generate descriptions for each image
      const descriptionPromises = generatedImages.map(async (image, index) => {
        try {
          const descriptionPrompt = `${originalPrompt} - This is variation ${index + 1} of ${generatedImages.length}. Provide a detailed UI/UX description for this specific variation.`;
          const result = await api.generateDescription(descriptionPrompt);
          return {
            imageId: image.id,
            index: index,
            description: result.success ? result.description : 'Failed to generate description',
            success: result.success
          };
        } catch (err) {
          console.error(`Error generating description for image ${index + 1}:`, err);
          return {
            imageId: image.id,
            index: index,
            description: 'Error generating description',
            success: false
          };
        }
      });

      const descriptions = await Promise.all(descriptionPromises);
      setDescriptions(descriptions);
      setLoadingDescriptions(false);

      // Generate components for each image
      const componentPromises = generatedImages.map(async (image, index) => {
        try {
          const componentPrompt = `${originalPrompt} - This is variation ${index + 1} of ${generatedImages.length}. Provide detailed Figma component specifications for this specific variation.`;
          const result = await api.generateComponents(componentPrompt);
          return {
            imageId: image.id,
            index: index,
            components: result.success ? result.components : 'Failed to generate components',
            success: result.success
          };
        } catch (err) {
          console.error(`Error generating components for image ${index + 1}:`, err);
          return {
            imageId: image.id,
            index: index,
            components: 'Error generating components',
            success: false
          };
        }
      });

      const components = await Promise.all(componentPromises);
      setComponents(components);
      setLoadingComponents(false);

    } catch (err) {
      console.error('Error generating descriptions and components:', err);
      setLoadingDescriptions(false);
      setLoadingComponents(false);
    }
  };

  const downloadImage = async (image) => {
    try {
      await api.downloadImage(image.filename);
    } catch (err) {
      console.error('Error downloading image:', err);
      setError(`Failed to download ${image.filename}`);
    }
  };

  const downloadAllImages = async () => {
    for (let i = 0; i < images.length; i++) {
      try {
        await api.downloadImage(images[i].filename);
        // Add delay between downloads to avoid overwhelming the browser
        if (i < images.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (err) {
        console.error(`Error downloading image ${images[i].filename}:`, err);
      }
    }
  };

  const regenerateImages = () => {
    generateImages();
  };

  const handleTabChange = (event, newValue) => {
    setSelectedTab(newValue);
  };

  const getDescriptionForImage = (imageId) => {
    const desc = descriptions.find(d => d.imageId === imageId);
    return desc || { description: 'Loading...', success: false };
  };

  const getComponentsForImage = (imageId) => {
    const comp = components.find(c => c.imageId === imageId);
    return comp || { components: 'Loading...', success: false };
  };

  const TabPanel = ({ children, value, index, ...other }) => {
    return (
      <div
        role="tabpanel"
        hidden={value !== index}
        id={`image-tabpanel-${index}`}
        aria-labelledby={`image-tab-${index}`}
        {...other}
      >
        {value === index && (
          <Box sx={{ p: 3 }}>
            {children}
          </Box>
        )}
      </div>
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom align="center">
        Multiple UI Mockup Generator
      </Typography>
      <Typography variant="subtitle1" align="center" color="text.secondary" paragraph>
        Generate multiple variations of your UI design with a single prompt
      </Typography>
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          <strong>Optimized:</strong> All {numImages} images are generated in a single API call to avoid throttling. 
          Each variation gets its own UI description and Figma component specifications.
        </Typography>
      </Alert>

      {/* Input Controls */}
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={3} alignItems="end">
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Describe your UI design"
              multiline
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., Modern dashboard with dark theme, sidebar navigation, and data visualization charts"
              variant="outlined"
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>Number of Images</InputLabel>
              <Select
                value={numImages}
                label="Number of Images"
                onChange={(e) => setNumImages(e.target.value)}
              >
                <MenuItem value={2}>2 Images</MenuItem>
                <MenuItem value={3}>3 Images</MenuItem>
                <MenuItem value={4}>4 Images</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <Button
              fullWidth
              variant="contained"
              size="large"
              onClick={generateImages}
              disabled={loading || !prompt.trim()}
              startIcon={loading ? <CircularProgress size={20} /> : <RefreshIcon />}
            >
              {loading ? 'Generating...' : 'Generate Images'}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Generation Stats */}
      {generationStats && (
        <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Typography variant="h6">
              Generated {generationStats.generated} of {generationStats.requested} images
            </Typography>
            {images.length > 0 && (
              <Button
                variant="outlined"
                startIcon={<GetAppIcon />}
                onClick={downloadAllImages}
                size="small"
              >
                Download All
              </Button>
            )}
            {images.length > 0 && (
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={regenerateImages}
                size="small"
              >
                Regenerate
              </Button>
            )}
          </Box>
        </Paper>
      )}

      {/* Loading State with Progress */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <Box sx={{ textAlign: 'center' }}>
            <CircularProgress size={60} />
            <Typography variant="body1" sx={{ mt: 2 }}>
              Generating {numImages} images in a single optimized API call...
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              This should take about 30-60 seconds.
            </Typography>
          </Box>
        </Box>
      )}

      {/* Tabbed Interface for Generated Images */}
      {images.length > 0 && (
        <Box>
          <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
            Generated Variations ({images.length})
          </Typography>
          
          {/* Tab Headers */}
          <Paper elevation={2} sx={{ mb: 3 }}>
            <Tabs 
              value={selectedTab} 
              onChange={handleTabChange} 
              variant="scrollable"
              scrollButtons="auto"
              sx={{ borderBottom: 1, borderColor: 'divider' }}
            >
              {images.map((image, index) => (
                <Tab 
                  key={image.id}
                  label={`Variation ${index + 1}`} 
                  id={`image-tab-${index}`}
                  aria-controls={`image-tabpanel-${index}`}
                />
              ))}
            </Tabs>
          </Paper>

          {/* Tab Content */}
          {images.map((image, index) => (
            <TabPanel key={image.id} value={selectedTab} index={index}>
              <Grid container spacing={4}>
                {/* Image Display */}
                <Grid item xs={12} md={6}>
                  <Card elevation={3}>
                    <CardMedia
                      component="img"
                      image={image.data_url}
                      alt={`Generated UI Variation ${index + 1}`}
                      sx={{ 
                        width: '100%',
                        height: 'auto',
                        maxHeight: '500px',
                        objectFit: 'contain'
                      }}
                    />
                    <CardActions sx={{ justifyContent: 'space-between', p: 2 }}>
                      <Chip 
                        label={`Variation ${index + 1}`} 
                        color="primary" 
                        variant="outlined"
                      />
                      <Tooltip title="Download Image">
                        <IconButton
                          color="primary"
                          onClick={() => downloadImage(image)}
                        >
                          <DownloadIcon />
                        </IconButton>
                      </Tooltip>
                    </CardActions>
                  </Card>
                </Grid>

                {/* Specifications Panel */}
                <Grid item xs={12} md={6}>
                  <Box sx={{ height: '100%' }}>
                    {/* UI Description Accordion */}
                    <Accordion defaultExpanded>
                      <AccordionSummary
                        expandIcon={<ExpandMoreIcon />}
                        aria-controls={`description-content-${index}`}
                        id={`description-header-${index}`}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <DescriptionIcon color="primary" />
                          <Typography variant="h6">
                            UI Description
                          </Typography>
                          {loadingDescriptions && (
                            <CircularProgress size={16} />
                          )}
                        </Box>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Paper 
                          variant="outlined" 
                          sx={{ 
                            p: 2, 
                            maxHeight: '300px', 
                            overflow: 'auto',
                            backgroundColor: '#fafafa'
                          }}
                        >
                          {loadingDescriptions ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                              <CircularProgress size={20} />
                              <Typography>Generating description...</Typography>
                            </Box>
                          ) : (
                            <ReactMarkdown>
                              {getDescriptionForImage(image.id).description}
                            </ReactMarkdown>
                          )}
                        </Paper>
                      </AccordionDetails>
                    </Accordion>

                    <Divider sx={{ my: 2 }} />

                    {/* Figma Components Accordion */}
                    <Accordion>
                      <AccordionSummary
                        expandIcon={<ExpandMoreIcon />}
                        aria-controls={`components-content-${index}`}
                        id={`components-header-${index}`}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <CodeIcon color="secondary" />
                          <Typography variant="h6">
                            Figma Component Specifications
                          </Typography>
                          {loadingComponents && (
                            <CircularProgress size={16} />
                          )}
                        </Box>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Paper 
                          variant="outlined" 
                          sx={{ 
                            p: 2, 
                            maxHeight: '300px', 
                            overflow: 'auto',
                            backgroundColor: '#f5f5f5'
                          }}
                        >
                          {loadingComponents ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                              <CircularProgress size={20} />
                              <Typography>Generating component specifications...</Typography>
                            </Box>
                          ) : (
                            <ReactMarkdown>
                              {getComponentsForImage(image.id).components}
                            </ReactMarkdown>
                          )}
                        </Paper>
                      </AccordionDetails>
                    </Accordion>
                  </Box>
                </Grid>
              </Grid>
            </TabPanel>
          ))}
        </Box>
      )}

      {/* Empty State */}
      {!loading && images.length === 0 && !error && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No images generated yet
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Enter a prompt and click "Generate Images" to create multiple UI mockups with descriptions and Figma specifications
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default MultipleImageGenerator;
