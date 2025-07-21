// Core dependencies
const fs = require('fs');
const path = require('path');

// Create specs directory if it doesn't exist
// In Lambda, use /tmp directory for temporary file storage
const ensureSpecsDirectory = () => {
  const SPECS_DIRECTORY = process.env.AWS_LAMBDA_FUNCTION_NAME 
    ? '/tmp/specs'
    : path.join(__dirname, '../../static/specs');
  
  if (!fs.existsSync(SPECS_DIRECTORY)) {
    fs.mkdirSync(SPECS_DIRECTORY, { recursive: true });
  }
  return SPECS_DIRECTORY;
};

module.exports = {
  ensureSpecsDirectory
};