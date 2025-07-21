import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import apiClient from '../services/apiClient';
import { useAuth } from '../contexts/AuthContext';

export default function SwaggerScreen() {
  // Authentication state
  const { user, isAuthenticated, logout } = useAuth();
  
  const { specId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [specData, setSpecData] = useState(null);
  
  // Check if we have saved state to return to
  const hasSavedState = localStorage.getItem('openapi_current_stage') !== null;

  useEffect(() => {
    const fetchSpec = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch the spec data using authenticated API client
        const endpoint = specId ? `/api/openapi/${specId}` : '/api/openapi.json';
        const response = await apiClient.get(endpoint);
        
        setSpecData(response);
      } catch (err) {
        console.error('Error fetching OpenAPI spec:', err);
        setError(err.message || 'Failed to load OpenAPI specification');
      } finally {
        setLoading(false);
      }
    };

    fetchSpec();
  }, [specId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
        <p className="ml-2">Loading Swagger UI...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        <p className="font-bold">Error</p>
        <p>{error}</p>
      </div>
    );
  }

  // Function to return to the editor
  const returnToEditor = () => {
    navigate('/');
  };

  // Function to go to security specifications stage
  const goToSecurityStage = () => {
    // Update the current stage in localStorage
    localStorage.setItem('openapi_current_stage', 'security');
    navigate('/');
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      {/* User authentication status */}
      {isAuthenticated && user && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <svg className="h-5 w-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium text-green-800">
                Viewing as {user.email || user.username || 'authenticated user'}
              </span>
            </div>
            <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
              Secure Access
            </span>
          </div>
        </div>
      )}

      {/* Navigation bar */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">API Documentation</h2>
          {specId && (
            <p className="text-sm text-gray-600 mt-1">Specification ID: {specId}</p>
          )}
        </div>
        <div className="flex items-center space-x-3">
          {hasSavedState && (
            <>
              <button
                onClick={goToSecurityStage}
                className="bg-secondary text-white px-4 py-2 rounded-md hover:bg-secondary-dark flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
                Add Security
              </button>
              <button
                onClick={returnToEditor}
                className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-dark flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd" />
                </svg>
                Back to Editor
              </button>
            </>
          )}
        </div>
      </div>
      
      {/* Swagger UI */}
      {specData && <SwaggerUI spec={specData} />}
    </div>
  );
}