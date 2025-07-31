import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material';
import MultipleImageGenerator from '../../components/MultipleImageGenerator';

const theme = createTheme();

const mockApi = {
  generateMultipleMockups: jest.fn(),
  downloadImage: jest.fn()
};

// Mock the API service
jest.mock('../../services/api', () => mockApi);

const renderMultipleImageGenerator = (props = {}) => {
  return render(
    <ThemeProvider theme={theme}>
      <MultipleImageGenerator {...props} />
    </ThemeProvider>
  );
};

describe('MultipleImageGenerator Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.open = jest.fn();
  });

  test('renders form elements correctly', () => {
    renderMultipleImageGenerator();
    
    expect(screen.getByLabelText(/describe your ui design/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/number of images/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/width/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/height/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /generate multiple designs/i })).toBeInTheDocument();
  });

  test('has default values for form inputs', () => {
    renderMultipleImageGenerator();
    
    expect(screen.getByLabelText(/number of images/i)).toHaveValue(4);
    expect(screen.getByLabelText(/width/i)).toHaveValue(1024);
    expect(screen.getByLabelText(/height/i)).toHaveValue(1024);
  });

  test('allows user to change number of images', async () => {
    const user = userEvent.setup();
    renderMultipleImageGenerator();
    
    const numImagesInput = screen.getByLabelText(/number of images/i);
    await user.clear(numImagesInput);
    await user.type(numImagesInput, '6');
    
    expect(numImagesInput).toHaveValue(6);
  });

  test('validates number of images within range', async () => {
    const user = userEvent.setup();
    renderMultipleImageGenerator();
    
    const numImagesInput = screen.getByLabelText(/number of images/i);
    
    // Test minimum value
    await user.clear(numImagesInput);
    await user.type(numImagesInput, '1');
    expect(numImagesInput).toHaveValue(1);
    
    // Test maximum value
    await user.clear(numImagesInput);
    await user.type(numImagesInput, '8');
    expect(numImagesInput).toHaveValue(8);
  });

  test('submits form with correct data', async () => {
    const user = userEvent.setup();
    mockApi.generateMultipleMockups.mockResolvedValue({
      success: true,
      images: [
        { filename: 'image1.png', image_url: 'http://localhost:8000/api/assets/image1.png' },
        { filename: 'image2.png', image_url: 'http://localhost:8000/api/assets/image2.png' }
      ]
    });

    renderMultipleImageGenerator();
    
    const promptInput = screen.getByLabelText(/describe your ui design/i);
    const submitButton = screen.getByRole('button', { name: /generate multiple designs/i });
    
    await user.type(promptInput, 'Create a modern dashboard');
    await user.click(submitButton);
    
    expect(mockApi.generateMultipleMockups).toHaveBeenCalledWith(
      'Create a modern dashboard',
      4,
      1024,
      1024,
      'standard'
    );
  });

  test('shows loading state during generation', async () => {
    const user = userEvent.setup();
    mockApi.generateMultipleMockups.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({ success: true, images: [] }), 100))
    );

    renderMultipleImageGenerator();
    
    const promptInput = screen.getByLabelText(/describe your ui design/i);
    const submitButton = screen.getByRole('button', { name: /generate multiple designs/i });
    
    await user.type(promptInput, 'Test prompt');
    await user.click(submitButton);
    
    expect(screen.getByText(/generating/i)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.queryByText(/generating/i)).not.toBeInTheDocument();
    });
  });

  test('displays generated images', async () => {
    const user = userEvent.setup();
    const mockImages = [
      { filename: 'image1.png', image_url: 'http://localhost:8000/api/assets/image1.png' },
      { filename: 'image2.png', image_url: 'http://localhost:8000/api/assets/image2.png' }
    ];

    mockApi.generateMultipleMockups.mockResolvedValue({
      success: true,
      images: mockImages
    });

    renderMultipleImageGenerator();
    
    const promptInput = screen.getByLabelText(/describe your ui design/i);
    const submitButton = screen.getByRole('button', { name: /generate multiple designs/i });
    
    await user.type(promptInput, 'Test prompt');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(/generated designs/i)).toBeInTheDocument();
    });

    // Check if images are displayed
    const images = screen.getAllByRole('img');
    expect(images).toHaveLength(2);
    expect(images[0]).toHaveAttribute('src', mockImages[0].image_url);
    expect(images[1]).toHaveAttribute('src', mockImages[1].image_url);
  });

  test('handles API errors gracefully', async () => {
    const user = userEvent.setup();
    mockApi.generateMultipleMockups.mockResolvedValue({
      success: false,
      error: 'Failed to generate images'
    });

    renderMultipleImageGenerator();
    
    const promptInput = screen.getByLabelText(/describe your ui design/i);
    const submitButton = screen.getByRole('button', { name: /generate multiple designs/i });
    
    await user.type(promptInput, 'Test prompt');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(/failed to generate images/i)).toBeInTheDocument();
    });
  });

  test('download functionality works for individual images', async () => {
    const user = userEvent.setup();
    const mockImages = [
      { filename: 'image1.png', image_url: 'http://localhost:8000/api/assets/image1.png' }
    ];

    mockApi.generateMultipleMockups.mockResolvedValue({
      success: true,
      images: mockImages
    });

    mockApi.downloadImage.mockResolvedValue({ success: true });

    renderMultipleImageGenerator();
    
    const promptInput = screen.getByLabelText(/describe your ui design/i);
    const submitButton = screen.getByRole('button', { name: /generate multiple designs/i });
    
    await user.type(promptInput, 'Test prompt');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(/generated designs/i)).toBeInTheDocument();
    });

    const downloadButton = screen.getByText(/download/i);
    await user.click(downloadButton);
    
    expect(mockApi.downloadImage).toHaveBeenCalledWith('image1.png');
  });

  test('open in new tab functionality works', async () => {
    const user = userEvent.setup();
    const mockImages = [
      { filename: 'image1.png', image_url: 'http://localhost:8000/api/assets/image1.png' }
    ];

    mockApi.generateMultipleMockups.mockResolvedValue({
      success: true,
      images: mockImages
    });

    renderMultipleImageGenerator();
    
    const promptInput = screen.getByLabelText(/describe your ui design/i);
    const submitButton = screen.getByRole('button', { name: /generate multiple designs/i });
    
    await user.type(promptInput, 'Test prompt');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(/generated designs/i)).toBeInTheDocument();
    });

    const openButton = screen.getByText(/open/i);
    await user.click(openButton);
    
    expect(global.open).toHaveBeenCalledWith(mockImages[0].image_url, '_blank');
  });

  test('prevents submission with empty prompt', async () => {
    const user = userEvent.setup();
    renderMultipleImageGenerator();
    
    const submitButton = screen.getByRole('button', { name: /generate multiple designs/i });
    await user.click(submitButton);
    
    expect(mockApi.generateMultipleMockups).not.toHaveBeenCalled();
  });

  test('form is disabled during loading', async () => {
    const user = userEvent.setup();
    mockApi.generateMultipleMockups.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({ success: true, images: [] }), 100))
    );

    renderMultipleImageGenerator();
    
    const promptInput = screen.getByLabelText(/describe your ui design/i);
    const submitButton = screen.getByRole('button', { name: /generate multiple designs/i });
    
    await user.type(promptInput, 'Test prompt');
    await user.click(submitButton);
    
    // Check that form elements are disabled during loading
    expect(screen.getByLabelText(/describe your ui design/i)).toBeDisabled();
    expect(screen.getByLabelText(/number of images/i)).toBeDisabled();
    expect(screen.getByLabelText(/width/i)).toBeDisabled();
    expect(screen.getByLabelText(/height/i)).toBeDisabled();
    
    await waitFor(() => {
      expect(screen.queryByText(/generating/i)).not.toBeInTheDocument();
    });
  });

  test('displays progress information during generation', async () => {
    const user = userEvent.setup();
    mockApi.generateMultipleMockups.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({ success: true, images: [] }), 100))
    );

    renderMultipleImageGenerator();
    
    const promptInput = screen.getByLabelText(/describe your ui design/i);
    const submitButton = screen.getByRole('button', { name: /generate multiple designs/i });
    
    await user.type(promptInput, 'Test prompt');
    await user.click(submitButton);
    
    expect(screen.getByText(/generating multiple ui designs/i)).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.queryByText(/generating multiple ui designs/i)).not.toBeInTheDocument();
    });
  });

  test('handles network errors during download', async () => {
    const user = userEvent.setup();
    const mockImages = [
      { filename: 'image1.png', image_url: 'http://localhost:8000/api/assets/image1.png' }
    ];

    mockApi.generateMultipleMockups.mockResolvedValue({
      success: true,
      images: mockImages
    });

    mockApi.downloadImage.mockResolvedValue({
      success: false,
      error: 'Download failed'
    });

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    renderMultipleImageGenerator();
    
    const promptInput = screen.getByLabelText(/describe your ui design/i);
    const submitButton = screen.getByRole('button', { name: /generate multiple designs/i });
    
    await user.type(promptInput, 'Test prompt');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(/generated designs/i)).toBeInTheDocument();
    });

    const downloadButton = screen.getByText(/download/i);
    await user.click(downloadButton);
    
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
    });

    consoleSpy.mockRestore();
  });
});
