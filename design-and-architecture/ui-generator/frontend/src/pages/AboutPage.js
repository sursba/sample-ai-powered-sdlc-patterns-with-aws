import React from 'react';
import { 
  Container, 
  Typography, 
  Box, 
  Paper, 
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import DesignServicesIcon from '@mui/icons-material/DesignServices';
import IntegrationInstructionsIcon from '@mui/icons-material/IntegrationInstructions';
import AccessibilityNewIcon from '@mui/icons-material/AccessibilityNew';
import SpeedIcon from '@mui/icons-material/Speed';

const AboutPage = () => {
  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom align="center">
          About UI/UX Generator
        </Typography>
        <Typography variant="subtitle1" align="center" color="text.secondary" paragraph>
          Learn how our AI-powered design tool works and how it can help you create beautiful interfaces
        </Typography>
        
        <Grid container spacing={4} sx={{ mt: 2 }}>
          <Grid item xs={12} md={6}>
            <Paper elevation={2} sx={{ p: 3, height: '100%' }}>
              <Typography variant="h5" component="h2" gutterBottom>
                How It Works
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Typography paragraph>
                Our UI/UX Generator uses Amazon Bedrock's powerful AI models to transform your text descriptions into 
                comprehensive design assets. The process works in three steps:
              </Typography>
              
              <List>
                <ListItem>
                  <ListItemIcon>
                    <AutoAwesomeIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="1. Text Analysis" 
                    secondary="Your description is analyzed to understand design requirements, style preferences, and functionality needs."
                  />
                </ListItem>
                
                <ListItem>
                  <ListItemIcon>
                    <DesignServicesIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="2. Design Generation" 
                    secondary="Amazon Nova Canvas generates visual mockups while Claude AI creates detailed specifications and component descriptions."
                  />
                </ListItem>
                
                <ListItem>
                  <ListItemIcon>
                    <IntegrationInstructionsIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="3. Implementation Resources" 
                    secondary="The system provides you with all the resources needed to implement the design in Figma and code."
                  />
                </ListItem>
              </List>
            </Paper>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Paper elevation={2} sx={{ p: 3, height: '100%' }}>
              <Typography variant="h5" component="h2" gutterBottom>
                Benefits
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <List>
                <ListItem>
                  <ListItemIcon>
                    <SpeedIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Speed Up Your Design Process" 
                    secondary="Generate initial designs in minutes instead of hours or days."
                  />
                </ListItem>
                
                <ListItem>
                  <ListItemIcon>
                    <AutoAwesomeIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Explore Multiple Options" 
                    secondary="Quickly generate different design approaches to find the best solution."
                  />
                </ListItem>
                
                <ListItem>
                  <ListItemIcon>
                    <AccessibilityNewIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Accessibility Built In" 
                    secondary="Our AI considers accessibility best practices when generating designs."
                  />
                </ListItem>
                
                <ListItem>
                  <ListItemIcon>
                    <DesignServicesIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Complete Design System" 
                    secondary="Get not just mockups but complete component specifications for implementation."
                  />
                </ListItem>
              </List>
            </Paper>
          </Grid>
          
          <Grid item xs={12}>
            <Paper elevation={2} sx={{ p: 3 }}>
              <Typography variant="h5" component="h2" gutterBottom>
                Current Implementation
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <Typography variant="h6" gutterBottom>
                    AI & Machine Learning
                  </Typography>
                  <List dense>
                    <ListItem>
                      <ListItemText primary="Amazon Bedrock" secondary="Foundation model service" />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="Claude 3 Sonnet" secondary="Text generation and analysis (with fallback options)" />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="Amazon Nova Canvas" secondary="Image generation" />
                    </ListItem>
                  </List>
                </Grid>
                
                <Grid item xs={12} md={4}>
                  <Typography variant="h6" gutterBottom>
                    Backend
                  </Typography>
                  <List dense>
                    <ListItem>
                      <ListItemText primary="Python" secondary="Core programming language" />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="AWS Lambda" secondary="Serverless compute" />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="API Gateway" secondary="RESTful API endpoints" />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="Boto3" secondary="AWS SDK for Python" />
                    </ListItem>
                  </List>
                </Grid>
                
                <Grid item xs={12} md={4}>
                  <Typography variant="h6" gutterBottom>
                    Frontend
                  </Typography>
                  <List dense>
                    <ListItem>
                      <ListItemText primary="React" secondary="UI library" />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="Material UI" secondary="Component library" />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="React Router" secondary="Navigation" />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="Axios" secondary="HTTP client" />
                    </ListItem>
                  </List>
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          <Grid item xs={12}>
            <Paper elevation={2} sx={{ p: 3 }}>
              <Typography variant="h5" component="h2" gutterBottom>
                How to Use
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <List>
                <ListItem>
                  <ListItemIcon>
                    <AutoAwesomeIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="1. Enter Your Design Description" 
                    secondary="Provide a detailed description of the UI/UX you want to create. The more specific you are, the better the results will be."
                  />
                </ListItem>
                
                <ListItem>
                  <ListItemIcon>
                    <DesignServicesIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="2. Adjust Parameters (Optional)" 
                    secondary="You can customize the image dimensions and quality settings to suit your needs."
                  />
                </ListItem>
                
                <ListItem>
                  <ListItemIcon>
                    <IntegrationInstructionsIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="3. Generate Design" 
                    secondary="Click the 'Generate Design' button and wait for the AI to create your mockup, description, and component specifications."
                  />
                </ListItem>

                <ListItem>
                  <ListItemIcon>
                    <SpeedIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="4. Use the Results" 
                    secondary="Download the generated mockup image and use the specifications to implement your design in Figma or your preferred design tool."
                  />
                </ListItem>
              </List>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
};

export default AboutPage;