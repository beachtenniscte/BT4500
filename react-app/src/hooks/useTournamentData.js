import { useState, useEffect, useCallback } from 'react';
import apiService from '../services/api';

/**
 * Custom hook for fetching tournament data with related entities
 *
 * @param {string} uuid - Tournament UUID
 * @param {object} options - Configuration options
 * @param {boolean} options.includeWinners - Fetch winners for completed tournaments
 * @param {boolean} options.includeSignupInfo - Fetch signup info for scheduled tournaments
 * @returns {object} Tournament data, loading, error states and refetch function
 */
export function useTournamentData(uuid, options = {}) {
  const {
    includeWinners = true,
    includeSignupInfo = true
  } = options;

  const [tournament, setTournament] = useState(null);
  const [categories, setCategories] = useState([]);
  const [winners, setWinners] = useState([]);
  const [runnerUps, setRunnerUps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = useCallback(async () => {
    if (!uuid) {
      setError('UUID do torneio nao fornecido');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch main tournament data
      const data = await apiService.getTournament(uuid);

      if (!data) {
        setError('Torneio nao encontrado');
        return;
      }

      setTournament(data.tournament);
      setCategories(data.categories || []);

      // Fetch winners + runners-up only when the tournament is closed
      if (includeWinners && data.tournament.status === 'completed') {
        try {
          const [winnersData, runnerUpsData] = await Promise.all([
            apiService.getTournamentWinners(uuid),
            apiService.getTournamentRunnerUps(uuid)
          ]);
          setWinners(winnersData || []);
          setRunnerUps(runnerUpsData || []);
        } catch (winnersErr) {
          console.warn('Failed to load winners/runners-up:', winnersErr);
        }
      }

      // Fetch signup info only when registrations are open
      if (includeSignupInfo && data.tournament.status === 'open_registration') {
        try {
          const signupInfo = await apiService.getTournamentSignupInfo(uuid);
          if (signupInfo?.categories) {
            setCategories(signupInfo.categories);
          }
        } catch (signupErr) {
          console.warn('Failed to load signup info:', signupErr);
        }
      }
    } catch (err) {
      console.error('Error loading tournament:', err);
      setError('Erro ao carregar torneio');
    } finally {
      setLoading(false);
    }
  }, [uuid, includeWinners, includeSignupInfo]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getWinnerForCategory = useCallback((categoryCode) => {
    return winners.find(w => w.category_code === categoryCode);
  }, [winners]);

  const getRunnerUpForCategory = useCallback((categoryCode) => {
    return runnerUps.find(r => r.category_code === categoryCode);
  }, [runnerUps]);

  return {
    tournament,
    categories,
    winners,
    runnerUps,
    loading,
    error,
    refetch: loadData,
    getWinnerForCategory,
    getRunnerUpForCategory
  };
}

export default useTournamentData;
