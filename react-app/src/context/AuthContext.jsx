import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import apiService from '../services/api';

const AuthContext = createContext(null);

const hasToken = () => !!localStorage.getItem('bt4500_token');

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // Only show "loading" if we have a token to verify. With no token we
  // already know the user is logged out and can render immediately.
  const [loading, setLoading] = useState(() => hasToken());
  const mountedRef = useRef(true);

  const load = useCallback(async ({ force = false } = {}) => {
    if (!hasToken()) {
      setUser(null);
      setLoading(false);
      return null;
    }
    setLoading(true);
    const result = await apiService.getCurrentUser({ force });
    if (mountedRef.current) {
      setUser(result);
      setLoading(false);
    }
    return result;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => {
      mountedRef.current = false;
    };
  }, [load]);

  const refresh = useCallback(() => load({ force: true }), [load]);

  const logout = useCallback(() => {
    apiService.logout();
    setUser(null);
    setLoading(false);
  }, []);

  const isAuthenticated = !!user || (loading && hasToken());
  const isAdmin = user?.user?.role === 'admin';

  const value = {
    user,
    isAuthenticated,
    isAdmin,
    loading,
    refresh,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

export default AuthContext;
