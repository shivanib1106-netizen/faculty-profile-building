import React, { createContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../api/authApi';
import {
  getToken,
  setToken,
  removeToken,
  getStoredUser,
  setStoredUser,
  isRememberedSession,
  onUnauthorized,
} from '../api/apiClient';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => getStoredUser());
  const [token, setTokenState] = useState(() => getToken());
  const [isLoading, setIsLoading] = useState(() => Boolean(getToken()));

  // Re-validate an existing session once on mount.
  useEffect(() => {
    let active = true;
    const storedToken = getToken();

    if (!storedToken) {
      setIsLoading(false);
      return () => {
        active = false;
      };
    }

    authApi
      .getCurrentUser()
      .then((profile) => {
        if (!active) return;
        const normalized = profile?.user || profile;
        setUser(normalized);
        setStoredUser(normalized, isRememberedSession());
        setTokenState(storedToken);
      })
      .catch(() => {
        if (!active) return;
        // apiClient already clears an expired token.
        removeToken();
        setUser(null);
        setTokenState(null);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  // A 401 from any request signs the user out exactly once.
  useEffect(() => {
    const unsubscribe = onUnauthorized(() => {
      setUser(null);
      setTokenState(null);
    });
    return unsubscribe;
  }, []);

  const login = useCallback(async (identifier, password, rememberMe = false) => {
    const response = await authApi.login({ identifier, password });
    if (!response?.token || !response?.user) {
      throw new Error('The server did not return a valid session. Please contact the administrator.');
    }
    setToken(response.token, rememberMe);
    setStoredUser(response.user, rememberMe);
    setUser(response.user);
    setTokenState(response.token);
    return response;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      setTokenState(null);
    }
  }, []);

  const updateUser = useCallback((updatedFields) => {
    setUser((previous) => {
      if (!previous) return previous;
      const updated = { ...previous, ...updatedFields };
      setStoredUser(updated, isRememberedSession());
      return updated;
    });
  }, []);

  const refreshUser = useCallback(async () => {
    const profile = await authApi.getCurrentUser();
    const normalized = profile?.user || profile;
    setUser(normalized);
    setStoredUser(normalized, isRememberedSession());
    return normalized;
  }, []);

  const role = user?.role || null;

  const value = {
    user,
    token,
    role,
    isAuthenticated: Boolean(user && token),
    isLoading,
    login,
    logout,
    updateUser,
    refreshUser,
    isFaculty: role === 'faculty',
    isHOD: role === 'hod',
    isAdmin: role === 'admin',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
