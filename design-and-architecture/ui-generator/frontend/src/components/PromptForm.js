import React, { useState } from 'react';
import { 
  Box, 
  TextField, 
  Button, 
  Typography, 
  Paper, 
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  CircularProgress,
  Tooltip,
  FormControlLabel,
  Switch,
  Divider
} from '@mui/material';

const PromptForm = ({ onSubmit, onMultipleSubmit, isLoading, disabled }) => {
  const [prompt, setPrompt] = useState('');
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);
  const [quality, setQuality] = useState('standard');
  const [multipleMode, setMultipleMode] = useState(false);
  const [numImages, setNumImages] = useState(2);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (multipleMode && onMultipleSubmit) {
      onMultipleSubmit({ prompt, width, height, quality, numImages });
    } else {
      onSubmit({ prompt, width, height, quality });
    }
  };

  return (
    <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
      <Typography variant="h5" component="h2" gutterBottom>
        Generate UI/UX Design
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Describe the UI/UX you want to create. Be as specific as possible about the purpose, style, and components needed.
      </Typography>
      
      <form onSubmit={handleSubmit}>
        <TextField
          fullWidth
          label="Describe your UI/UX needs"
          multiline
          rows={4}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="E.g., Create a modern e-commerce product page with a large product image gallery, detailed product description, pricing information, color/size selectors, and prominent add to cart button."
          required
          sx={{ mb: 3 }}
          disabled={disabled || isLoading}
        />
        
        {/* Multiple Images Toggle */}
        <Box sx={{ mb: 3 }}>
          <FormControlLabel
            control={
              <Switch
                checked={multipleMode}
                onChange={(e) => setMultipleMode(e.target.checked)}
                disabled={disabled || isLoading}
              />
            }
            label="Generate multiple variations"
          />
          <Typography variant="body2" color="text.secondary" sx={{ ml: 4 }}>
            Generate multiple design variations to explore different possibilities
          </Typography>
        </Box>

        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={multipleMode ? 3 : 4}>
            <FormControl fullWidth disabled={disabled || isLoading}>
              <InputLabel>Quality</InputLabel>
              <Select
                value={quality}
                label="Quality"
                onChange={(e) => setQuality(e.target.value)}
              >
                <MenuItem value="standard">Standard</MenuItem>
                <MenuItem value="premium">Premium</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          {multipleMode && (
            <Grid item xs={12} md={3}>
              <FormControl fullWidth disabled={disabled || isLoading}>
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
          )}
          
          <Grid item xs={12} md={multipleMode ? 3 : 4}>
            <Typography gutterBottom>Width: {width}px</Typography>
            <Slider
              value={width}
              min={512}
              max={1536}
              step={128}
              onChange={(e, newValue) => setWidth(newValue)}
              valueLabelDisplay="auto"
              disabled={disabled || isLoading}
            />
          </Grid>
          
          <Grid item xs={12} md={multipleMode ? 3 : 4}>
            <Typography gutterBottom>Height: {height}px</Typography>
            <Slider
              value={height}
              min={512}
              max={1536}
              step={128}
              onChange={(e, newValue) => setHeight(newValue)}
              valueLabelDisplay="auto"
              disabled={disabled || isLoading}
            />
          </Grid>
        </Grid>
        
        <Tooltip title={disabled ? "AWS configuration required before generating designs" : ""}>
          <span>
            <Button 
              type="submit" 
              variant="contained" 
              color="primary" 
              size="large"
              disabled={isLoading || !prompt.trim() || disabled}
              startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : null}
            >
              {isLoading 
                ? 'Generating...' 
                : multipleMode 
                  ? `Generate ${numImages} Variations` 
                  : 'Generate Design'
              }
            </Button>
          </span>
        </Tooltip>
      </form>
    </Paper>
  );
};

export default PromptForm;
