import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import AboutPage from '../../pages/AboutPage';

const theme = createTheme();

const renderAboutPage = () => {
  return render(
    <ThemeProvider theme={theme}>
      <AboutPage />
    </ThemeProvider>
  );
};

describe('AboutPage Component', () => {
  test('renders page title', () => {
    renderAboutPage();
    expect(screen.getByText(/about ui\/ux generator/i)).toBeInTheDocument();
  });

  test('renders main description', () => {
    renderAboutPage();
    expect(screen.getByText(/powerful application that leverages/i)).toBeInTheDocument();
  });

  test('renders features section', () => {
    renderAboutPage();
    expect(screen.getByText(/features/i)).toBeInTheDocument();
    expect(screen.getByText(/ai-powered ui mockup generation/i)).toBeInTheDocument();
    expect(screen.getByText(/detailed ui\/ux specifications/i)).toBeInTheDocument();
    expect(screen.getByText(/figma component specifications/i)).toBeInTheDocument();
  });

  test('renders technology stack section', () => {
    renderAboutPage();
    expect(screen.getByText(/technology stack/i)).toBeInTheDocument();
    expect(screen.getByText(/frontend/i)).toBeInTheDocument();
    expect(screen.getByText(/backend/i)).toBeInTheDocument();
    expect(screen.getByText(/ai models/i)).toBeInTheDocument();
  });

  test('renders AWS services section', () => {
    renderAboutPage();
    expect(screen.getByText(/aws services/i)).toBeInTheDocument();
    expect(screen.getByText(/amazon bedrock/i)).toBeInTheDocument();
    expect(screen.getByText(/aws lambda/i)).toBeInTheDocument();
    expect(screen.getByText(/amazon s3/i)).toBeInTheDocument();
  });

  test('renders how it works section', () => {
    renderAboutPage();
    expect(screen.getByText(/how it works/i)).toBeInTheDocument();
    expect(screen.getByText(/1\./)).toBeInTheDocument();
    expect(screen.getByText(/2\./)).toBeInTheDocument();
    expect(screen.getByText(/3\./)).toBeInTheDocument();
  });

  test('renders use cases section', () => {
    renderAboutPage();
    expect(screen.getByText(/use cases/i)).toBeInTheDocument();
    expect(screen.getByText(/rapid prototyping/i)).toBeInTheDocument();
    expect(screen.getByText(/design inspiration/i)).toBeInTheDocument();
    expect(screen.getByText(/client presentations/i)).toBeInTheDocument();
  });

  test('renders getting started section', () => {
    renderAboutPage();
    expect(screen.getByText(/getting started/i)).toBeInTheDocument();
    expect(screen.getByText(/simply describe/i)).toBeInTheDocument();
  });

  test('has proper heading hierarchy', () => {
    renderAboutPage();
    
    // Main title should be h1
    expect(screen.getByRole('heading', { level: 1, name: /about ui\/ux generator/i })).toBeInTheDocument();
    
    // Section headings should be h2
    expect(screen.getByRole('heading', { level: 2, name: /features/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /technology stack/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /aws services/i })).toBeInTheDocument();
  });

  test('contains feature icons', () => {
    renderAboutPage();
    
    // Check for Material-UI icons (they should be present as SVG elements)
    const icons = screen.getAllByTestId(/.*icon/i);
    expect(icons.length).toBeGreaterThan(0);
  });

  test('renders feature descriptions with proper formatting', () => {
    renderAboutPage();
    
    expect(screen.getByText(/create visual mockups from text descriptions/i)).toBeInTheDocument();
    expect(screen.getByText(/generate comprehensive design specifications/i)).toBeInTheDocument();
    expect(screen.getByText(/get precise component specifications/i)).toBeInTheDocument();
  });

  test('renders technology stack items', () => {
    renderAboutPage();
    
    expect(screen.getByText(/react/i)).toBeInTheDocument();
    expect(screen.getByText(/material-ui/i)).toBeInTheDocument();
    expect(screen.getByText(/python/i)).toBeInTheDocument();
    expect(screen.getByText(/flask/i)).toBeInTheDocument();
    expect(screen.getByText(/claude 3 sonnet/i)).toBeInTheDocument();
    expect(screen.getByText(/amazon nova canvas/i)).toBeInTheDocument();
  });

  test('renders AWS services descriptions', () => {
    renderAboutPage();
    
    expect(screen.getByText(/provides ai models for ui generation/i)).toBeInTheDocument();
    expect(screen.getByText(/serverless backend hosting/i)).toBeInTheDocument();
    expect(screen.getByText(/static website hosting/i)).toBeInTheDocument();
  });

  test('renders step-by-step instructions', () => {
    renderAboutPage();
    
    expect(screen.getByText(/enter a detailed description/i)).toBeInTheDocument();
    expect(screen.getByText(/ai generates visual mockup/i)).toBeInTheDocument();
    expect(screen.getByText(/receive comprehensive specifications/i)).toBeInTheDocument();
  });

  test('renders use case descriptions', () => {
    renderAboutPage();
    
    expect(screen.getByText(/quickly create mockups/i)).toBeInTheDocument();
    expect(screen.getByText(/explore different design approaches/i)).toBeInTheDocument();
    expect(screen.getByText(/create professional presentations/i)).toBeInTheDocument();
  });

  test('has proper semantic structure', () => {
    renderAboutPage();
    
    // Should have main content area
    const main = screen.getByRole('main') || document.querySelector('main');
    expect(main || screen.getByText(/about ui\/ux generator/i).closest('div')).toBeInTheDocument();
  });

  test('renders with Material-UI styling', () => {
    const { container } = renderAboutPage();
    
    // Check for Material-UI classes
    expect(container.querySelector('.MuiContainer-root')).toBeInTheDocument();
    expect(container.querySelector('.MuiTypography-root')).toBeInTheDocument();
  });

  test('is responsive and mobile-friendly', () => {
    renderAboutPage();
    
    // Check for responsive container
    const container = screen.getByText(/about ui\/ux generator/i).closest('.MuiContainer-root');
    expect(container).toBeInTheDocument();
  });

  test('renders all major sections', () => {
    renderAboutPage();
    
    const sections = [
      /features/i,
      /technology stack/i,
      /aws services/i,
      /how it works/i,
      /use cases/i,
      /getting started/i
    ];

    sections.forEach(section => {
      expect(screen.getByText(section)).toBeInTheDocument();
    });
  });

  test('contains proper spacing and layout', () => {
    const { container } = renderAboutPage();
    
    // Check for proper spacing classes
    expect(container.querySelector('[class*="spacing"]') || 
           container.querySelector('[class*="margin"]') ||
           container.querySelector('[class*="padding"]')).toBeTruthy();
  });

  test('renders without any console errors', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    renderAboutPage();
    
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
