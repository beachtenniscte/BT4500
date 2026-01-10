// API Service Layer
// Configure your API base URL here
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/**
 * Get auth token from localStorage
 */
function getAuthToken() {
  return localStorage.getItem('bt4500_token');
}

/**
 * Set auth token in localStorage
 */
function setAuthToken(token) {
  localStorage.setItem('bt4500_token', token);
}

/**
 * Remove auth token from localStorage
 */
function removeAuthToken() {
  localStorage.removeItem('bt4500_token');
}

/**
 * Generic fetch wrapper with error handling
 */
async function fetchAPI(endpoint, options = {}) {
  try {
    const token = getAuthToken();
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers,
      ...options,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `API Error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`API request failed for ${endpoint}:`, error);
    throw error;
  }
}

/**
 * API Service Object
 */
const apiService = {
  // Auth token management
  setToken: setAuthToken,
  removeToken: removeAuthToken,
  getToken: getAuthToken,

  /**
   * Login user
   * POST /auth/login
   */
  login: async (email, password) => {
    const response = await fetchAPI('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (response.token) {
      setAuthToken(response.token);
    }
    return response;
  },

  /**
   * Register user
   * POST /auth/register
   */
  register: async (userData) => {
    const response = await fetchAPI('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    if (response.token) {
      setAuthToken(response.token);
    }
    return response;
  },

  /**
   * Logout user
   */
  logout: () => {
    removeAuthToken();
  },

  /**
   * Get current user
   * GET /auth/me
   */
  getCurrentUser: async () => {
    try {
      return await fetchAPI('/auth/me');
    } catch (error) {
      return null;
    }
  },

  /**
   * Get info page content (static for now)
   */
  getInfo: async () => {
    // Return static content - can be extended to fetch from API
    return null;
  },

  /**
   * Get list of tournaments
   * GET /tournaments
   */
  getTournaments: async (params = {}) => {
    try {
      const query = new URLSearchParams(params).toString();
      const response = await fetchAPI(`/tournaments${query ? `?${query}` : ''}`);
      return response.data;
    } catch (error) {
      return null;
    }
  },

  /**
   * Get list of provas (tournaments formatted for UI)
   * GET /tournaments
   */
  getProvas: async () => {
    try {
      const response = await fetchAPI('/tournaments?year=2025&orderBy=start_date&order=ASC');
      // Transform tournament data to prova format
      if (response.data) {
        return response.data.map(t => ({
          id: t.id,
          type: t.tier,
          dates: formatTournamentDates(t.start_date, t.end_date),
          status: t.status === 'completed' ? 'completed' : 'upcoming',
          name: t.name,
          uuid: t.uuid
        }));
      }
      return null;
    } catch (error) {
      return null;
    }
  },

  /**
   * Get specific tournament by UUID
   * GET /tournaments/:uuid
   */
  getTournament: async (uuid) => {
    try {
      return await fetchAPI(`/tournaments/${uuid}`);
    } catch (error) {
      return null;
    }
  },

  /**
   * Get tournament matches
   * GET /tournaments/:uuid/matches
   */
  getTournamentMatches: async (uuid, category = null) => {
    try {
      const query = category ? `?category=${category}` : '';
      const response = await fetchAPI(`/tournaments/${uuid}/matches${query}`);
      return response.data;
    } catch (error) {
      return null;
    }
  },

  /**
   * Get tournament standings
   * GET /tournaments/:uuid/standings
   */
  getTournamentStandings: async (uuid, category = null) => {
    try {
      const query = category ? `?category=${category}` : '';
      const response = await fetchAPI(`/tournaments/${uuid}/standings${query}`);
      return response.data;
    } catch (error) {
      return null;
    }
  },

  /**
   * Get player rankings
   * GET /players/rankings
   */
  getRankings: async (params = {}) => {
    try {
      const query = new URLSearchParams(params).toString();
      const response = await fetchAPI(`/players/rankings${query ? `?${query}` : ''}`);
      return response.data;
    } catch (error) {
      return null;
    }
  },

  /**
   * Get classification/standings (rankings)
   * GET /players/rankings
   * @param {string} gender - Optional gender filter: 'M', 'F', or null for all
   * @param {number} limit - Number of results to return
   */
  getClassification: async (gender = null, limit = 20) => {
    try {
      const params = new URLSearchParams({ limit: limit.toString() });
      if (gender) {
        params.append('gender', gender);
      }
      const response = await fetchAPI(`/players/rankings?${params.toString()}`);
      // Transform to classification format
      if (response.data) {
        return response.data.map(p => ({
          position: p.rankPosition,
          team: p.full_name,
          points: p.total_points,
          gender: p.gender,
          uuid: p.uuid,
          games: 0, // Would need match count
          wins: 0   // Would need win count
        }));
      }
      return null;
    } catch (error) {
      return null;
    }
  },

  /**
   * Get players list
   * GET /players
   */
  getPlayers: async (params = {}) => {
    try {
      const query = new URLSearchParams(params).toString();
      const response = await fetchAPI(`/players${query ? `?${query}` : ''}`);
      return response.data;
    } catch (error) {
      return null;
    }
  },

  /**
   * Get player by UUID
   * GET /players/:uuid
   */
  getPlayer: async (uuid) => {
    try {
      return await fetchAPI(`/players/${uuid}`);
    } catch (error) {
      return null;
    }
  },

  /**
   * Get player stats
   * GET /players/:uuid/stats
   */
  getPlayerStats: async (uuid) => {
    try {
      return await fetchAPI(`/players/${uuid}/stats`);
    } catch (error) {
      return null;
    }
  },

  /**
   * Get player tournament history
   * GET /players/:uuid/tournaments
   */
  getPlayerTournaments: async (uuid, limit = 10) => {
    try {
      const response = await fetchAPI(`/players/${uuid}/tournaments?limit=${limit}`);
      return response.data;
    } catch (error) {
      return null;
    }
  },

  /**
   * Get user profile (player profile for logged in user)
   * GET /auth/me + /players/:uuid
   */
  getProfile: async (uuid) => {
    try {
      if (uuid) {
        return await fetchAPI(`/players/${uuid}`);
      }
      // Get current user's player profile
      const user = await fetchAPI('/auth/me');
      if (user.player) {
        return await fetchAPI(`/players/${user.player.id}`);
      }
      return null;
    } catch (error) {
      return null;
    }
  },

  /**
   * Update player profile
   * PUT /players/:uuid
   */
  updateProfile: async (uuid, profileData) => {
    return await fetchAPI(`/players/${uuid}`, {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  },

  /**
   * Get points table
   * GET /points
   */
  getPointsTable: async (tier = null) => {
    try {
      const query = tier ? `?tier=${tier}` : '';
      const response = await fetchAPI(`/points${query}`);
      return response.data;
    } catch (error) {
      return null;
    }
  },

  /**
   * Get matches
   * GET /matches
   */
  getMatches: async (params = {}) => {
    try {
      const query = new URLSearchParams(params).toString();
      const response = await fetchAPI(`/matches${query ? `?${query}` : ''}`);
      return response.data;
    } catch (error) {
      return null;
    }
  },

  /**
   * Get live matches (today)
   * GET /matches/status/live
   */
  getLiveMatches: async () => {
    try {
      const response = await fetchAPI('/matches/status/live');
      return response.data;
    } catch (error) {
      return null;
    }
  },

  // ==================== ADMIN ENDPOINTS ====================

  /**
   * Import tournament from CSV file
   * POST /admin/import-csv
   */
  importCSV: async (file, calculatePoints = true) => {
    const token = getAuthToken();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('calculatePoints', calculatePoints.toString());

    const response = await fetch(`${API_BASE_URL}/admin/import-csv`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Import failed: ${response.status}`);
    }

    return await response.json();
  },

  /**
   * Import multiple tournaments from CSV files (processed sequentially)
   * POST /admin/import-csv-multiple
   */
  importCSVMultiple: async (files, calculatePoints = true) => {
    const token = getAuthToken();
    const formData = new FormData();

    // Append all files with the same field name 'files'
    for (const file of files) {
      formData.append('files', file);
    }
    formData.append('calculatePoints', calculatePoints.toString());

    const response = await fetch(`${API_BASE_URL}/admin/import-csv-multiple`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Import failed: ${response.status}`);
    }

    return await response.json();
  },

  /**
   * Get admin dashboard stats
   * GET /admin/stats
   */
  getAdminStats: async () => {
    try {
      return await fetchAPI('/admin/stats');
    } catch (error) {
      return null;
    }
  },

  /**
   * Get all users (admin only)
   * GET /admin/users
   */
  getUsers: async (params = {}) => {
    try {
      const query = new URLSearchParams(params).toString();
      const response = await fetchAPI(`/admin/users${query ? `?${query}` : ''}`);
      return response.data;
    } catch (error) {
      return null;
    }
  },

  /**
   * Update user role
   * PUT /admin/users/:id/role
   */
  updateUserRole: async (userId, role) => {
    return await fetchAPI(`/admin/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    });
  },

  /**
   * Recalculate all rankings
   * POST /admin/recalculate-rankings
   */
  recalculateRankings: async () => {
    return await fetchAPI('/admin/recalculate-rankings', {
      method: 'POST',
    });
  },

  /**
   * Get admin tournaments list
   * GET /admin/tournaments
   */
  getAdminTournaments: async () => {
    try {
      const response = await fetchAPI('/admin/tournaments');
      return response.data;
    } catch (error) {
      return null;
    }
  },

  /**
   * Delete tournament
   * DELETE /admin/tournaments/:id
   */
  deleteTournament: async (tournamentId) => {
    return await fetchAPI(`/admin/tournaments/${tournamentId}`, {
      method: 'DELETE',
    });
  },

  /**
   * Check if current user is admin
   */
  isAdmin: async () => {
    try {
      const user = await fetchAPI('/auth/me');
      return user?.user?.role === 'admin';
    } catch (error) {
      return false;
    }
  },
};

/**
 * Helper function to format tournament dates
 */
function formatTournamentDates(startDate, endDate) {
  const months = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

  const start = new Date(startDate);
  const end = new Date(endDate);

  const startDay = start.getDate();
  const endDay = end.getDate();
  const month = months[start.getMonth()];

  return `${startDay}-${endDay} ${month}`;
}

export default apiService;
