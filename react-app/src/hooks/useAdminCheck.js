import { useAuth } from '../context/AuthContext';

/**
 * Custom hook to check if the current user has admin privileges.
 *
 * Thin shim over AuthContext so that admin pages keep their existing
 * call sites unchanged while sharing one cached /auth/me response.
 *
 * @returns {Object} An object containing:
 *   - isAdmin: boolean indicating admin status
 *   - loading: boolean indicating if the auth check is in progress
 *   - error: string or null containing any error message
 *   - recheckAdmin: function to force-refresh the auth state
 */
export function useAdminCheck() {
  const { isAdmin, loading, refresh } = useAuth();

  return {
    isAdmin,
    loading,
    error: null,
    recheckAdmin: refresh,
  };
}

export default useAdminCheck;
