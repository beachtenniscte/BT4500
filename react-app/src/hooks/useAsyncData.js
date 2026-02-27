import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for handling async data fetching with loading and error states
 *
 * @param {Function} fetchFn - Async function that fetches data
 * @param {Array} deps - Dependencies array for re-fetching
 * @param {object} options - Configuration options
 * @param {boolean} options.immediate - Fetch immediately on mount (default: true)
 * @param {any} options.initialData - Initial data value
 * @returns {object} Data, loading, error states and refetch function
 */
export function useAsyncData(fetchFn, deps = [], options = {}) {
  const {
    immediate = true,
    initialData = null
  } = options;

  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await fetchFn();
      setData(result);
      return result;
    } catch (err) {
      console.error('useAsyncData error:', err);
      setError(err.message || 'Erro ao carregar dados');
      return null;
    } finally {
      setLoading(false);
    }
  }, [fetchFn]);

  useEffect(() => {
    if (immediate) {
      fetch();
    }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  const refetch = useCallback(() => {
    return fetch();
  }, [fetch]);

  return {
    data,
    loading,
    error,
    refetch,
    setData
  };
}

export default useAsyncData;
