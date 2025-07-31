import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material';
import PromptForm from '../../components/PromptForm';

const theme = createTheme();

const renderPromptForm = (props = {}) => {
  const defaultProps = {
    onSubmit: jest.fn(),
    loading: false,
    ...props
  };

  return render(
    <ThemeProvider theme={theme}>
      <PromptForm {...defaultProps} />
    </ThemeProvider>
  );
};

describe('PromptForm Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders form elements correctly', () => {
    renderPromptForm();
    
    expect(screen.getByLabelText(/describe your ui design/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/width/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/height/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /generate design/i })).toBeInTheDocument();
  });

  test('has default values for width and height', () => {
    renderPromptForm();
    
    const widthInput = screen.getByLabelText(/width/i);
    const heightInput = screen.getByLabelText(/height/i);
    
    expect(widthInput).toHaveValue(1024);
    expect(heightInput).toHaveValue(1024);
  });

  test('allows user to enter prompt text', async () => {
    const user = userEvent.setup();
    renderPromptForm();
    
    const promptInput = screen.getByLabelText(/describe your ui design/i);
    await user.type(promptInput, 'Create a modern login form');
    
    expect(promptInput).toHaveValue('Create a modern login form');
  });

  test('allows user to change width and height', async () => {
    const user = userEvent.setup();
    renderPromptForm();
    
    const widthInput = screen.getByLabelText(/width/i);
    const heightInput = screen.getByLabelText(/height/i);
    
    await user.clear(widthInput);
    await user.type(widthInput, '800');
    
    await user.clear(heightInput);
    await user.type(heightInput, '600');
    
    expect(widthInput).toHaveValue(800);
    expect(heightInput).toHaveValue(600);
  });

  test('calls onSubmit with correct data when form is submitted', async () => {
    const user = userEvent.setup();
    const mockOnSubmit = jest.fn();
    renderPromptForm({ onSubmit: mockOnSubmit });
    
    const promptInput = screen.getByLabelText(/describe your ui design/i);
    const submitButton = screen.getByRole('button', { name: /generate design/i });
    
    await user.type(promptInput, 'Create a dashboard');
    await user.click(submitButton);
    
    expect(mockOnSubmit).toHaveBeenCalledWith({
      prompt: 'Create a dashboard',
      width: 1024,
      height: 1024
    });
  });

  test('prevents submission with empty prompt', async () => {
    const user = userEvent.setup();
    const mockOnSubmit = jest.fn();
    renderPromptForm({ onSubmit: mockOnSubmit });
    
    const submitButton = screen.getByRole('button', { name: /generate design/i });
    await user.click(submitButton);
    
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  test('shows loading state when loading prop is true', () => {
    renderPromptForm({ loading: true });
    
    const submitButton = screen.getByRole('button', { name: /generating/i });
    expect(submitButton).toBeDisabled();
  });

  test('disables form when loading', () => {
    renderPromptForm({ loading: true });
    
    const promptInput = screen.getByLabelText(/describe your ui design/i);
    const widthInput = screen.getByLabelText(/width/i);
    const heightInput = screen.getByLabelText(/height/i);
    const submitButton = screen.getByRole('button');
    
    expect(promptInput).toBeDisabled();
    expect(widthInput).toBeDisabled();
    expect(heightInput).toBeDisabled();
    expect(submitButton).toBeDisabled();
  });

  test('validates width and height inputs', async () => {
    const user = userEvent.setup();
    renderPromptForm();
    
    const widthInput = screen.getByLabelText(/width/i);
    const heightInput = screen.getByLabelText(/height/i);
    
    // Test minimum values
    await user.clear(widthInput);
    await user.type(widthInput, '100');
    expect(widthInput).toHaveValue(100);
    
    await user.clear(heightInput);
    await user.type(heightInput, '100');
    expect(heightInput).toHaveValue(100);
  });

  test('handles form submission with custom dimensions', async () => {
    const user = userEvent.setup();
    const mockOnSubmit = jest.fn();
    renderPromptForm({ onSubmit: mockOnSubmit });
    
    const promptInput = screen.getByLabelText(/describe your ui design/i);
    const widthInput = screen.getByLabelText(/width/i);
    const heightInput = screen.getByLabelText(/height/i);
    const submitButton = screen.getByRole('button', { name: /generate design/i });
    
    await user.type(promptInput, 'Mobile app interface');
    await user.clear(widthInput);
    await user.type(widthInput, '375');
    await user.clear(heightInput);
    await user.type(heightInput, '812');
    
    await user.click(submitButton);
    
    expect(mockOnSubmit).toHaveBeenCalledWith({
      prompt: 'Mobile app interface',
      width: 375,
      height: 812
    });
  });

  test('maintains form state during loading', async () => {
    const user = userEvent.setup();
    const { rerender } = renderPromptForm();
    
    const promptInput = screen.getByLabelText(/describe your ui design/i);
    await user.type(promptInput, 'Test prompt');
    
    // Rerender with loading state
    rerender(
      <ThemeProvider theme={theme}>
        <PromptForm onSubmit={jest.fn()} loading={true} />
      </ThemeProvider>
    );
    
    expect(screen.getByDisplayValue('Test prompt')).toBeInTheDocument();
  });

  test('form has proper accessibility attributes', () => {
    renderPromptForm();
    
    const form = screen.getByRole('form') || screen.getByTestId('prompt-form');
    const promptInput = screen.getByLabelText(/describe your ui design/i);
    const widthInput = screen.getByLabelText(/width/i);
    const heightInput = screen.getByLabelText(/height/i);
    
    expect(promptInput).toHaveAttribute('required');
    expect(widthInput).toHaveAttribute('type', 'number');
    expect(heightInput).toHaveAttribute('type', 'number');
  });
});
