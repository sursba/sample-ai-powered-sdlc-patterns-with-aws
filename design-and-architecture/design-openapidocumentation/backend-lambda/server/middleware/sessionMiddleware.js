/**
 * Session middleware to manage user sessions
 * Implements a project-based session strategy where each user can have multiple projects
 */
const sessionMiddleware = (req, res, next) => {
  // Get user information from headers (sent by client) or from auth middleware
  // Prioritize email as userId for better S3 organization
  const userEmail = req.headers['x-user-email'] || req.user?.email;
  const userId = userEmail || req.user?.sub || req.user?.id || 'anonymous';
  
  // Check if session ID is provided in headers
  const clientSessionId = req.headers['x-session-id'] || 
                         req.query.sessionId || 
                         req.body?.sessionId;
  
  console.log('Session middleware - Processing request with session data');
  
  // Strategy: Use client-provided session ID if available, otherwise create project-based session
  let sessionId;
  
  if (clientSessionId) {
    // Use the session ID provided by the client
    sessionId = clientSessionId;
    console.log(`Using client-provided session ID: ${sessionId}`);
  } else {
    // Check for project name in request (for project-based organization)
    const projectName = req.headers['x-project-name'] || 
                       req.query.projectName || 
                       req.body?.projectName || 
                       'default-project';
    
    // Debug logging for project name detection
    console.log('🔍 Backend Session Debug:');
    console.log('  - req.headers[x-project-name]:', req.headers['x-project-name']);
    console.log('  - req.query.projectName:', req.query.projectName);
    console.log('  - req.body?.projectName:', req.body?.projectName);
    console.log('  - Final projectName:', projectName);
    console.log('  - All headers:', JSON.stringify(req.headers, null, 2));
    
    // Create a deterministic session ID based on user and project
    // This ensures specs for the same project stay together
    const safeProjectName = projectName.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
    sessionId = `${userId}-${safeProjectName}`;
    console.log(`Created project-based session ID: ${sessionId}`);
  }
  
  // Add user and session info to request object
  req.userId = userId;
  req.sessionId = sessionId;
  
  // Add session ID to response headers for client tracking
  res.setHeader('X-Session-ID', sessionId);
  
  console.log(`Final session ID: ${sessionId} for user: ${userId}`);
  
  next();
};

module.exports = sessionMiddleware;