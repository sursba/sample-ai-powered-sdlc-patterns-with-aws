/**
 * Debug utilities for project management
 */

import apiClient from '../services/apiClient';

/**
 * Debug current project state
 */
export function debugProjectState() {
  console.log('🔍 Project Debug Information:');
  console.log('=' .repeat(50));
  
  // Check localStorage
  const storedProject = localStorage.getItem('current-project');
  console.log('📦 localStorage current-project:', storedProject);
  
  // Check API client state
  console.log('🔧 API Client state:');
  console.log('  - currentProject:', apiClient.currentProject);
  console.log('  - getProjectName():', apiClient.getProjectName());
  console.log('  - getCurrentProject():', apiClient.getCurrentProject());
  
  // Check if ProjectSelector component exists
  const projectSelector = document.querySelector('.project-selector');
  console.log('🎛️  ProjectSelector component found:', !!projectSelector);
  
  // Check URL for project info
  const urlParams = new URLSearchParams(window.location.search);
  const urlProject = urlParams.get('project');
  console.log('🔗 URL project parameter:', urlProject);
  
  // Recommendations
  console.log('\n💡 Recommendations:');
  if (!storedProject || storedProject === 'default-project') {
    console.log('  - Use the ProjectSelector to choose a project');
    console.log('  - Or call: apiClient.setCurrentProject("your-project-name")');
  }
  
  if (!projectSelector) {
    console.log('  - ProjectSelector component may not be rendered');
  }
  
  console.log('=' .repeat(50));
  
  return {
    storedProject,
    apiClientProject: apiClient.currentProject,
    hasProjectSelector: !!projectSelector,
    urlProject
  };
}

/**
 * Set project and verify it's working
 */
export function setAndVerifyProject(projectName) {
  console.log(`🎯 Setting project to: ${projectName}`);
  
  const safeProjectName = apiClient.setCurrentProject(projectName);
  
  // Verify it was set correctly
  setTimeout(() => {
    const verification = debugProjectState();
    
    if (verification.storedProject === safeProjectName) {
      console.log('✅ Project set successfully!');
    } else {
      console.log('❌ Project setting failed!');
    }
  }, 100);
  
  return safeProjectName;
}

/**
 * Test project functionality
 */
export function testProjectFunctionality() {
  console.log('🧪 Testing Project Functionality');
  console.log('=' .repeat(50));
  
  // Test 1: Check initial state
  console.log('Test 1: Initial state');
  debugProjectState();
  
  // Test 2: Set a test project
  console.log('\nTest 2: Setting test project');
  setAndVerifyProject('test-project-123');
  
  // Test 3: Reset to default
  setTimeout(() => {
    console.log('\nTest 3: Reset to default');
    setAndVerifyProject('default-project');
  }, 1000);
}

// Make functions available globally for debugging
if (typeof window !== 'undefined') {
  window.debugProject = debugProjectState;
  window.setProject = setAndVerifyProject;
  window.testProject = testProjectFunctionality;
}