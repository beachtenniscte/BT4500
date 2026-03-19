import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api';

/**
 * Custom hook that redirects authenticated users to a specified path.
 * Used by Login and Register pages to redirect already logged-in users.
 *
 * @param {string} redirectTo - The path to redirect to if user is authenticated (default: '/profile')
 */
export function useAuthRedirect(redirectTo = '/profile') {
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const userData = await apiService.getCurrentUser();
        if (userData && userData.user) {
          navigate(redirectTo);
        }
      } catch (err) {
        // User is not authenticated, no action needed
        console.debug('User not authenticated');
      }
    };

    checkAuth();
  }, [navigate, redirectTo]);
}

export default useAuthRedirect;
