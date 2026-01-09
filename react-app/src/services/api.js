// API Service Layer
// Configure your API base URL here
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

/**
 * Generic fetch wrapper with error handling
 */
async function fetchAPI(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
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
  /**
   * Get info page content
   * GET /info
   */
  getInfo: async () => {
    try {
      return await fetchAPI('/info');
    } catch (error) {
      // Return null on error - component will use default data
      return null;
    }
  },

  /**
   * Get list of provas (events)
   * GET /provas
   */
  getProvas: async () => {
    try {
      return await fetchAPI('/provas');
    } catch (error) {
      return null;
    }
  },

  /**
   * Get specific prova by ID
   * GET /provas/:id
   */
  getProvaById: async (id) => {
    try {
      return await fetchAPI(`/provas/${id}`);
    } catch (error) {
      return null;
    }
  },

  /**
   * Get classification/standings
   * GET /classification
   */
  getClassification: async () => {
    try {
      return await fetchAPI('/classification');
    } catch (error) {
      return null;
    }
  },

  /**
   * Create a new prova (admin function)
   * POST /provas
   */
  createProva: async (provaData) => {
    try {
      return await fetchAPI('/provas', {
        method: 'POST',
        body: JSON.stringify(provaData),
      });
    } catch (error) {
      throw error;
    }
  },

  /**
   * Update classification data (admin function)
   * PUT /classification/:id
   */
  updateClassification: async (id, teamData) => {
    try {
      return await fetchAPI(`/classification/${id}`, {
        method: 'PUT',
        body: JSON.stringify(teamData),
      });
    } catch (error) {
      throw error;
    }
  },

  /**
   * Delete a prova (admin function)
   * DELETE /provas/:id
   */
  deleteProva: async (id) => {
    try {
      return await fetchAPI(`/provas/${id}`, {
        method: 'DELETE',
      });
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get user profile
   * GET /profile/:id
   */
  getProfile: async (id) => {
    try {
      const endpoint = id ? `/profile/${id}` : '/profile';
      return await fetchAPI(endpoint);
    } catch (error) {
      return null;
    }
  },

  /**
   * Update user profile
   * PUT /profile/:id
   */
  updateProfile: async (id, profileData) => {
    try {
      return await fetchAPI(`/profile/${id}`, {
        method: 'PUT',
        body: JSON.stringify(profileData),
      });
    } catch (error) {
      throw error;
    }
  },
};

export default apiService;
