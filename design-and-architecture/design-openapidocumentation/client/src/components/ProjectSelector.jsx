import React, { useState, useEffect } from 'react';
import apiClient from '../services/apiClient';

const ProjectSelector = ({ onProjectConfirmed }) => {
  const [projectName, setProjectName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Check if we already have a project set
    const currentProject = apiClient.getProjectName();
    if (currentProject && currentProject !== 'default-project') {
      setProjectName(currentProject);
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!projectName.trim()) {
      return;
    }

    setIsLoading(true);
    
    // Set the project in the API client
    const safeProjectName = apiClient.setCurrentProject(projectName.trim());
    
    // Small delay for better UX
    setTimeout(() => {
      setIsLoading(false);
      if (onProjectConfirmed) {
        onProjectConfirmed(safeProjectName);
      }
    }, 500);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSubmit(e);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-8">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          🚀 Start Your API Project
        </h2>
        <p className="text-gray-600">
          Enter a name for your API project. All specifications and documents will be organized under this project.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="project-name" className="block text-sm font-medium text-gray-700 mb-2">
            Project Name
          </label>
          <input
            id="project-name"
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="e.g., e-commerce-api, user-management, payment-system"
            className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
            required
            disabled={isLoading}
            autoFocus
          />
          <p className="text-xs text-gray-500 mt-1">
            Use letters, numbers, hyphens, and underscores. Spaces will be converted to hyphens.
          </p>
        </div>

        <button
          type="submit"
          disabled={!projectName.trim() || isLoading}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-md font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
              Setting up project...
            </div>
          ) : (
            'Continue to API Generation'
          )}
        </button>
      </form>

      <div className="mt-6 p-4 bg-blue-50 rounded-md">
        <h3 className="text-sm font-medium text-blue-900 mb-2">💡 Project Organization</h3>
        <ul className="text-xs text-blue-800 space-y-1">
          <li>• All your API specs will be saved under this project</li>
          <li>• You can work on multiple projects separately</li>
          <li>• Each project maintains its own analysis and documentation</li>
        </ul>
      </div>
    </div>
  );
};

export default ProjectSelector;