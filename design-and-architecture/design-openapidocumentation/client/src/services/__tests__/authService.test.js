/**
 * Unit tests for AuthService
 * Tests core authentication functionality
 */

import authService from '../authService';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock fetch
global.fetch = jest.fn();

// Mock window.location
delete window.location;
window.location = {
  href: '',
  origin: 'http://localhost:3000',
  search: '',
  pathname: '/',
};

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    fetch.mockClear();
    window.location.href = '';
    
    // Mock environment variables for each test
    process.env.REACT_APP_AWS_REGION = 'us-east-1';
    process.env.REACT_APP_USER_POOL_ID = 'us-east-1_test123';
    process.env.REACT_APP_USER_POOL_CLIENT_ID = 'test-client-id';
    process.env.REACT_APP_AUTH_DOMAIN = 'test-domain.auth.us-east-1.amazoncognito.com';
    
    // Reinitialize the auth service config
    authService.cognitoConfig = {
      region: process.env.REACT_APP_AWS_REGION || 'us-east-1',
      userPoolId: process.env.REACT_APP_USER_POOL_ID,
      userPoolClientId: process.env.REACT_APP_USER_POOL_CLIENT_ID,
      authDomain: process.env.REACT_APP_AUTH_DOMAIN
    };
  });

  describe('initialize', () => {
    it('should initialize successfully with valid config', () => {
      const result = authService.initialize();
      expect(result).toBe(true);
    });

    it('should warn and return false with missing config', () => {
      const originalConfig = authService.cognitoConfig;
      authService.cognitoConfig = { ...originalConfig, userPoolId: null };
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const result = authService.initialize();
      
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Cognito configuration missing. Authentication will not work properly.'
      );
      
      authService.cognitoConfig = originalConfig;
      consoleSpy.mockRestore();
    });
  });

  describe('getCurrentUser', () => {
    it('should return null when no user data exists', () => {
      const user = authService.getCurrentUser();
      expect(user).toBeNull();
    });

    it('should return user data when valid tokens exist', () => {
      const mockUser = { username: 'testuser', email: 'test@example.com' };
      const mockTokens = {
        accessToken: createMockJWT({ exp: Math.floor(Date.now() / 1000) + 3600 }),
        idToken: 'mock-id-token',
        refreshToken: 'mock-refresh-token',
      };

      // Mock localStorage calls in the correct order
      localStorageMock.getItem
        .mockImplementation((key) => {
          if (key === 'auth_cognito_user') {
            return btoa(encodeURIComponent(JSON.stringify(mockUser)));
          }
          if (key === 'auth_cognito_tokens') {
            return btoa(encodeURIComponent(JSON.stringify(mockTokens)));
          }
          return null;
        });

      const user = authService.getCurrentUser();
      expect(user).toEqual(mockUser);
    });

    it('should return null when tokens are expired', () => {
      const mockUser = { username: 'testuser', email: 'test@example.com' };
      const mockTokens = {
        accessToken: createMockJWT({ exp: Math.floor(Date.now() / 1000) - 3600 }), // Expired
        idToken: 'mock-id-token',
        refreshToken: 'mock-refresh-token',
      };

      localStorageMock.getItem
        .mockReturnValueOnce(btoa(encodeURIComponent(JSON.stringify(mockUser))))
        .mockReturnValueOnce(btoa(encodeURIComponent(JSON.stringify(mockTokens))));

      const user = authService.getCurrentUser();
      expect(user).toBeNull();
    });
  });

  describe('login', () => {
    it('should redirect to Cognito login URL', () => {
      authService.login();
      
      expect(window.location.href).toContain('test-domain.auth.us-east-1.amazoncognito.com/login');
      expect(window.location.href).toContain('client_id=test-client-id');
      expect(window.location.href).toContain('response_type=code');
      expect(window.location.href).toContain('scope=openid+email+profile');
    });
  });

  describe('isAuthenticated', () => {
    it('should return false when no user or tokens exist', () => {
      expect(authService.isAuthenticated()).toBe(false);
    });

    it('should return true when valid user and tokens exist', () => {
      const mockUser = { username: 'testuser' };
      const mockTokens = {
        accessToken: createMockJWT({ exp: Math.floor(Date.now() / 1000) + 3600 }),
      };

      localStorageMock.getItem
        .mockImplementation((key) => {
          if (key === 'auth_cognito_user') {
            return btoa(encodeURIComponent(JSON.stringify(mockUser)));
          }
          if (key === 'auth_cognito_tokens') {
            return btoa(encodeURIComponent(JSON.stringify(mockTokens)));
          }
          return null;
        });

      expect(authService.isAuthenticated()).toBe(true);
    });

    it('should return false when tokens are expired', () => {
      const mockUser = { username: 'testuser' };
      const mockTokens = {
        accessToken: createMockJWT({ exp: Math.floor(Date.now() / 1000) - 3600 }),
      };

      localStorageMock.getItem
        .mockReturnValueOnce(btoa(encodeURIComponent(JSON.stringify(mockUser))))
        .mockReturnValueOnce(btoa(encodeURIComponent(JSON.stringify(mockTokens))));

      expect(authService.isAuthenticated()).toBe(false);
    });
  });

  describe('validateToken', () => {
    it('should return false for null token', () => {
      expect(authService.validateToken(null)).toBe(false);
    });

    it('should return false for expired token', () => {
      const expiredToken = createMockJWT({ exp: Math.floor(Date.now() / 1000) - 3600 });
      expect(authService.validateToken(expiredToken)).toBe(false);
    });

    it('should return false for token with wrong issuer', () => {
      const invalidToken = createMockJWT({
        exp: Math.floor(Date.now() / 1000) + 3600,
        iss: 'https://wrong-issuer.com',
        aud: 'test-client-id',
      });
      expect(authService.validateToken(invalidToken)).toBe(false);
    });

    it('should return false for token with wrong audience', () => {
      const invalidToken = createMockJWT({
        exp: Math.floor(Date.now() / 1000) + 3600,
        iss: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test123',
        aud: 'wrong-client-id',
      });
      expect(authService.validateToken(invalidToken)).toBe(false);
    });

    it('should return true for valid token', () => {
      const validToken = createMockJWT({
        exp: Math.floor(Date.now() / 1000) + 3600,
        iss: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test123',
        aud: 'test-client-id',
      });
      expect(authService.validateToken(validToken)).toBe(true);
    });
  });

  describe('getAuthToken', () => {
    it('should return null when no tokens exist', async () => {
      const token = await authService.getAuthToken();
      expect(token).toBeNull();
    });

    it('should return valid token when not expired', async () => {
      const mockTokens = {
        accessToken: createMockJWT({ exp: Math.floor(Date.now() / 1000) + 3600 }),
        refreshToken: 'mock-refresh-token',
      };

      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'auth_cognito_tokens') {
          return btoa(encodeURIComponent(JSON.stringify(mockTokens)));
        }
        return null;
      });

      const token = await authService.getAuthToken();
      expect(token).toBe(mockTokens.accessToken);
    });
  });

  describe('handleAuthCallback', () => {
    it('should handle successful auth callback', async () => {
      const mockTokens = {
        access_token: 'new-access-token',
        id_token: 'new-id-token',
        refresh_token: 'new-refresh-token',
      };

      const mockUserInfo = {
        username: 'testuser',
        email: 'test@example.com',
      };

      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTokens),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockUserInfo),
        });

      const result = await authService.handleAuthCallback('test-auth-code');
      
      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(localStorageMock.setItem).toHaveBeenCalledTimes(2);
    });

    it('should handle failed token exchange', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
      });

      const result = await authService.handleAuthCallback('invalid-code');
      expect(result).toBe(false);
    });
  });

  describe('signOut', () => {
    it('should clear storage and redirect to logout URL', async () => {
      await authService.signOut();
      
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_cognito_tokens');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_cognito_user');
      expect(window.location.href).toContain('test-domain.auth.us-east-1.amazoncognito.com/logout');
    });
  });
});

/**
 * Helper function to create mock JWT tokens
 */
function createMockJWT(payload = {}) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const defaultPayload = {
    sub: 'test-user-id',
    aud: 'test-client-id',
    iss: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test123',
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
  };

  const finalPayload = { ...defaultPayload, ...payload };

  const encodedHeader = btoa(JSON.stringify(header));
  const encodedPayload = btoa(JSON.stringify(finalPayload));
  const signature = 'mock-signature';

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}