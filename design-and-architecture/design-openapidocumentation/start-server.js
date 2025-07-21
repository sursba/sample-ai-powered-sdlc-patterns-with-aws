#!/usr/bin/env node

// This script starts the server for Amplify deployment
const path = require('path');
const fs = require('fs');

// Set production environment
process.env.NODE_ENV = 'production';

// Check if we're in the Amplify build context
const isAmplifyBuild = process.env.AWS_APP_ID || process.env._HANDLER;

if (isAmplifyBuild) {
  console.log('🚀 Starting server in Amplify environment...');
  
  // Ensure the server directory exists
  const serverPath = path.join(__dirname, 'backend-lambda/server');
  if (fs.existsSync(serverPath)) {
    console.log('✅ Server directory found');
    require('./backend-lambda/server/index.js');
  } else {
    console.error('❌ Server directory not found at:', serverPath);
    process.exit(1);
  }
} else {
  console.log('🚀 Starting server in local environment...');
  require('./backend-lambda/server/index.js');
}