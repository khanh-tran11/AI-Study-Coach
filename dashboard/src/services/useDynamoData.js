import { useState, useEffect } from 'react';

/**
 * Generic async data fetcher hook.
 * @param {Function} fetchFn - async function that returns data
 * @param {Array} deps - dependency array for re-fetching
 * @param {any} fallbackData - data to use if DynamoDB is not configured (mock data)
 */
export function useDynamoData(fetchFn, deps = [], fallbackData = null) {
  const [data, setData] = useState(fallbackData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // If no AWS credentials configured, use fallback (mock) data
      const hasCredentials = import.meta.env.VITE_AWS_ACCESS_KEY_ID;
      if (!hasCredentials && fallbackData) {
        setData(fallbackData);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await fetchFn();
        if (!cancelled) {
          setData(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to load data');
          // Fall back to mock data on error
          if (fallbackData) {
            setData(fallbackData);
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, loading, error };
}
