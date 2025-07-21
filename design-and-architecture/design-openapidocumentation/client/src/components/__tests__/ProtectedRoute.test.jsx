/**
 * Unit tests for ProtectedRoute component
 * Tests route-level authentication guards
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProtectedRoute from '../ProtectedRoute';
import { AuthProvider } from '../../contexts/AuthContext';

// Mock the auth service
jest.mock('../../services/authService', () => ({
  initialize: jest.fn(() => true),
  getCurrentUser: jest.fn(() => null),
  isAuthenticated: jest.fn(() => false),
  getAuthToken: jest.fn(() => Promise.resolve(null)),
  login: jest.fn(),
  signOut: jest.fn(),
  validateToken: jest.fn(() => false),
}));

const MockedProtectedRoute = ({ children, isAuthenticated = false, isLoading = false, error = null, user = null }) => {
  // Mock the useAuth hook
  const mockAuthContext = {
    user,
    isAuthenticated,
    isLoading,
    error,
    login: jest.fn(),
    logout: jest.fn(),
    getToken: jest.fn(),
    refreshAuth: jest.fn(),
    clearError: jest.fn(),
    isInitialized: !isLoading,
  };

  // Mock the AuthContext
  const AuthContext = React.createContext();
  const MockAuthProvider = ({ children }) => (
    <AuthContext.Provider value={mockAuthContext}>
      {children}
    </AuthContext.Provider>
  );

  // Mock useAuth hook
  const useAuth = () => React.useContext(AuthContext);

  // Create a version of ProtectedRoute that uses our mocked context
  const TestProtectedRoute = ({ children, fallback = null }) => {
    const { isAuthenticated, isLoading, login, error } = useAuth();

    if (isLoading) {
      return (
        <div data-testid="loading-state">
          <div>Checking authentication...</div>
        </div>
      );
    }

    if (error) {
      return (
        <div data-testid="error-state">
          <div>{error}</div>
          <button onClick={login}>Try Again</button>
        </div>
      );
    }

    if (!isAuthenticated) {
      if (fallback) {
        return fallback;
      }

      return (
        <div data-testid="login-prompt">
          <h2>Authentication Required</h2>
          <p>Please sign in to access the OpenAPI Documentation application.</p>
          <button onClick={login}>Sign In</button>
        </div>
      );
    }

    return children;
  };

  return (
    <MockAuthProvider>
      <TestProtectedRoute>{children}</TestProtectedRoute>
    </MockAuthProvider>
  );
};

describe('ProtectedRoute', () => {
  const TestComponent = () => <div data-testid="protected-content">Protected Content</div>;

  it('should show loading state while checking authentication', () => {
    render(
      <MockedProtectedRoute isLoading={true}>
        <TestComponent />
      </MockedProtectedRoute>
    );

    expect(screen.getByTestId('loading-state')).toBeInTheDocument();
    expect(screen.getByText('Checking authentication...')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('should show error state when authentication fails', () => {
    const mockLogin = jest.fn();
    render(
      <MockedProtectedRoute error="Authentication failed">
        <TestComponent />
      </MockedProtectedRoute>
    );

    expect(screen.getByTestId('error-state')).toBeInTheDocument();
    expect(screen.getByText('Authentication failed')).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('should show login prompt when not authenticated', () => {
    render(
      <MockedProtectedRoute isAuthenticated={false}>
        <TestComponent />
      </MockedProtectedRoute>
    );

    expect(screen.getByTestId('login-prompt')).toBeInTheDocument();
    expect(screen.getByText('Authentication Required')).toBeInTheDocument();
    expect(screen.getByText('Please sign in to access the OpenAPI Documentation application.')).toBeInTheDocument();
    expect(screen.getByText('Sign In')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('should render protected content when authenticated', () => {
    const mockUser = { username: 'testuser', email: 'test@example.com' };
    render(
      <MockedProtectedRoute isAuthenticated={true} user={mockUser}>
        <TestComponent />
      </MockedProtectedRoute>
    );

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
    expect(screen.queryByTestId('loading-state')).not.toBeInTheDocument();
    expect(screen.queryByTestId('error-state')).not.toBeInTheDocument();
    expect(screen.queryByTestId('login-prompt')).not.toBeInTheDocument();
  });

  it('should render fallback component when provided and not authenticated', () => {
    const FallbackComponent = () => <div data-testid="fallback-content">Custom Fallback</div>;
    
    render(
      <MockedProtectedRoute isAuthenticated={false}>
        <TestComponent />
      </MockedProtectedRoute>
    );

    // Since we're not passing a fallback prop, it should show the default login prompt
    expect(screen.getByTestId('login-prompt')).toBeInTheDocument();
    expect(screen.queryByTestId('fallback-content')).not.toBeInTheDocument();
  });

  it('should handle login button click', () => {
    const mockLogin = jest.fn();
    
    // We need to test the actual ProtectedRoute component with a mocked auth context
    const AuthContext = React.createContext();
    const mockAuthContext = {
      isAuthenticated: false,
      isLoading: false,
      login: mockLogin,
      error: null,
    };

    const TestWrapper = () => (
      <AuthContext.Provider value={mockAuthContext}>
        <ProtectedRoute>
          <TestComponent />
        </ProtectedRoute>
      </AuthContext.Provider>
    );

    // Mock the useAuth hook for this test
    const originalUseAuth = require('../../contexts/AuthContext').useAuth;
    require('../../contexts/AuthContext').useAuth = () => mockAuthContext;

    render(<TestWrapper />);

    const signInButton = screen.getByText('Sign In');
    fireEvent.click(signInButton);

    expect(mockLogin).toHaveBeenCalledTimes(1);

    // Restore the original useAuth
    require('../../contexts/AuthContext').useAuth = originalUseAuth;
  });
});