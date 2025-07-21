/**
 * Project middleware to extract project information from requests
 * Simplified approach using only project names for organization
 */
const projectMiddleware = (req, res, next) => {
  // Get project name using AWS-compatible methods (priority order)
  const projectName = req.query.projectName ||                    // Query parameter (AWS IAM compatible)
                     req.headers['x-amz-meta-project'] ||         // AWS-compatible header
                     req.headers['x-project-name'] ||             // Legacy custom header
                     req.body?.projectName || 
                     'default-project';
  
  // Create safe project name for S3 storage
  const safeProjectName = projectName.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
  
  console.log('🔍 Project middleware - Processing request:', {
    method: req.method,
    url: req.url,
    queryProjectName: req.query.projectName,
    awsMetaProject: req.headers['x-amz-meta-project'],
    headerProjectName: req.headers['x-project-name'],
    bodyProjectName: req.body?.projectName,
    originalProjectName: projectName,
    safeProjectName: safeProjectName
  });
  
  // Add project info to request object
  req.projectName = safeProjectName;
  
  // Add project name to response headers for client tracking
  res.setHeader('X-Project-Name', safeProjectName);
  
  console.log(`✅ Using project: ${safeProjectName}`);
  
  next();
};

module.exports = projectMiddleware;