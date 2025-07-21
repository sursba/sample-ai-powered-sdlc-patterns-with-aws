// React dependencies
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';

// Authentication
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';

// Services
import apiClient from './services/apiClient';

// Screens
import HomeScreen from './screens/HomeScreen';
import SwaggerScreen from './screens/SwaggerScreen';
import SpecsScreen from './screens/SpecsScreen';

// Main application content component with authentication
function AppContent() {
  const { user, logout, login, isAuthenticated, error, clearError } = useAuth();
  const navigate = useNavigate();

  // Function to reset the application state
  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset the application? All unsaved progress will be lost.')) {
      // Clear all localStorage items related to the app
      localStorage.removeItem('openapi_prompt');
      localStorage.removeItem('openapi_spec_id');
      localStorage.removeItem('openapi_analysis_result');
      localStorage.removeItem('openapi_current_stage');
      localStorage.removeItem('openapi_domain_description');
      localStorage.removeItem('openapi_security_specs');
      
      // Redirect to home page
      window.location.href = '/';
    }
  };

  // Handle logout
  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to sign out?')) {
      await logout();
    }
  };

  // Handle new project creation
  const handleNewProject = () => {
    if (window.confirm('Start a new project? This will clear your current work and take you to project setup.')) {
      // Clear current project and related data
      localStorage.removeItem('current-project');
      localStorage.removeItem('openapi_prompt');
      localStorage.removeItem('openapi_spec_id');
      localStorage.removeItem('openapi_analysis_result');
      localStorage.removeItem('openapi_current_stage');
      localStorage.removeItem('openapi_domain_description');
      localStorage.removeItem('openapi_security_specs');
      localStorage.removeItem('openapi_business_contexts');
      localStorage.removeItem('openapi_ascii_diagram');
      localStorage.removeItem('openapi_ascii_diagram_hash');
      localStorage.removeItem('uploaded_image_name');
      
      // Reset API client to default project
      apiClient.setCurrentProject('default-project');
      
      // Navigate to home page which will show project setup
      navigate('/');
      
      // Force a page refresh to ensure clean state
      setTimeout(() => {
        window.location.reload();
      }, 100);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Error notification */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <div className="ml-auto pl-3">
              <button
                onClick={clearError}
                className="text-red-400 hover:text-red-600"
              >
                <span className="sr-only">Dismiss</span>
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className="bg-blue-600 p-4 text-white">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <Link to="/" className="text-xl font-bold">Domain-Driven API Generator</Link>
            
            {/* Current Project Indicator */}
            {(() => {
              const currentProject = apiClient.getProjectName();
              if (currentProject && currentProject !== 'default-project') {
                return (
                  <div className="bg-blue-500 bg-opacity-50 px-3 py-1 rounded-full text-sm">
                    <span className="text-blue-200">Project:</span>
                    <span className="font-medium ml-1">
                      {currentProject.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </span>
                  </div>
                );
              }
              return null;
            })()}
          </div>
          
          <div className="flex items-center space-x-4">
            <Link to="/" className="hover:text-gray-200">Home</Link>
            <Link to="/specs" className="hover:text-gray-200">All Specifications</Link>
            
            {/* New Project Button */}
            <button 
              onClick={handleNewProject}
              className="bg-green-600 hover:bg-green-700 text-white text-sm px-3 py-2 h-8 rounded transition-colors flex items-center"
              title="Start a new project"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              New Project
            </button>
            
            {/* Reset Button */}
            <button 
              onClick={handleReset}
              className="bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-2 h-8 rounded transition-colors flex items-center"
              title="Reset application"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Reset
            </button>
            
            {/* Authentication Status - Always show for debugging */}
            <div className="flex items-center space-x-3 border-l border-gray-300 pl-4">
              {isAuthenticated && user ? (
                <>
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-medium">
                        {(user.email || user.username || 'U').charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">
                        {user.email || user.username || 'User'}
                      </span>
                      <span className="text-xs text-blue-200">
                        Authenticated
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-1 rounded transition-colors flex items-center"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <span className="text-sm text-blue-200">
                    {isAuthenticated === false ? 'Not signed in' : 'Checking...'}
                  </span>
                  <button
                    onClick={login}
                    className="bg-green-600 hover:bg-green-700 text-white text-sm px-3 py-1 rounded transition-colors"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => console.log('Auth state:', { isAuthenticated, user, error })}
                    className="bg-gray-600 hover:bg-gray-700 text-white text-xs px-2 py-1 rounded"
                  >
                    Debug
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="container mx-auto py-8">
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/swagger" element={<SwaggerScreen />} />
          <Route path="/swagger/:specId" element={<SwaggerScreen />} />
          <Route path="/specs" element={<SpecsScreen />} />
        </Routes>
      </div>
    </div>
  );
}

// Main App component with authentication provider
export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <ProtectedRoute>
            <AppContent />
          </ProtectedRoute>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}