import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material';
import SimpleResults from '../../components/SimpleResults';

const theme = createTheme();

const mockResults = {
  mockup: {
    success: true,
    image_url: 'http://localhost:8000/api/assets/test-image.png',
    filename: 'test-image.png'
  },
  description: {
    success: true,
    description: '# Test UI Description\n\nThis is a test description with **bold** text.'
  },
  components: {
    success: true,
    components: '# Component Specifications\n\n## Button Component\n\n- Color: #007bff\n- Size: 40px height'
  }
};

const renderSimpleResults = (props = {}) => {
  const defaultProps = {
    results: mockResults,
    loading: false,
    error: null,
    ...props
  };

  return render(
    <ThemeProvider theme={theme}>
      <SimpleResults {...defaultProps} />
    </ThemeProvider>
  );
};

describe('SimpleResults Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock window.open
    global.open = jest.fn();
  });

  test('renders loading state correctly', () => {
    renderSimpleResults({ loading: true, results: null });
    
    expect(screen.getByText(/generating your ui design/i)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  test('renders error state correctly', () => {
    const errorMessage = 'Failed to generate design';
    renderSimpleResults({ error: errorMessage, results: null });
    
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
    expect(screen.getByText(/error/i)).toBeInTheDocument();
  });

  test('renders results when available', () => {
    renderSimpleResults();
    
    expect(screen.getByText(/generated ui design/i)).toBeInTheDocument();
    expect(screen.getByAltText(/generated ui mockup/i)).toBeInTheDocument();
    expect(screen.getByText(/ui\/ux description/i)).toBeInTheDocument();
    expect(screen.getByText(/figma component specifications/i)).toBeInTheDocument();
  });

  test('displays mockup image with correct src', () => {
    renderSimpleResults();
    
    const image = screen.getByAltText(/generated ui mockup/i);
    expect(image).toHaveAttribute('src', mockResults.mockup.image_url);
  });

  test('renders markdown content correctly', () => {
    renderSimpleResults();
    
    // Check if markdown is rendered (bold text should be in strong tags)
    expect(screen.getByText('bold')).toBeInTheDocument();
    expect(screen.getByText('Test UI Description')).toBeInTheDocument();
    expect(screen.getByText('Component Specifications')).toBeInTheDocument();
  });

  test('download button works correctly', async () => {
    const user = userEvent.setup();
    
    // Mock the download functionality
    const mockDownload = jest.fn();
    global.URL.createObjectURL = jest.fn(() => 'mock-blob-url');
    global.URL.revokeObjectURL = jest.fn();
    
    // Mock fetch for download
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        blob: () => Promise.resolve(new Blob(['mock image data']))
      })
    );

    renderSimpleResults();
    
    const downloadButton = screen.getByText(/download image/i);
    await user.click(downloadButton);
    
    expect(global.fetch).toHaveBeenCalledWith(mockResults.mockup.image_url);
  });

  test('open in new tab button works correctly', async () => {
    const user = userEvent.setup();
    renderSimpleResults();
    
    const openButton = screen.getByText(/open in new tab/i);
    await user.click(openButton);
    
    expect(global.open).toHaveBeenCalledWith(mockResults.mockup.image_url, '_blank');
  });

  test('handles missing mockup gracefully', () => {
    const resultsWithoutMockup = {
      ...mockResults,
      mockup: { success: false, error: 'Failed to generate mockup' }
    };
    
    renderSimpleResults({ results: resultsWithoutMockup });
    
    expect(screen.queryByAltText(/generated ui mockup/i)).not.toBeInTheDocument();
    expect(screen.getByText(/failed to generate mockup/i)).toBeInTheDocument();
  });

  test('handles missing description gracefully', () => {
    const resultsWithoutDescription = {
      ...mockResults,
      description: { success: false, error: 'Failed to generate description' }
    };
    
    renderSimpleResults({ results: resultsWithoutDescription });
    
    expect(screen.getByText(/failed to generate description/i)).toBeInTheDocument();
  });

  test('handles missing components gracefully', () => {
    const resultsWithoutComponents = {
      ...mockResults,
      components: { success: false, error: 'Failed to generate components' }
    };
    
    renderSimpleResults({ results: resultsWithoutComponents });
    
    expect(screen.getByText(/failed to generate components/i)).toBeInTheDocument();
  });

  test('shows appropriate loading states for individual sections', () => {
    const partialResults = {
      mockup: { success: true, image_url: 'test.png', filename: 'test.png' },
      description: null, // Still loading
      components: null   // Still loading
    };
    
    renderSimpleResults({ results: partialResults, loading: true });
    
    expect(screen.getByAltText(/generated ui mockup/i)).toBeInTheDocument();
    expect(screen.getByText(/generating/i)).toBeInTheDocument();
  });

  test('image has proper accessibility attributes', () => {
    renderSimpleResults();
    
    const image = screen.getByAltText(/generated ui mockup/i);
    expect(image).toHaveAttribute('alt', 'Generated UI Mockup');
  });

  test('buttons have proper accessibility attributes', () => {
    renderSimpleResults();
    
    const downloadButton = screen.getByRole('button', { name: /download image/i });
    const openButton = screen.getByRole('button', { name: /open in new tab/i });
    
    expect(downloadButton).toBeInTheDocument();
    expect(openButton).toBeInTheDocument();
  });

  test('handles network errors during download', async () => {
    const user = userEvent.setup();
    
    // Mock fetch to reject
    global.fetch = jest.fn(() => Promise.reject(new Error('Network error')));
    
    // Mock console.error to avoid noise in tests
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    renderSimpleResults();
    
    const downloadButton = screen.getByText(/download image/i);
    await user.click(downloadButton);
    
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  test('renders with no results', () => {
    renderSimpleResults({ results: null });
    
    expect(screen.queryByText(/generated ui design/i)).not.toBeInTheDocument();
    expect(screen.queryByAltText(/generated ui mockup/i)).not.toBeInTheDocument();
  });

  test('tabs work correctly for switching between sections', async () => {
    const user = userEvent.setup();
    renderSimpleResults();
    
    // Check if tabs are present
    const descriptionTab = screen.getByText(/ui\/ux description/i);
    const componentsTab = screen.getByText(/figma component specifications/i);
    
    expect(descriptionTab).toBeInTheDocument();
    expect(componentsTab).toBeInTheDocument();
    
    // Click on components tab
    await user.click(componentsTab);
    
    // Should show components content
    expect(screen.getByText(/component specifications/i)).toBeInTheDocument();
  });
});
