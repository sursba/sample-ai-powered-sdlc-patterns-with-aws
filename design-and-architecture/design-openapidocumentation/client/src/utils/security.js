/**
 * Client-side security utilities for input validation and sanitization
 */

/**
 * Sanitize user input for logging to prevent format string attacks
 * @param {any} input - The input to sanitize for logging
 * @returns {string} - Safe string for logging
 */
export function sanitizeForLogging(input) {
  if (input === null || input === undefined) {
    return 'null';
  }
  
  // Convert to string and remove format specifiers
  const str = String(input);
  
  // Remove potential format specifiers like %s, %d, %j, etc.
  return str.replace(/%[sdijfcoxX%]/g, '[SANITIZED]');
}

/**
 * Sanitize specification ID to prevent path traversal attacks (client-side validation)
 * @param {string} specId - The specification ID from user input
 * @returns {string} - Sanitized specification ID
 * @throws {Error} - If the specId is invalid or potentially malicious
 */
export function sanitizeSpecId(specId) {
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