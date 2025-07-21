/**
 * Authentication test utility
 * Use this to debug authentication issues
 */

import authService from '../services/authService';
import awsClient from '../services/awsClient';

export const testAuthentication = async () => {
  console.log('🔍 Testing Authentication Flow...');
  
  try {
    // Test 1: Check if auth service is configured
    console.log('1. Testing auth service configuration...');
    await authService.loadConfig();
    const config = authService.cognitoConfig;
    console.log('✅ Auth config:', {
      region: config.region,
      userPoolId: config.userPoolId ? '✅ Set' : '❌ Missing',
      userPoolClientId: config.userPoolClientId ? '✅ Set' : '❌ Missing',
      authDomain: config.authDomain ? '✅ Set' : '❌ Missing'
    });

    // Test 2: Check authentication status
    console.log('2. Testing authentication status...');
    const isAuthenticated = authService.isAuthenticated();
    console.log('✅ Is authenticated:', isAuthenticated);

    if (!isAuthenticated) {
      console.log('❌ User not authenticated. Please log in first.');
      return false;
    }

    // Test 3: Check tokens
    console.log('3. Testing tokens...');
    const tokens = authService.getTokens();
    console.log('✅ Token availability check completed');

    // Test 4: Check AWS client initialization
    console.log('4. Testing AWS client initialization...');
    const awsInitialized = await awsClient.initialize();
    console.log('✅ AWS client initialized:', awsInitialized);

    // Test 5: Test credential creation
    console.log('5. Testing AWS credential creation...');
    try {
      const credentials = await awsClient.getCredentials();
      console.log('✅ AWS credentials created successfully');
      
      // Test the credentials by getting the identity
      const resolvedCredentials = await credentials();
      console.log('✅ Credentials resolved successfully');
      
    } catch (credError) {
      console.error('❌ AWS credential creation failed:', credError);
      return false;
    }

    // Test 6: Test API call
    console.log('6. Testing API call...');
    try {
      const response = await awsClient.get('/health');
      console.log('✅ API call successful:', response);
    } catch (apiError) {
      console.error('❌ API call failed:', apiError);
      return false;
    }

    console.log('🎉 All authentication tests passed!');
    return true;

  } catch (error) {
    console.error('❌ Authentication test failed:', error);
    return false;
  }
};

// Export for use in browser console
window.testAuth = testAuthentication;