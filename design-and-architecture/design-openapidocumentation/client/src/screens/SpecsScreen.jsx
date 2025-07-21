import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../services/apiClient';
import { useAuth } from '../contexts/AuthContext';

export default function SpecsScreen() {
  // Authentication state
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [specs, setSpecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSpecs = async () => {
    try {
      console.log('Fetching specifications...');
      console.log('User authenticated:', isAuthenticated);
      console.log('User info:', user);
      setLoading(true);
      setError(null);

      const response = await apiClient.get('/api/specs');
      console.log('Specifications response:', response);
      console.log('Response type:', typeof response);
      console.log('Is array:', Array.isArray(response));
      console.log('Number of specs found:', response?.length || 0);

      setSpecs(response || []);
      setError(null);
    } catch (error) {
      console.error('Error fetching specifications:', error);
      console.error('Error details:', {
        message: error.message,
        status: error.status,
        isNetworkError: error.isNetworkError,
        isAuthError: error.isAuthError,
        details: error.details
      });

      let errorMessage = 'Failed to load specifications';
      if (error.isNetworkError) {
        errorMessage = 'Network error - please check your connection';
      } else if (error.isAuthError) {
        errorMessage = 'Authentication error - please try logging in again';
      } else if (error.message) {
        errorMessage = error.message;
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSpecs();
  }, []);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-64">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
        <p className="ml-2 mt-2">Loading specifications...</p>
        <p className="text-sm text-gray-500 mt-1">Checking S3 storage and local files...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        <p className="font-bold">Error</p>
        <p>{error}</p>
        <button
          className="mt-4 bg-primary text-white py-2 px-4 rounded"
          onClick={fetchSpecs}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      {/* User context header */}
      {isAuthenticated && user && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <svg className="h-6 w-6 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div>
                <h3 className="text-lg font-medium text-blue-900">All API Specifications</h3>
                <p className="text-sm text-blue-700">Viewing specifications from all projects for {user.email || user.username || 'your account'}</p>
              </div>
            </div>
            <div className="text-sm text-blue-600 bg-blue-100 px-3 py-1 rounded-full">
              Authenticated
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">All Specifications</h2>
        <button
          onClick={fetchSpecs}
          disabled={loading}
          className="bg-primary text-white py-2 px-4 rounded hover:bg-primary-dark disabled:opacity-50 flex items-center"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
              Loading...
            </>
          ) : (
            <>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </>
          )}
        </button>
      </div>

      {specs.length === 0 && !loading ? (
        <div className="text-center py-8">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <svg className="mx-auto h-12 w-12 text-blue-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-lg font-medium text-blue-900 mb-2">No Specifications Found</h3>
            <p className="text-blue-700 mb-4">
              You haven't generated any OpenAPI specifications yet.
            </p>
            <div className="text-sm text-blue-600 mb-4">
              <p>• Checked S3 cloud storage</p>
              <p>• Checked local filesystem</p>
              <p>• No specifications found in either location</p>
            </div>
            <Link
              to="/"
              className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Generate Your First Specification
            </Link>
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-gray-200">
          {specs.map((spec) => (
            <li key={spec.id} className="py-4">
              <div className="flex justify-between items-center hover:bg-gray-50 p-2 -m-2 rounded">
                <Link
                  to={`/swagger/${spec.id}`}
                  className="flex-grow"
                >
                  <div className="flex items-center space-x-2">
                    <h3 className="text-lg font-medium text-primary">{spec.title}</h3>
                    {spec.projectName && (
                      <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                        {spec.projectName}
                      </span>
                    )}
                    {spec.source === 's3' && (
                      <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                        Cloud
                      </span>
                    )}
                    {spec.source === 'filesystem' && (
                      <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full">
                        Local
                      </span>
                    )}
                  </div>
                  <p className="text-gray-500 text-sm">
                    Created: {formatDate(spec.created)}
                    {spec.projectName && (
                      <span className="ml-2">• Project: {spec.projectName}</span>
                    )}
                    {spec.sessionId && (
                      <span className="ml-2">• Session: {spec.sessionId.substring(0, 8)}...</span>
                    )}
                  </p>
                </Link>
                <button
                  onClick={async (e) => {
                    e.preventDefault();
                    try {
                      const response = await apiClient.get(`/api/openapi/${spec.id}`);
                      const blob = new Blob([JSON.stringify(response, null, 2)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      window.open(url, '_blank');
                      URL.revokeObjectURL(url);
                    } catch (error) {
                      console.error('Error fetching OpenAPI spec:', error);
                      alert('Failed to load OpenAPI specification');
                    }
                  }}
                  className="ml-4 bg-gray-200 hover:bg-gray-300 text-gray-700 py-1 px-3 rounded text-sm"
                  title="Open raw JSON in new window"
                >
                  <span className="hidden sm:inline">View Code</span>
                  <span className="sm:hidden">📄</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}