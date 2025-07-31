import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Grid,
  Card,
  CardMedia,
  CardContent,
  Button,
  CardActions,
  Chip,
  IconButton,
  Tooltip,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  Download as DownloadIcon,
  ContentCopy as ContentCopyIcon,
  GetApp as GetAppIcon,
  ExpandMore as ExpandMoreIcon,
  Description as DescriptionIcon,
  Code as CodeIcon
} from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import api from '../services/api';

const SimpleResults = ({ mockupResult, multipleImagesResult, descriptionResult, componentsResult }) => {
  const [selectedTab, setSelectedTab] = useState(0);
  const [imageDescriptions, setImageDescriptions] = useState([]);
  const [imageComponents, setImageComponents] = useState([]);
  const [loadingDescriptions, setLoadingDescriptions] = useState(false);
  const [loadingComponents, setLoadingComponents] = useState(false);

  // Generate descriptions and components for each image when multipleImagesResult changes
  useEffect(() => {
    if (multipleImagesResult && multipleImagesResult.success && multipleImagesResult.images) {
      generatePerImageContent(multipleImagesResult.images);
    }
  }, [multipleImagesResult]);

  const generatePerImageContent = async (images) => {
    setLoadingDescriptions(true);
    setLoadingComponents(true);

    try {
      // Generate descriptions for each image
      const descriptionPromises = images.map(async (image, index) => {
        try {
          const prompt = `Generate a detailed UI/UX description for variation ${index + 1} of ${images.length} UI mockup variations. Focus on the specific design elements, layout, and user experience aspects visible in this particular variation.`;
          const result = await api.generateDescription(prompt);
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
      setImageDescriptions(descriptions);
      setLoadingDescriptions(false);

      // Generate components for each image
      const componentPromises = images.map(async (image, index) => {
        try {
          const prompt = `Generate detailed Figma component specifications for variation ${index + 1} of ${images.length} UI mockup variations. Provide specific component details, dimensions, colors, typography, and auto layout settings for this particular design variation.`;
          const result = await api.generateComponents(prompt);
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
      setImageComponents(components);
      setLoadingComponents(false);

    } catch (err) {
      console.error('Error generating per-image content:', err);
      setLoadingDescriptions(false);
      setLoadingComponents(false);
    }
  };

  // Handle copy text to clipboard
  const handleCopyText = (text) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  // Handle single image download
  const handleDownloadImage = () => {
    if (mockupResult && mockupResult.image) {
      const link = document.createElement('a');
      link.href = `data:image/png;base64,${mockupResult.image}`;
      link.download = mockupResult.filename || 'ui-mockup.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Handle multiple image download
  const downloadImage = async (image) => {
    try {
      await api.downloadImage(image.filename);
    } catch (err) {
      console.error('Error downloading image:', err);
      alert(`Failed to download ${image.filename}`);
    }
  };

  const downloadAllImages = async () => {
    if (!multipleImagesResult?.images) return;
    
    for (let i = 0; i < multipleImagesResult.images.length; i++) {
      try {
        await api.downloadImage(multipleImagesResult.images[i].filename);
        // Add delay between downloads to avoid overwhelming the browser
        if (i < multipleImagesResult.images.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (err) {
        console.error(`Error downloading image ${multipleImagesResult.images[i].filename}:`, err);
      }
    }
  };

  const handleTabChange = (event, newValue) => {
    setSelectedTab(newValue);
  };

  const getDescriptionForImage = (imageId) => {
    const desc = imageDescriptions.find(d => d.imageId === imageId);
    return desc || { description: 'Loading...', success: false };
  };

  const getComponentsForImage = (imageId) => {
    const comp = imageComponents.find(c => c.imageId === imageId);
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

  // If no results, don't render anything
  if (!mockupResult && !multipleImagesResult && !descriptionResult && !componentsResult) {
    return null;
  }

  return (
    <Paper elevation={3} sx={{ p: 3, mt: 4 }}>
      <Typography variant="h5" component="h2" gutterBottom>
        Generated Results
      </Typography>

      {/* Single UI Mockup Section */}
      {mockupResult && mockupResult.success && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            UI Mockup
          </Typography>
          <Card>
            {mockupResult.image && (
              <CardMedia
                component="img"
                image={`data:image/png;base64,${mockupResult.image}`}
                alt="Generated UI Mockup"
                sx={{ maxHeight: '600px', objectFit: 'contain' }}
              />
            )}
            <CardContent>
              <Button 
                variant="contained" 
                startIcon={<DownloadIcon />}
                onClick={handleDownloadImage}
                sx={{ mr: 2 }}
              >
                Download Image
              </Button>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Multiple UI Mockups Section with Tabs */}
      {multipleImagesResult && multipleImagesResult.success && multipleImagesResult.images && (
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6">
              UI Mockup Variations ({multipleImagesResult.images.length})
            </Typography>
            <Button
              variant="outlined"
              startIcon={<GetAppIcon />}
              onClick={downloadAllImages}
              size="small"
            >
              Download All
            </Button>
          </Box>

          {/* Tab Headers */}
          <Paper elevation={2} sx={{ mb: 3 }}>
            <Tabs 
              value={selectedTab} 
              onChange={handleTabChange} 
              variant="scrollable"
              scrollButtons="auto"
              sx={{ borderBottom: 1, borderColor: 'divider' }}
            >
              {multipleImagesResult.images.map((image, index) => (
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
          {multipleImagesResult.images.map((image, index) => (
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
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                          <Button 
                            variant="outlined" 
                            size="small"
                            startIcon={<ContentCopyIcon />}
                            onClick={() => handleCopyText(getDescriptionForImage(image.id).description)}
                            disabled={loadingDescriptions}
                          >
                            Copy
                          </Button>
                        </Box>
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
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                          <Button 
                            variant="outlined" 
                            size="small"
                            startIcon={<ContentCopyIcon />}
                            onClick={() => handleCopyText(getComponentsForImage(image.id).components)}
                            disabled={loadingComponents}
                          >
                            Copy
                          </Button>
                          <Button 
                            variant="outlined" 
                            size="small"
                            color="secondary"
                            href="https://www.figma.com/file/new?type=design"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Open Figma
                          </Button>
                        </Box>
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

      {/* Single Mode UI Description Section */}
      {!multipleImagesResult && descriptionResult && (descriptionResult.success ? (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            UI Description
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Button 
              variant="outlined" 
              startIcon={<ContentCopyIcon />}
              onClick={() => handleCopyText(descriptionResult.description)}
            >
              Copy Text
            </Button>
          </Box>
          <Box sx={{ 
            p: 2, 
            border: '1px solid #e0e0e0', 
            borderRadius: 1,
            bgcolor: '#f9f9f9',
            maxHeight: '500px',
            overflow: 'auto'
          }}>
            <ReactMarkdown>{descriptionResult.description}</ReactMarkdown>
          </Box>
        </Box>
      ) : (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            UI Description
          </Typography>
          <Alert severity="error">
            {descriptionResult?.error || "No description generated yet."}
          </Alert>
        </Box>
      ))}

      {/* Single Mode Figma Components Section */}
      {!multipleImagesResult && componentsResult && (componentsResult.success ? (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            Figma Components Specification
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2, gap: 1 }}>
            <Button 
              variant="outlined" 
              startIcon={<ContentCopyIcon />}
              onClick={() => handleCopyText(componentsResult.components)}
            >
              Copy All
            </Button>
            <Button 
              variant="outlined" 
              color="secondary"
              href="https://www.figma.com/file/new?type=design"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open Figma
            </Button>
          </Box>
          <Box sx={{ 
            p: 2, 
            border: '1px solid #e0e0e0', 
            borderRadius: 1,
            bgcolor: '#f9f9f9',
            maxHeight: '700px',
            overflow: 'auto'
          }}>
            <Typography variant="subtitle2" color="primary" gutterBottom>
              These specifications can be directly implemented in Figma's properties panel
            </Typography>
            <Typography variant="caption" color="text.secondary" paragraph>
              Includes 8-10 key components with detailed specifications and component hierarchy
            </Typography>
            <ReactMarkdown>{componentsResult.components}</ReactMarkdown>
          </Box>
        </Box>
      ) : (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            Figma Components Specification
          </Typography>
          <Alert severity="error">
            {componentsResult?.error || "No components generated yet."}
          </Alert>
        </Box>
      ))}
    </Paper>
  );
};

export default SimpleResults;
