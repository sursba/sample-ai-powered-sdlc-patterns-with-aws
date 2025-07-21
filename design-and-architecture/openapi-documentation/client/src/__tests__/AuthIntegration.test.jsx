/**
 * Integration tests for authentication flow
 * Tests the complete authentication integration with App component
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from '../App';

// Mock the auth service
jest.mock('../services/authService', () => ({
  initialize: jest.fn(() => true),
  getCurrentUser: jest.fn(() => null),
  isAuthenticated: jest.fn(() => false),
  getAuthToken: jest.fn(() => Promise.resolve(null)),
  login: jest.fn(),
  signOut: jest.fn(),
  validateToken: jest.fn(() => false),
  handleAuthCallback: jest.fn(() => Promise.resolve(false)),
}));

// Mock React Router to avoid navigation issues in tests
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  BrowserRouter: ({ children }) => <div data-testid="router">{children}</div>,
  Routes: ({ children }) => <div data-testid="routes">{children}</div>,
  Route: ({ element }) => <div data-testid="route">{element}</div>,
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
}));

// Mock the screen components to avoid complex dependencies
jest.mock('../screens/HomeScreen', () => {
  return function HomeScreen() {
    return <div data-testid="home-screen">Home Screen</div>;
  };
});

jest.mock('../screens/SwaggerScreen', () => {
  return function SwaggerScreen() {
    return <div data-testid="swagger-screen">Swagger Screen</div>;
  };
});

jest.mock('../screens/SpecsScreen', () => {
  return function SpecsScreen() {
    return <div data-testid="specs-screen">Specs Screen</div>;
  };
});

describe('Authentication Integration', () => {
  let mockAuthService;

  beforeEach(() => {
    // Get the mocked auth service
    mockAuthService = require('../services/authService');
    jest.clearAllMocks();
    
    // Reset auth service mocks to default state
    mockAuthService.initialize.mockReturnValue(true);
    mockAuthService.getCurrentUser.mockReturnValue(null);
    mockAuthService.isAuthenticated.mockReturnValue(false);
    mockAuthService.getAuthToken.mockResolvedValue(null);
    
    // Mock environment variables
    process.env.REACT_APP_AWS_REGION = 'us-east-1';
    process.env.REACT_APP_USER_POOL_ID = 'us-east-1_test123';
    process.env.REACT_APP_USER_POOL_CLIENT_ID = 'test-client-id';
    process.env.REACT_APP_AUTH_DOMAIN = 'test-domain.auth.us-east-1.amazoncognito.com';
  });

  it('should show login prompt when user is not authenticated', async () => {
    render(<App />);

    // Wait for the authentication check to complete
    await waitFor(() => {
      expect(screen.getByText('Authentication Required')).toBeInTheDocument();
    });

    expect(screen.getByText('Please sign in to access the OpenAPI Documentation application.')).toBeInTheDocument();
    expect(screen.getByText('Sign In')).toBeInTheDocument();
    expect(mockAuthService.initialize).toHaveBeenCalled();
  });

  it('should show loading state during authentication check', async () => {
    // Mock a delayed authentication check
    let resolveAuth;
    const authPromise = new Promise(resolve => {
      resolveAuth = resolve;
    });

    mockAuthService.getCurrentUser.mockImplementation(() => {
      // Simulate async auth check
      authPromise.then(() => null);
      return null;
    });

    render(<App />);

    // Should show loading state initially
    expect(screen.getByText('Checking authentication...')).toBeInTheDocument();

    // Resolve the auth check
    resolveAuth();

    // Wait for the auth check to complete
    await waitFor(() => {
      expect(screen.getByText('Authentication Required')).toBeInTheDocument();
    });
  });

  it('should show app content when user is authenticated', async () => {
    const mockUser = {
      username: 'testuser',
      email: 'test@example.com',
      sub: 'test-user-id'
    };

    // Mock authenticated state
    mockAuthService.getCurrentUser.mockReturnValue(mockUser);
    mockAuthService.isAuthenticated.mockReturnValue(true);
    mockAuthService.getAuthToken.mockResolvedValue('valid-token');

    render(<App />);

    // Wait for authentication to complete
    await waitFor(() => {
      expect(screen.getByText('Domain-Driven API Generator')).toBeInTheDocument();
    });

    // Should show navigation
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('API Documentation')).toBeInTheDocument();
    expect(screen.getByText('All Specifications')).toBeInTheDocument();
    expect(screen.getByText('Reset')).toBeInTheDocument();

    // Should show user info
    expect(screen.getByText('Welcome, test@example.com')).toBeInTheDocument();
    expect(screen.getByText('Sign Out')).toBeInTheDocument();

    // Should not show login prompt
    expect(screen.queryByText('Authentication Required')).not.toBeInTheDocument();
  });

  it('should show error state when authentication fails', async () => {
    // Mock authentication error
    mockAuthService.getCurrentUser.mockImplementation(() => {
      throw new Error('Authentication failed');
    });

    render(<App />);

    // Wait for error to be displayed
    await waitFor(() => {
      expect(screen.getByText('Authentication Required')).toBeInTheDocument();
    });

    // Should still show login option
    expect(screen.getByText('Sign In')).toBeInTheDocument();
  });

  it('should handle auth callback URL parameters', async () => {
    // Mock URL with auth code
    delete window.location;
    window.location = {
      search: '?code=test-auth-code&state=test-state',
      pathname: '/',
      origin: 'http://localhost:3000',
      href: 'http://localhost:3000/?code=test-auth-code&state=test-state'
    };

    // Mock successful auth callback
    mockAuthService.handleAuthCallback.mockResolvedValue(true);
    mockAuthService.getCurrentUser.mockReturnValue({
      username: 'testuser',
      email: 'test@example.com'
    });
    mockAuthService.isAuthenticated.mockReturnValue(true);

    render(<App />);

    // Wait for auth callback to be processed
    await waitFor(() => {
      expect(mockAuthService.handleAuthCallback).toHaveBeenCalledWith('test-auth-code');
    });
  });

  it('should initialize auth service on mount', async () => {
    render(<App />);

    await waitFor(() => {
      expect(mockAuthService.initialize).toHaveBeenCalled();
    });
  });

  it('should handle missing auth configuration gracefully', async () => {
    // Mock missing configuration
    mockAuthService.initialize.mockReturnValue(false);
    
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

    render(<App />);

    await waitFor(() => {
      expect(mockAuthService.initialize).toHaveBeenCalled();
    });

    // Should still render the app (with login prompt)
    expect(screen.getByText('Authentication Required')).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it('should provide auth context to child components', async () => {
    const mockUser = {
      username: 'testuser',
      email: 'test@example.com'
    };

    mockAuthService.getCurrentUser.mockReturnValue(mockUser);
    mockAuthService.isAuthenticated.mockReturnValue(true);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Welcome, test@example.com')).toBeInTheDocument();
    });

    // The auth context should be available to all child components
    expect(screen.getByText('Domain-Driven API Generator')).toBeInTheDocument();
  });
});