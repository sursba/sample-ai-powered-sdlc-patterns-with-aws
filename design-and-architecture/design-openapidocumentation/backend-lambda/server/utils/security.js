/**
 * Security utilities for input validation and sanitization
 */

const path = require('path');

/**
 * Sanitize specification ID to prevent path traversal attacks
 * @param {string} specId - The specification ID from user input
 * @returns {string} - Sanitized specification ID
 * @throws {Error} - If the specId is invalid or potentially malicious
 */
function sanitizeSpecId(specId) {
  // Check if specId exists
  if (!specId || typeof specId !== 'string') {
    throw new Error('Specification ID is required and must be a string');
  }

  // Remove any path traversal attempts and dangerous characters
  // Allow only alphanumeric characters, hyphens, and underscores
  const sanitized = specId.replace(/[^a-zA-Z0-9_-]/g, '');
  
  // Ensure it's not empty after sanitization
  if (!sanitized || sanitized.length === 0) {
    throw new Error('Invalid specification ID: contains illegal characters');
  }
  
  // Prevent excessively long IDs (potential DoS)
  if (sanitized.length > 100) {
    throw new Error('Specification ID too long: maximum 100 characters allowed');
  }
  
  // Prevent IDs that are just dots or could be problematic
  if (sanitized === '.' || sanitized === '..' || sanitized.startsWith('.')) {
    throw new Error('Invalid specification ID: cannot start with dots');
  }
  
  return sanitized;
}

/**
 * Sanitize user input for logging to prevent format string attacks
 * @param {any} input - The input to sanitize for logging
 * @returns {string} - Safe string for logging
 */
function sanitizeForLogging(input) {
  if (input === null || input === undefined) {
    return 'null';
  }
  
  // Convert to string and remove format specifiers
  const str = String(input);
  
  // Remove potential format specifiers like %s, %d, %j, etc.
  return str.replace(/%[sdijfcoxX%]/g, '[SANITIZED]');
}

/**
 * Validate that a file path is within the expected directory
 * @param {string} filePath - The file path to validate
 * @param {string} expectedDir - The expected parent directory
 * @returns {boolean} - True if the path is safe
 */
function isPathSafe(filePath, expectedDir) {
  try {
    const resolvedPath = path.resolve(filePath);
    const resolvedExpectedDir = path.resolve(expectedDir);
    
    // Check if the resolved path starts with the expected directory
    return resolvedPath.startsWith(resolvedExpectedDir + path.sep) || 
           resolvedPath === resolvedExpectedDir;
  } catch (error) {
    return false;
  }
}

/**
 * Create a safe file path by joining a base directory with a sanitized filename
 * @param {string} baseDir - The base directory
 * @param {string} filename - The filename to sanitize and join
 * @param {string} extension - Optional file extension (with dot)
 * @returns {string} - Safe file path
 * @throws {Error} - If the resulting path is unsafe
 */
function createSafeFilePath(baseDir, filename, extension = '') {
  const sanitizedFilename = sanitizeSpecId(filename);
  const fullFilename = sanitizedFilename + extension;
  const filePath = path.join(baseDir, fullFilename);
  
  // Double-check that the resulting path is safe
  if (!isPathSafe(filePath, baseDir)) {
    throw new Error('Generated file path is outside the expected directory');
  }
  
  return filePath;
}

module.exports = {
  sanitizeSpecId,
  sanitizeForLogging,
  isPathSafe,
  createSafeFilePath
};