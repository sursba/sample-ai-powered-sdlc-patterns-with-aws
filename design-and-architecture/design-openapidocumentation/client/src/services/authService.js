/**
 * Authentication service for AWS Cognito integration
 * Handles login, logout, token management, and secure storage
 */

import { isValidJWTFormat, isTokenExpired, shouldRefreshToken } from '../utils/security';

class AuthService {
  constructor() {
    this.cognitoConfig = {
      region: 'eu-west-1', // Default fallback
      userPoolId: null,
      userPoolClientId: null,
      authDomain: null
    };
    
    this.tokenKey = 'cognito_tokens';
    this.userKey = 'cognito_user';
    this.refreshPromise = null;
    this.configLoaded = false;
  }

  /**
   * Load configuration from environment variables
   */
  async loadConfig() {
    if (this.configLoaded) {
      return this.cognitoConfig;
    }

    try {
      // Load from environment variables directly
      this.cognitoConfig = {
        region: import.meta.env.VITE_AWS_REGION || process.env.REACT_APP_AWS_REGION || 'eu-west-1',
        userPoolId: import.meta.env.VITE_USER_POOL_ID || process.env.REACT_APP_USER_POOL_ID,
        userPoolClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID || process.env.REACT_APP_USER_POOL_CLIENT_ID,
        authDomain: import.meta.env.VITE_AUTH_DOMAIN || process.env.REACT_APP_AUTH_DOMAIN
      };
      
      this.configLoaded = true;
      console.log('Auth config loaded from environment:', this.cognitoConfig);
    } catch (error) {
      console.error('Error loading auth config:', error);
    }

    return this.cognitoConfig;
  }

  /**
   * Initialize the authentication service
   * Validates configuration and sets up token refresh
   */
  async initialize() {
    await this.loadConfig();
    
    if (!this.cognitoConfig.userPoolId || !this.cognitoConfig.userPoolClientId) {
      console.warn('Cognito configuration missing. Authentication will not work properly.');
      return false;
    }
    
    // Set up automatic token refresh
    this.setupTokenRefresh();
    return true;
  }

  /**
   * Get the current authenticated user
   * @returns {Object|null} User object or null if not authenticated
   */
  getCurrentUser() {
    try {
      const userData = this.getSecureItem(this.userKey);
      const tokens = this.getTokens();
      
      // If no user data or tokens, user is not authenticated
      if (!userData || !tokens) {
        return null;
      }
      
      // If we have a refresh token (opaque token), consider the user authenticated even if access token is expired
      // The access token will be refreshed automatically when needed
      // Cognito refresh tokens don't have expiration info we can check, so we trust they're valid
      if (tokens.refreshToken && typeof tokens.refreshToken === 'string' && tokens.refreshToken.length > 0) {
        return JSON.parse(userData);
      }
      
      // If access token is still valid, user is authenticated
      if (tokens.accessToken && !this.isTokenExpired(tokens.accessToken)) {
        return JSON.parse(userData);
      }
      
      // No valid tokens available
      return null;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  /**
   * Get valid authentication token
   * Automatically refreshes if expired
   * @returns {Promise<string|null>} Valid access token or null
   */
  async getAuthToken() {
    try {
      const tokens = this.getTokens();
      if (!tokens) {
        return null;
      }

      // Check if token is expired or will expire soon (within 5 minutes)
      if (this.isTokenExpired(tokens.accessToken, 300)) {
        const refreshedTokens = await this.refreshToken();
        return refreshedTokens ? refreshedTokens.accessToken : null;
      }

      return tokens.accessToken;
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }

  /**
   * Initiate login flow by redirecting to Cognito Hosted UI
   */
  login() {
    const { authDomain, userPoolClientId } = this.cognitoConfig;
    const redirectUri = encodeURIComponent(window.location.origin);
    
    const loginUrl = `https://${authDomain}/login?` +
      `client_id=${userPoolClientId}&` +
      `response_type=code&` +
      `scope=openid+email+profile&` +
      `redirect_uri=${redirectUri}`;
    
    window.location.href = loginUrl;
  }

  /**
   * Handle the callback from Cognito after successful authentication
   * @param {string} authCode - Authorization code from Cognito
   * @returns {Promise<boolean>} Success status
   */
  async handleAuthCallback(authCode) {
    try {
      const tokens = await this.exchangeCodeForTokens(authCode);
      if (!tokens) {
        throw new Error('Failed to exchange code for tokens');
      }

      const userInfo = await this.getUserInfo(tokens.accessToken);
      
      // Store tokens and user info securely
      this.storeTokens(tokens);
      this.storeUserInfo(userInfo);
      
      return true;
    } catch (error) {
      console.error('Error handling auth callback:', error);
      return false;
    }
  }

  /**
   * Sign out the current user
   * Clears local storage and redirects to Cognito logout
   */
  async signOut() {
    try {
      // Clear local storage
      this.clearSecureItem(this.tokenKey);
      this.clearSecureItem(this.userKey);
      
      // Redirect to Cognito logout
      const { authDomain, userPoolClientId } = this.cognitoConfig;
      const logoutUri = encodeURIComponent(window.location.origin);
      
      const logoutUrl = `https://${authDomain}/logout?` +
        `client_id=${userPoolClientId}&` +
        `logout_uri=${logoutUri}`;
      
      window.location.href = logoutUrl;
    } catch (error) {
      console.error('Error during sign out:', error);
      // Clear local storage even if logout URL fails
      this.clearSecureItem(this.tokenKey);
      this.clearSecureItem(this.userKey);
    }
  }

  /**
   * Refresh expired tokens using refresh token
   * @returns {Promise<Object|null>} New tokens or null if refresh failed
   */
  async refreshToken() {
    // Prevent multiple simultaneous refresh attempts
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this._performTokenRefresh();
    const result = await this.refreshPromise;
    this.refreshPromise = null;
    
    return result;
  }

  /**
   * Internal method to perform token refresh
   * @private
   */
  async _performTokenRefresh() {
    try {
      const tokens = this.getTokens();
      if (!tokens || !tokens.refreshToken) {
        return null;
      }

      const response = await fetch(`https://${this.cognitoConfig.authDomain}/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: this.cognitoConfig.userPoolClientId,
          refresh_token: tokens.refreshToken,
        }),
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.status}`);
      }

      const newTokens = await response.json();
      
      // Update stored tokens
      const updatedTokens = {
        ...tokens,
        accessToken: newTokens.access_token,
        idToken: newTokens.id_token,
        // Refresh token might not be returned, keep the old one
        refreshToken: newTokens.refresh_token || tokens.refreshToken,
      };
      
      this.storeTokens(updatedTokens);
      return updatedTokens;
    } catch (error) {
      console.error('Token refresh failed:', error);
      // Clear invalid tokens
      this.clearSecureItem(this.tokenKey);
      this.clearSecureItem(this.userKey);
      return null;
    }
  }

  /**
   * Exchange authorization code for tokens
   * @private
   */
  async exchangeCodeForTokens(code) {
    try {
      const response = await fetch(`https://${this.cognitoConfig.authDomain}/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: this.cognitoConfig.userPoolClientId,
          code: code,
          redirect_uri: window.location.origin,
        }),
      });

      if (!response.ok) {
        throw new Error(`Token exchange failed: ${response.status}`);
      }

      const tokens = await response.json();
      return {
        accessToken: tokens.access_token,
        idToken: tokens.id_token,
        refreshToken: tokens.refresh_token,
      };
    } catch (error) {
      console.error('Error exchanging code for tokens:', error);
      return null;
    }
  }

  /**
   * Get user information from Cognito
   * @private
   */
  async getUserInfo(accessToken) {
    try {
      const response = await fetch(`https://${this.cognitoConfig.authDomain}/oauth2/userInfo`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`User info request failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting user info:', error);
      // Return basic user info from token if userInfo endpoint fails
      return this.parseTokenPayload(accessToken);
    }
  }

  /**
   * Parse JWT token payload
   * @private
   */
  parseTokenPayload(token) {
    try {
      // Validate token format first
      if (!token || typeof token !== 'string') {
        console.warn('Invalid token format: token is not a string');
        return null;
      }

      const parts = token.split('.');
      if (parts.length !== 3) {
        console.warn('Invalid JWT format: token does not have 3 parts');
        return null;
      }

      const base64Url = parts[1];
      if (!base64Url) {
        console.warn('Invalid JWT format: missing payload part');
        return null;
      }

      // Convert base64url to base64
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      
      // Add padding if needed
      const paddedBase64 = base64 + '='.repeat((4 - base64.length % 4) % 4);
      
      // Decode base64 to string
      let decodedString;
      try {
        decodedString = atob(paddedBase64);
      } catch (atobError) {
        console.warn('Failed to decode base64 token payload:', atobError);
        return null;
      }

      // Try direct JSON parsing first (most common case)
      try {
        return JSON.parse(decodedString);
      } catch (directParseError) {
        // If direct parsing fails, try with URI decoding (fallback)
        try {
          const jsonPayload = decodeURIComponent(
            decodedString
              .split('')
              .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
              .join('')
          );
          return JSON.parse(jsonPayload);
        } catch (uriDecodeError) {
          console.warn('Failed to parse token payload with URI decoding:', uriDecodeError);
          return null;
        }
      }
    } catch (error) {
      console.error('Error parsing token payload:', error);
      return null;
    }
  }

  /**
   * Check if token is expired
   * @private
   */
  isTokenExpired(token, bufferSeconds = 0) {
    try {
      const payload = this.parseTokenPayload(token);
      if (!payload || !payload.exp) {
        return true;
      }
      
      const currentTime = Math.floor(Date.now() / 1000);
      return payload.exp <= (currentTime + bufferSeconds);
    } catch (error) {
      return true;
    }
  }

  /**
   * Store tokens securely
   * @private
   */
  storeTokens(tokens) {
    this.storeSecureItem(this.tokenKey, JSON.stringify(tokens));
  }

  /**
   * Store user information securely
   * @private
   */
  storeUserInfo(userInfo) {
    this.storeSecureItem(this.userKey, JSON.stringify(userInfo));
  }

  /**
   * Get stored tokens
   */
  getTokens() {
    try {
      const tokensData = this.getSecureItem(this.tokenKey);
      if (!tokensData) {
        return null;
      }

      const tokens = JSON.parse(tokensData);
      
      // Validate token structure and clear if corrupted
      if (this.areTokensCorrupted(tokens)) {
        console.warn('Detected corrupted tokens, clearing authentication data...');
        this.clearAllAuthData();
        return null;
      }

      return tokens;
    } catch (error) {
      console.error('Error getting tokens:', error);
      // Clear corrupted data if JSON parsing fails
      this.clearAllAuthData();
      return null;
    }
  }

  /**
   * Check if tokens are corrupted
   * @private
   */
  areTokensCorrupted(tokens) {
    if (!tokens || typeof tokens !== 'object') {
      return true;
    }

    // Check JWT tokens (accessToken and idToken) - these should have 3 parts
    const jwtTokenFields = ['accessToken', 'idToken'];
    
    for (const field of jwtTokenFields) {
      const token = tokens[field];
      if (token && typeof token === 'string') {
        // Check if token has proper JWT format (3 parts separated by dots)
        const parts = token.split('.');
        if (parts.length !== 3) {
          console.warn(`Invalid JWT format detected in ${field}: token does not have 3 parts`);
          return true;
        }
        
        // Try to parse the payload to see if it's valid
        const payload = this.parseTokenPayload(token);
        if (!payload) {
          console.warn(`Invalid JWT payload detected in ${field}`);
          return true;
        }
      }
    }

    // Check refresh token - Cognito refresh tokens are NOT JWTs, they are opaque tokens
    // So we just check if it exists and is a non-empty string
    const refreshToken = tokens.refreshToken;
    if (refreshToken && typeof refreshToken === 'string' && refreshToken.length > 0) {
      // Refresh token is valid if it's a non-empty string
      // Don't try to parse it as JWT since Cognito refresh tokens are opaque
      console.log('Refresh token validation completed');
    } else if (refreshToken) {
      console.warn('Invalid refresh token: not a valid string');
      return true;
    }

    return false;
  }

  /**
   * Secure storage methods using localStorage with encryption-like obfuscation
   * In production, consider using httpOnly cookies or more secure storage
   * @private
   */
  setSecureItem(key, value) {
    try {
      // Simple obfuscation (not real encryption, but better than plain text)
      const obfuscated = btoa(encodeURIComponent(value));
      localStorage.setItem(`auth_${key}`, obfuscated);
    } catch (error) {
      console.error('Error storing secure item:', error);
    }
  }

  /**
   * Store item in secure storage with basic obfuscation
   * @private
   */
  storeSecureItem(key, value) {
    try {
      const obfuscated = btoa(encodeURIComponent(value));
      localStorage.setItem(`auth_${key}`, obfuscated);
    } catch (error) {
      console.error('Error storing secure item:', error);
    }
  }

  /**
   * Get item from secure storage
   * @private
   */
  getSecureItem(key) {
    try {
      const obfuscated = localStorage.getItem(`auth_${key}`);
      if (!obfuscated) return null;
      
      return decodeURIComponent(atob(obfuscated));
    } catch (error) {
      console.error('Error getting secure item:', error);
      return null;
    }
  }

  /**
   * Clear item from secure storage
   * @private
   */
  clearSecureItem(key) {
    try {
      localStorage.removeItem(`auth_${key}`);
    } catch (error) {
      console.error('Error clearing secure item:', error);
    }
  }

  /**
   * Clear all authentication data (useful for fixing corrupted tokens)
   */
  clearAllAuthData() {
    try {
      console.log('Clearing all authentication data...');
      
      // Clear secure items
      this.clearSecureItem(this.tokenKey);
      this.clearSecureItem(this.userKey);
      
      // Clear any other auth-related localStorage items
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('auth_')) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
      });
      
      // Dispatch a custom event to notify AuthContext
      window.dispatchEvent(new CustomEvent('authDataCleared'));
      
      console.log('Authentication data cleared successfully');
      return true;
    } catch (error) {
      console.error('Error clearing authentication data:', error);
      return false;
    }
  }

  /**
   * Set up automatic token refresh
   * @private
   */
  setupTokenRefresh() {
    // Check token status every 5 minutes
    setInterval(async () => {
      const tokens = this.getTokens();
      if (tokens && this.isTokenExpired(tokens.accessToken, 600)) { // 10 minutes buffer
        console.log('Access token expiring soon, refreshing...');
        const refreshed = await this.refreshToken();
        if (refreshed) {
          console.log('Token refreshed successfully');
        } else {
          console.warn('Token refresh failed - user may need to re-authenticate');
        }
      }
    }, 5 * 60 * 1000); // 5 minutes
    
    // Also refresh on page focus (when user returns to tab)
    window.addEventListener('focus', async () => {
      const tokens = this.getTokens();
      if (tokens && this.isTokenExpired(tokens.accessToken, 300)) { // 5 minutes buffer
        console.log('Page focused, checking token status...');
        await this.refreshToken();
      }
    });
  }

  /**
   * Handle OAuth callback with authorization code
   * @param {string} code - Authorization code from Cognito
   * @returns {Promise<boolean>} - Success status
   */
  async handleAuthCallback(code) {
    try {
      await this.loadConfig();
      
      if (!this.cognitoConfig.userPoolClientId || !this.cognitoConfig.authDomain) {
        console.error('Auth configuration not loaded');
        return false;
      }

      // Exchange authorization code for tokens
      const tokenResponse = await fetch(`https://${this.cognitoConfig.authDomain}/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: this.cognitoConfig.userPoolClientId,
          code: code,
          redirect_uri: window.location.origin,
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('Token exchange failed:', errorText);
        return false;
      }

      const tokens = await tokenResponse.json();
      
      // Clear any existing corrupted tokens first
      console.log('Clearing any existing tokens before storing new ones...');
      this.clearSecureItem(this.tokenKey);
      this.clearSecureItem(this.userKey);
      
      // Store new tokens
      const tokenData = {
        accessToken: tokens.access_token,
        idToken: tokens.id_token,
        refreshToken: tokens.refresh_token,
        expiresAt: Date.now() + (tokens.expires_in * 1000),
      };
      
      this.storeTokens(tokenData);
      
      // Get user info from ID token
      let userData = null;
      try {
        const userInfo = this.parseTokenPayload(tokens.id_token);
        userData = {
          username: userInfo['cognito:username'] || userInfo.sub,
          email: userInfo.email,
          emailVerified: userInfo.email_verified,
          sub: userInfo.sub,
        };
        this.storeSecureItem(this.userKey, JSON.stringify(userData));
      } catch (parseError) {
        console.warn('Failed to parse user info from token:', parseError);
      }
      
      // Return success with user data
      return { success: true, user: userData };
    } catch (error) {
      console.error('Auth callback error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if user is currently authenticated
   * @returns {boolean} Authentication status
   */
  isAuthenticated() {
    try {
      const user = this.getCurrentUser();
      const tokens = this.getTokens();
      
      // If either user or tokens are null, user is not authenticated
      if (!user || !tokens) {
        return false;
      }
      
      // User is authenticated if they have a valid refresh token (opaque) OR a valid access token (JWT)
      // Cognito refresh tokens are opaque, so we just check if they exist and are non-empty strings
      const hasValidRefreshToken = tokens.refreshToken && 
                                   typeof tokens.refreshToken === 'string' && 
                                   tokens.refreshToken.length > 0;
      const hasValidAccessToken = tokens.accessToken && !this.isTokenExpired(tokens.accessToken);
      
      return !!(hasValidRefreshToken || hasValidAccessToken);
    } catch (error) {
      console.error('Error checking authentication status:', error);
      return false;
    }
  }

  /**
   * Get session information
   * @returns {Object} Session details
   */
  getSessionInfo() {
    const tokens = this.getTokens();
    if (!tokens) {
      return { authenticated: false };
    }

    const accessTokenPayload = this.parseTokenPayload(tokens.accessToken);
    const refreshTokenPayload = this.parseTokenPayload(tokens.refreshToken);
    
    const now = Math.floor(Date.now() / 1000);
    const accessTokenExpiresIn = accessTokenPayload?.exp ? (accessTokenPayload.exp - now) : 0;
    const refreshTokenExpiresIn = refreshTokenPayload?.exp ? (refreshTokenPayload.exp - now) : 0;

    return {
      authenticated: this.isAuthenticated(),
      accessTokenExpiresIn: Math.max(0, accessTokenExpiresIn),
      refreshTokenExpiresIn: Math.max(0, refreshTokenExpiresIn),
      accessTokenExpiresAt: accessTokenPayload?.exp ? new Date(accessTokenPayload.exp * 1000) : null,
      refreshTokenExpiresAt: refreshTokenPayload?.exp ? new Date(refreshTokenPayload.exp * 1000) : null,
      sessionDuration: refreshTokenExpiresIn > 0 ? `${Math.floor(refreshTokenExpiresIn / 86400)} days` : 'Expired'
    };
  }

  /**
   * Validate a JWT token
   * @param {string} token - Token to validate
   * @returns {boolean} Validation result
   */
  validateToken(token) {
    if (!token) return false;
    
    try {
      const payload = this.parseTokenPayload(token);
      if (!payload) return false;
      
      // Check expiration
      if (this.isTokenExpired(token)) return false;
      
      // Check issuer
      const expectedIssuer = `https://cognito-idp.${this.cognitoConfig.region}.amazonaws.com/${this.cognitoConfig.userPoolId}`;
      if (payload.iss !== expectedIssuer) return false;
      
      // Check audience (client ID)
      if (payload.aud !== this.cognitoConfig.userPoolClientId) return false;
      
      return true;
    } catch (error) {
      console.error('Token validation error:', error);
      return false;
    }
  }

  /**
   * Get AWS credentials for authenticated requests
   * @returns {Promise<Object|null>} AWS credentials or null
   */
  async getAwsCredentials() {
    try {
      const tokens = this.getTokens();
      if (!tokens || !tokens.idToken) {
        return null;
      }

      // For now, we'll use the ID token directly as credentials
      // In a full implementation, you'd exchange this for temporary AWS credentials
      // via Cognito Identity Pool
      return {
        accessKeyId: 'COGNITO_TOKEN',
        secretAccessKey: 'COGNITO_TOKEN', 
        sessionToken: tokens.idToken,
        // Custom property to indicate this is a Cognito token
        cognitoToken: tokens.idToken
      };
    } catch (error) {
      console.error('Error getting AWS credentials:', error);
      return null;
    }
  }
}

// Create and export singleton instance
const authService = new AuthService();
export default authService;