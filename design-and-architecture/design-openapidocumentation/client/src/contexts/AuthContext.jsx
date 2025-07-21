/**
 * Authentication Context for managing global authentication state
 * Provides authentication state and methods to all components
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import authService from '../services/authService';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * Initialize authentication state
   */
  const initializeAuth = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Initialize the auth service
      const initialized = await authService.initialize();
      if (!initialized) {
        console.warn('Authentication service not properly configured');
        setError('Authentication service configuration missing. Please check environment variables.');
        setIsLoading(false);
        return;
      }

      // Handle auth callback FIRST if present (before checking existing auth)
      const urlParams = new URLSearchParams(window.location.search);
      const authCode = urlParams.get('code');

      if (authCode) {
        console.log('OAuth callback detected, processing auth code...');
        const result = await authService.handleAuthCallback(authCode);
        if (result && result.success) {
          // Use the user data returned directly from handleAuthCallback
          setUser(result.user);
          setIsAuthenticated(true);

          // Clean up URL
          window.history.replaceState({}, document.title, window.location.pathname);
          console.log('OAuth callback processed successfully');
        } else {
          setError('Authentication failed. Please try again.');
        }
      } else {
        // Only check for existing authentication if no OAuth callback
        const currentUser = authService.getCurrentUser();
        const authenticated = authService.isAuthenticated();

        setUser(currentUser);
        setIsAuthenticated(authenticated);
      }
    } catch (err) {
      console.error('Auth initialization error:', err);
      setError('Failed to initialize authentication');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Login function
   */
  const login = useCallback(() => {
    try {
      setError(null);
      authService.login();
    } catch (err) {
      console.error('Login error:', err);
      setError('Failed to initiate login');
    }
  }, []);

  /**
   * Logout function
   */
  const logout = useCallback(async () => {
    try {
      setError(null);
      setIsLoading(true);

      await authService.signOut();

      // Clear local state
      setUser(null);
      setIsAuthenticated(false);
    } catch (err) {
      console.error('Logout error:', err);
      setError('Failed to logout');

      // Clear local state even if logout fails
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Get authentication token
   */
  const getToken = useCallback(async () => {
    try {
      return await authService.getAuthToken();
    } catch (err) {
      console.error('Get token error:', err);
      return null;
    }
  }, []);

  /**
   * Refresh authentication state
   */
  const refreshAuth = useCallback(async () => {
    try {
      const currentUser = authService.getCurrentUser();
      const authenticated = authService.isAuthenticated();

      console.log('Refreshing auth state:', { currentUser: !!currentUser, authenticated });

      setUser(currentUser);
      setIsAuthenticated(authenticated);

      // If user is not authenticated but we had a user before, clear error state
      if (!authenticated) {
        setError(null);
      }
    } catch (err) {
      console.error('Refresh auth error:', err);
      setUser(null);
      setIsAuthenticated(false);
    }
  }, []); // Remove user dependency to avoid stale closures

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Initialize authentication on mount
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // Set up periodic auth state refresh
  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(() => {
      refreshAuth();
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [isAuthenticated, refreshAuth]);

  // Listen for storage changes (for multi-tab logout)
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key && e.key.startsWith('auth_')) {
        refreshAuth();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [refreshAuth]);

  // Listen for auth data cleared events
  useEffect(() => {
    const handleAuthDataCleared = () => {
      console.log('Auth data cleared event received, refreshing auth state...');
      refreshAuth();
    };

    window.addEventListener('authDataCleared', handleAuthDataCleared);
    return () => window.removeEventListener('authDataCleared', handleAuthDataCleared);
  }, [refreshAuth]);

  const value = {
    // State
    user,
    isAuthenticated,
    isLoading,
    error,

    // Methods
    login,
    logout,
    getToken,
    refreshAuth,
    clearError,

    // Utility
    isInitialized: !isLoading,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;