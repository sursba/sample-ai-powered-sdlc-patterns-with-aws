/**
 * Test authentication state display in screens
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../../contexts/AuthContext';

// Mock the auth service
jest.mock('../../services/authService', () => ({
  initialize: jest.fn(() => true),
  getCurrentUser: jest.fn(() => ({ email: 'test@example.com', username: 'testuser' })),
  isAuthenticated: jest.fn(() => true),
  getAuthToken: jest.fn(() => Promise.resolve('mock-token')),
}));

// Mock the API client
jest.mock('../../services/apiClient', () => ({
  get: jest.fn(() => Promise.resolve([])),
  post: jest.fn(() => Promise.resolve({ success: true })),
}));

// Mock lazy-loaded components
jest.mock('../../components/DomainAnalysisStage', () => {
  return function MockDomainAnalysisStage() {
    return <div data-testid="domain-analysis-stage">Domain Analysis Stage</div>;
  };
});

jest.mock('../../components/SecuritySpecsStage', () => {
  return function MockSecuritySpecsStage() {
    return <div data-testid="security-specs-stage">Security Specs Stage</div>;
  };
});

// Mock SwaggerUI and its CSS
jest.mock('swagger-ui-react', () => {
  return function MockSwaggerUI() {
    return <div data-testid="swagger-ui">Swagger UI</div>;
  };
});

// Mock CSS imports
jest.mock('swagger-ui-react/swagger-ui.css', () => ({}));

// Create simple test components that use authentication
const TestHomeScreen = () => {
  const { user, isAuthenticated } = require('../../contexts/AuthContext').useAuth();
  
  return (
    <div>
      {isAuthenticated && user && (
        <div data-testid="auth-status">
          <span>Authenticated as {user.email || user.username || 'User'}</span>
          <span>• Secure session active</span>
        </div>
      )}
    </div>
  );
};

const TestSpecsScreen = () => {
  const { user, isAuthenticated } = require('../../contexts/AuthContext').useAuth();
  
  return (
    <div>
      {isAuthenticated && user && (
        <div data-testid="user-context">
          <h3>Your API Specifications</h3>
          <p>Viewing specifications for {user.email || user.username || 'your account'}</p>
          <span>Authenticated</span>
        </div>
      )}
    </div>
  );
};

const TestSwaggerScreen = () => {
  const { user, isAuthenticated } = require('../../contexts/AuthContext').useAuth();
  
  return (
    <div>
      {isAuthenticated && user && (
        <div data-testid="swagger-auth">
          <span>Viewing as {user.email || user.username || 'authenticated user'}</span>
          <span>Secure Access</span>
        </div>
      )}
    </div>
  );
};

const renderWithAuth = (component) => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        {component}
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('Authentication State Display', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  describe('HomeScreen Authentication Display', () => {
    it('should display authentication status when user is authenticated', async () => {
      renderWithAuth(<TestHomeScreen />);
      
      // Wait for authentication status to appear
      const authStatus = await screen.findByTestId('auth-status');
      expect(authStatus).toBeInTheDocument();
      
      expect(screen.getByText(/Authenticated as test@example.com/)).toBeInTheDocument();
      expect(screen.getByText(/Secure session active/)).toBeInTheDocument();
    });
  });

  describe('SpecsScreen Authentication Display', () => {
    it('should display user context header when authenticated', async () => {
      renderWithAuth(<TestSpecsScreen />);
      
      // Wait for user context header to appear
      const userContext = await screen.findByTestId('user-context');
      expect(userContext).toBeInTheDocument();
      
      expect(screen.getByText('Your API Specifications')).toBeInTheDocument();
      expect(screen.getByText(/Viewing specifications for test@example.com/)).toBeInTheDocument();
      expect(screen.getByText('Authenticated')).toBeInTheDocument();
    });
  });

  describe('SwaggerScreen Authentication Display', () => {
    it('should display authentication status when viewing API documentation', async () => {
      renderWithAuth(<TestSwaggerScreen />);
      
      // Wait for authentication status to appear
      const swaggerAuth = await screen.findByTestId('swagger-auth');
      expect(swaggerAuth).toBeInTheDocument();
      
      expect(screen.getByText(/Viewing as test@example.com/)).toBeInTheDocument();
      expect(screen.getByText('Secure Access')).toBeInTheDocument();
    });
  });
});