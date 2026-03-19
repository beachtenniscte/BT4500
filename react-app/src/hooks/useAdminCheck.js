import { useState, useEffect, useCallback } from 'react';
import apiService from '../services/api';

/**
 * Custom hook to check if the current user has admin privileges.
 * Used by all admin pages to verify access before rendering content.
 *
 * @returns {Object} An object containing:
 *   - isAdmin: boolean indicating admin status
 *   - loading: boolean indicating if the check is in progress
 *   - error: string or null containing any error message
 *   - recheckAdmin: function to manually re-check admin status
 */
export function useAdminCheck() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const checkAdmin = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const adminCheck = await apiService.isAdmin();
      setIsAdmin(adminCheck);
    } catch (err) {
      console.error('Error checking admin status:', err);
      setError('Failed to verify admin status');
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAdmin();
  }, [checkAdmin]);

  return {
    isAdmin,
    loading,
    error,
    recheckAdmin: checkAdmin
  };
}

export default useAdminCheck;
