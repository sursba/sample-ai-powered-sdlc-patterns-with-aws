#!/usr/bin/env node

/**
 * Build Environment Validation Script
 * Validates that all required environment variables are present during Amplify build
 */

const requiredEnvVars = [
  'REACT_APP_AWS_REGION',
  'REACT_APP_USER_POOL_ID',
  'REACT_APP_USER_POOL_CLIENT_ID',
  'REACT_APP_AUTH_DOMAIN',
  'REACT_APP_DOMAIN_ANALYZER_FUNCTION',
  'REACT_APP_DOC_GENERATOR_FUNCTION'
];

const optionalEnvVars = [
  'NODE_ENV',
  'AMPLIFY_DIFF_DEPLOY',
  'AMPLIFY_MONOREPO_APP_ROOT'
];

console.log('🔍 Validating build environment variables...\n');

let hasErrors = false;

// Check required variables
console.log('Required Environment Variables:');
requiredEnvVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`✅ ${varName}: ${value.length > 20 ? value.substring(0, 20) + '...' : value}`);
  } else {
    console.log(`❌ ${varName}: MISSING`);
    hasErrors = true;
  }
});

console.log('\nOptional Environment Variables:');
optionalEnvVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`ℹ️  ${varName}: ${value}`);
  } else {
    console.log(`⚪ ${varName}: not set`);
  }
});

// Validate specific configurations
console.log('\n🔧 Configuration Validation:');

// Check AWS region format
const region = process.env.REACT_APP_AWS_REGION;
if (region && !/^[a-z]{2}-[a-z]+-\d+$/.test(region)) {
  console.log(`⚠️  AWS Region format may be invalid: ${region}`);
}

// Check User Pool ID format
const userPoolId = process.env.REACT_APP_USER_POOL_ID;
if (userPoolId && !/^[a-z0-9-]+_[a-zA-Z0-9]+$/.test(userPoolId)) {
  console.log(`⚠️  User Pool ID format may be invalid: ${userPoolId}`);
}

// Check Client ID format (should be alphanumeric)
const clientId = process.env.REACT_APP_USER_POOL_CLIENT_ID;
if (clientId && !/^[a-zA-Z0-9]+$/.test(clientId)) {
  console.log(`⚠️  User Pool Client ID format may be invalid: ${clientId}`);
}

// Check Auth Domain format
const authDomain = process.env.REACT_APP_AUTH_DOMAIN;
if (authDomain && !authDomain.includes('.auth.')) {
  console.log(`⚠️  Auth Domain format may be invalid: ${authDomain}`);
}

console.log('\n📊 Build Environment Summary:');
console.log(`Node.js Version: ${process.version}`);
console.log(`Platform: ${process.platform}`);
console.log(`Architecture: ${process.arch}`);
console.log(`Working Directory: ${process.cwd()}`);

// Check if we're in Amplify build environment
const isAmplifyBuild = process.env.AWS_BRANCH || process.env.AMPLIFY_DIFF_DEPLOY;

if (hasErrors) {
  if (isAmplifyBuild) {
    console.log('\n❌ Build environment validation failed!');
    console.log('Please ensure all required environment variables are set in your Amplify app configuration.');
    process.exit(1);
  } else {
    console.log('\n⚠️  Build environment validation warnings detected!');
    console.log('Missing environment variables - this is expected for local development.');
    console.log('The application will build but authentication features may not work.');
    console.log('For local development, copy .env.example to .env.local and configure values.');
  }
} else {
  console.log('\n✅ Build environment validation passed!');
  console.log('All required environment variables are present.');
}