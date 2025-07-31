import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material';
import HomePage from '../../pages/HomePage';

const theme = createTheme();

const mockApi = {
  generateMockup: jest.fn(),
  generateDescription: jest.fn(),
  generateComponents: jest.fn(),
  checkBedrockAccess: jest.fn()
};

// Mock the API service
jest.mock('../../services/api', () => mockApi);

const renderHomePage = () => {
  return render(
    <ThemeProvider theme={theme}>
      <HomePage />
    </ThemeProvider>
  );
};

describe('HomePage Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApi.checkBedrockAccess.mockResolvedValue({ success: true });
  });

  test('renders page title and description', () => {
    renderHomePage();
    
    expect(screen.getByText(/ui\/ux generator/i)).toBeInTheDocument();
    expect(screen.getByText(/create stunning ui designs/i)).toBeInTheDocument();
  });

  test('renders generation mode tabs', () => {
    renderHomePage();
    
    expect(screen.getByText(/single design/i)).toBeInTheDocument();
    expect(screen.getByText(/multiple designs/i)).toBeInTheDocument();
  });

  test('shows single design form by default', () => {
    renderHomePage();
    
    expect(screen.getByRole('button', { name: /generate design/i })).toBeInTheDocument();
  });

  test('switches to multiple designs mode', async () => {
    const user = userEvent.setup();
    renderHomePage();
    
    const multipleTab = screen.getByText(/multiple designs/i);
    await user.click(multipleTab);
    
    expect(screen.getByRole('button', { name: /generate multiple designs/i })).toBeInTheDocument();
  });

  test('checks Bedrock access on mount', async () => {
    renderHomePage();
    
    await waitFor(() => {
      expect(mockApi.checkBedrockAccess).toHaveBeenCalled();
    });
  });

  test('shows connection status indicator', async () => {
    renderHomePage();
    
    await waitFor(() => {
      expect(screen.getByText(/connected/i)).toBeInTheDocument();
    });
  });

  test('handles Bedrock access failure', async () => {
    mockApi.checkBedrockAccess.mockResolvedValue({
      success: false,
      error: 'Access denied'
    });

    renderHomePage();
    
    await waitFor(() => {
      expect(screen.getByText(/disconnected/i)).toBeInTheDocument();
    });
  });

  test('generates single design successfully', async () => {
    const user = userEvent.setup();
    
    mockApi.generateMockup.mockResolvedValue({
      success: true,
      image_url: 'http://localhost:8000/api/assets/test.png',
      filename: 'test.png'
    });

    mockApi.generateDescription.mockResolvedValue({
      success: true,
      description: 'Test description'
    });

    mockApi.generateComponents.mockResolvedValue({
      success: true,
      components: 'Test components'
    });

    renderHomePage();
    
    const promptInput = screen.getByLabelText(/describe your ui design/i);
    const submitButton = screen.getByRole('button', { name: /generate design/i });
    
    await user.type(promptInput, 'Create a modern login form');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(mockApi.generateMockup).toHaveBeenCalledWith(
        'Create a modern login form',
        1024,
        1024,
        'standard'
      );
    });

    await waitFor(() => {
      expect(mockApi.generateDescription).toHaveBeenCalledWith('Create a modern login form');
    });

    await waitFor(() => {
      expect(mockApi.generateComponents).toHaveBeenCalledWith('Create a modern login form');
    });
  });

  test('shows loading state during generation', async () => {
    const user = userEvent.setup();
    
    mockApi.generateMockup.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({
        success: true,
        image_url: 'test.png',
        filename: 'test.png'
      }), 100))
    );

    mockApi.generateDescription.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({
        success: true,
        description: 'Test'
      }), 100))
    );

    mockApi.generateComponents.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({
        success: true,
        components: 'Test'
      }), 100))
    );

    renderHomePage();
    
    const promptInput = screen.getByLabelText(/describe your ui design/i);
    const submitButton = screen.getByRole('button', { name: /generate design/i });
    
    await user.type(promptInput, 'Test prompt');
    await user.click(submitButton);
    
    expect(screen.getByText(/generating/i)).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.queryByText(/generating/i)).not.toBeInTheDocument();
    }, { timeout: 3000 });
  });

  test('handles generation errors gracefully', async () => {
    const user = userEvent.setup();
    
    mockApi.generateMockup.mockResolvedValue({
      success: false,
      error: 'Generation failed'
    });

    renderHomePage();
    
    const promptInput = screen.getByLabelText(/describe your ui design/i);
    const submitButton = screen.getByRole('button', { name: /generate design/i });
    
    await user.type(promptInput, 'Test prompt');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(/generation failed/i)).toBeInTheDocument();
    });
  });

  test('displays results after successful generation', async () => {
    const user = userEvent.setup();
    
    mockApi.generateMockup.mockResolvedValue({
      success: true,
      image_url: 'http://localhost:8000/api/assets/test.png',
      filename: 'test.png'
    });

    mockApi.generateDescription.mockResolvedValue({
      success: true,
      description: 'Test description'
    });

    mockApi.generateComponents.mockResolvedValue({
      success: true,
      components: 'Test components'
    });

    renderHomePage();
    
    const promptInput = screen.getByLabelText(/describe your ui design/i);
    const submitButton = screen.getByRole('button', { name: /generate design/i });
    
    await user.type(promptInput, 'Create a dashboard');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(/generated ui design/i)).toBeInTheDocument();
    });
  });

  test('maintains form state during generation', async () => {
    const user = userEvent.setup();
    
    mockApi.generateMockup.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({
        success: true,
        image_url: 'test.png',
        filename: 'test.png'
      }), 100))
    );

    renderHomePage();
    
    const promptInput = screen.getByLabelText(/describe your ui design/i);
    const widthInput = screen.getByLabelText(/width/i);
    
    await user.type(promptInput, 'Test prompt');
    await user.clear(widthInput);
    await user.type(widthInput, '800');
    
    const submitButton = screen.getByRole('button', { name: /generate design/i });
    await user.click(submitButton);
    
    // Form should maintain values during loading
    expect(screen.getByDisplayValue('Test prompt')).toBeInTheDocument();
    expect(screen.getByDisplayValue('800')).toBeInTheDocument();
  });

  test('allows switching between generation modes', async () => {
    const user = userEvent.setup();
    renderHomePage();
    
    // Start with single design
    expect(screen.getByRole('button', { name: /generate design/i })).toBeInTheDocument();
    
    // Switch to multiple designs
    const multipleTab = screen.getByText(/multiple designs/i);
    await user.click(multipleTab);
    
    expect(screen.getByRole('button', { name: /generate multiple designs/i })).toBeInTheDocument();
    
    // Switch back to single design
    const singleTab = screen.getByText(/single design/i);
    await user.click(singleTab);
    
    expect(screen.getByRole('button', { name: /generate design/i })).toBeInTheDocument();
  });

  test('shows appropriate error messages for different failure types', async () => {
    const user = userEvent.setup();
    
    // Test mockup generation failure
    mockApi.generateMockup.mockResolvedValue({
      success: false,
      error: 'Mockup generation failed'
    });

    mockApi.generateDescription.mockResolvedValue({
      success: true,
      description: 'Test description'
    });

    mockApi.generateComponents.mockResolvedValue({
      success: true,
      components: 'Test components'
    });

    renderHomePage();
    
    const promptInput = screen.getByLabelText(/describe your ui design/i);
    const submitButton = screen.getByRole('button', { name: /generate design/i });
    
    await user.type(promptInput, 'Test prompt');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(/mockup generation failed/i)).toBeInTheDocument();
    });
  });

  test('handles network connectivity issues', async () => {
    mockApi.checkBedrockAccess.mockRejectedValue(new Error('Network error'));

    renderHomePage();
    
    await waitFor(() => {
      expect(screen.getByText(/disconnected/i)).toBeInTheDocument();
    });
  });

  test('page has proper accessibility structure', () => {
    renderHomePage();
    
    // Check for proper heading structure
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    
    // Check for form accessibility
    const form = screen.getByLabelText(/describe your ui design/i);
    expect(form).toBeInTheDocument();
    
    // Check for button accessibility
    const button = screen.getByRole('button', { name: /generate design/i });
    expect(button).toBeInTheDocument();
  });
});
