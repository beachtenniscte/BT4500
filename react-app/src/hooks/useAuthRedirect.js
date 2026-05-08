import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Custom hook that redirects authenticated users to a specified path.
 * Used by Login and Register pages to redirect already logged-in users.
 *
 * Reads from AuthContext so no extra /auth/me request is made.
 *
 * @param {string} redirectTo - The path to redirect to if user is authenticated (default: '/profile')
 */
export function useAuthRedirect(redirectTo = '/profile') {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user && user.user) {
      navigate(redirectTo);
    }
  }, [user, loading, navigate, redirectTo]);
}

export default useAuthRedirect;
