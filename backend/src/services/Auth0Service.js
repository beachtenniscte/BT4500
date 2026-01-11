const axios = require('axios');

/**
 * Auth0 Service for handling authentication without redirects
 * Uses Resource Owner Password Grant flow
 */
class Auth0Service {
  /**
   * Get domain (strips https:// if present)
   */
  get domain() {
    let domain = process.env.AUTH0_DOMAIN || '';
    // Remove https:// or http:// if present
    domain = domain.replace(/^https?:\/\//, '');
    // Remove trailing slash if present
    domain = domain.replace(/\/$/, '');
    return domain;
  }

  get clientId() {
    return process.env.AUTH0_CLIENT_ID;
  }

  get clientSecret() {
    return process.env.AUTH0_CLIENT_SECRET;
  }

  get audience() {
    return process.env.AUTH0_AUDIENCE;
  }

  get connection() {
    return process.env.AUTH0_CONNECTION || 'Username-Password-Authentication';
  }

  /**
   * Check if Auth0 is configured
   */
  isConfigured() {
    return !!(this.domain && this.clientId && this.clientSecret);
  }

  /**
   * Generate a secure random password for Auth0 users who login via social
   * They won't use this password - it's just to satisfy Auth0's requirements
   */
  generateSecurePassword() {
    const crypto = require('crypto');
    const length = 32;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    const randomBytes = crypto.randomBytes(length);
    for (let i = 0; i < length; i++) {
      password += chars[randomBytes[i] % chars.length];
    }
    return password;
  }

  /**
   * Login user with email/password using Resource Owner Password Grant
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<{access_token: string, id_token: string, expires_in: number}>}
   */
  async login(email, password) {
    if (!this.isConfigured()) {
      throw new Error('Auth0 is not configured');
    }

    try {
      const response = await axios.post(`https://${this.domain}/oauth/token`, {
        grant_type: 'password',
        username: email,
        password: password,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        audience: this.audience,
        scope: 'openid profile email'
      });

      return {
        access_token: response.data.access_token,
        id_token: response.data.id_token,
        expires_in: response.data.expires_in,
        token_type: response.data.token_type
      };
    } catch (error) {
      if (error.response) {
        const { error: authError, error_description } = error.response.data;

        if (authError === 'invalid_grant') {
          throw new Error('Invalid email or password');
        }
        if (authError === 'unauthorized_client') {
          throw new Error('Password grant not enabled. Enable it in Auth0 Dashboard.');
        }
        throw new Error(error_description || 'Authentication failed');
      }
      throw error;
    }
  }

  /**
   * Register a new user in Auth0
   * @param {string} email - User email
   * @param {string} password - User password
   * @param {object} metadata - Additional user metadata
   * @returns {Promise<{_id: string, email: string}>}
   */
  async register(email, password, metadata = {}) {
    if (!this.isConfigured()) {
      throw new Error('Auth0 is not configured');
    }

    try {
      // Get Management API token
      const mgmtToken = await this.getManagementToken();

      // Create user via Management API
      const response = await axios.post(
        `https://${this.domain}/api/v2/users`,
        {
          email: email,
          password: password,
          connection: this.connection,
          email_verified: false,
          user_metadata: metadata
        },
        {
          headers: {
            Authorization: `Bearer ${mgmtToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        auth0Id: response.data.user_id,
        email: response.data.email,
        emailVerified: response.data.email_verified
      };
    } catch (error) {
      if (error.response) {
        const { message, statusCode } = error.response.data;

        if (statusCode === 409 || message?.includes('already exists')) {
          throw new Error('Email already registered');
        }
        if (message?.includes('PasswordStrengthError')) {
          throw new Error('Password is too weak. Use at least 8 characters with numbers and special characters.');
        }
        throw new Error(message || 'Registration failed');
      }
      throw error;
    }
  }

  /**
   * Get Management API token for user operations
   * @returns {Promise<string>}
   */
  async getManagementToken() {
    try {
      const response = await axios.post(`https://${this.domain}/oauth/token`, {
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        audience: `https://${this.domain}/api/v2/`
      });

      return response.data.access_token;
    } catch (error) {
      throw new Error('Failed to get management token');
    }
  }

  /**
   * Verify Google ID token and extract user info
   * Uses Google's tokeninfo endpoint to validate the token
   * @param {string} googleToken - Google ID token from frontend (credential from Google Sign-In)
   * @returns {Promise<{email: string, name: string, picture: string, sub: string, email_verified: boolean}>}
   */
  async verifyGoogleToken(googleToken) {
    try {
      // Verify the Google ID token using Google's tokeninfo endpoint
      const response = await axios.get(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${googleToken}`
      );

      const { email, name, picture, sub, email_verified, aud } = response.data;

      // Verify the token was issued for our app
      const expectedClientId = process.env.GOOGLE_CLIENT_ID;
      if (expectedClientId && aud !== expectedClientId) {
        throw new Error('Token was not issued for this application');
      }

      return {
        email,
        name: name || email.split('@')[0],
        picture,
        sub: `google-oauth2|${sub}`,
        googleSub: sub, // Original Google sub without prefix
        email_verified: email_verified === 'true' || email_verified === true
      };
    } catch (error) {
      if (error.response) {
        throw new Error('Invalid Google token');
      }
      throw error;
    }
  }

  /**
   * Create or find a Google user in Auth0 via Management API
   * @param {object} googleUser - Verified Google user info from verifyGoogleToken
   * @returns {Promise<{auth0Id: string, email: string, isNew: boolean}>}
   */
  async createOrFindGoogleUser(googleUser) {
    if (!this.isConfigured()) {
      throw new Error('Auth0 is not configured');
    }

    const mgmtToken = await this.getManagementToken();
    const auth0UserId = `google-oauth2|${googleUser.googleSub}`;

    try {
      // First, try to find existing user by Auth0 ID (Google identity)
      const existingUser = await axios.get(
        `https://${this.domain}/api/v2/users/${encodeURIComponent(auth0UserId)}`,
        {
          headers: {
            Authorization: `Bearer ${mgmtToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('Found existing Auth0 Google user:', existingUser.data.email);
      return {
        auth0Id: existingUser.data.user_id,
        email: existingUser.data.email,
        name: existingUser.data.name,
        picture: existingUser.data.picture,
        isNew: false
      };
    } catch (error) {
      // User not found by Google ID, check by email
      if (error.response?.status === 404) {
        try {
          // Search for user by email
          const searchResponse = await axios.get(
            `https://${this.domain}/api/v2/users-by-email?email=${encodeURIComponent(googleUser.email)}`,
            {
              headers: {
                Authorization: `Bearer ${mgmtToken}`,
                'Content-Type': 'application/json'
              }
            }
          );

          if (searchResponse.data && searchResponse.data.length > 0) {
            // User exists with this email (possibly from password auth)
            // Link the Google identity to existing account
            const existingUser = searchResponse.data[0];
            console.log('Found existing Auth0 user by email, linking Google identity:', existingUser.email);

            try {
              await axios.post(
                `https://${this.domain}/api/v2/users/${encodeURIComponent(existingUser.user_id)}/identities`,
                {
                  provider: 'google-oauth2',
                  user_id: googleUser.googleSub
                },
                {
                  headers: {
                    Authorization: `Bearer ${mgmtToken}`,
                    'Content-Type': 'application/json'
                  }
                }
              );
              console.log('Successfully linked Google identity to existing user');
            } catch (linkError) {
              // Link might fail if identity already exists, that's okay
              console.log('Could not link identity (may already exist):', linkError.response?.data?.message || linkError.message);
            }

            return {
              auth0Id: existingUser.user_id,
              email: existingUser.email,
              name: existingUser.name || googleUser.name,
              picture: existingUser.picture || googleUser.picture,
              isNew: false
            };
          }
        } catch (searchError) {
          console.log('Email search failed:', searchError.message);
        }

        // No existing user found - create new user in the database connection
        // Note: We can't create users directly in google-oauth2 connection via Management API
        // So we create them in the Username-Password-Authentication connection without a password
        // This allows them to exist in Auth0 and potentially link identities later
        console.log('Creating new Auth0 user for Google login:', googleUser.email);

        try {
          const newUser = await axios.post(
            `https://${this.domain}/api/v2/users`,
            {
              email: googleUser.email,
              email_verified: googleUser.email_verified,
              name: googleUser.name,
              picture: googleUser.picture,
              connection: this.connection, // Use the database connection
              password: this.generateSecurePassword(), // Generate a random password they won't use
              user_metadata: {
                google_sub: googleUser.googleSub,
                login_method: 'google'
              }
            },
            {
              headers: {
                Authorization: `Bearer ${mgmtToken}`,
                'Content-Type': 'application/json'
              }
            }
          );

          console.log('Created new Auth0 user:', newUser.data.user_id);
          return {
            auth0Id: newUser.data.user_id,
            email: newUser.data.email,
            name: newUser.data.name,
            picture: newUser.data.picture,
            isNew: true
          };
        } catch (createError) {
          console.log('Could not create Auth0 user:', createError.response?.data?.message || createError.message);
          // Return a pseudo-record so login can continue locally
          return {
            auth0Id: auth0UserId,
            email: googleUser.email,
            name: googleUser.name,
            picture: googleUser.picture,
            isNew: true,
            localOnly: true
          };
        }
      }

      throw error;
    }
  }

  /**
   * Get user roles from Auth0 via Management API
   * @param {string} auth0UserId - Auth0 user ID (e.g., 'auth0|123' or 'google-oauth2|123')
   * @returns {Promise<string[]>} Array of role names
   */
  async getUserRoles(auth0UserId) {
    if (!this.isConfigured()) {
      return [];
    }

    try {
      const mgmtToken = await this.getManagementToken();
      const response = await axios.get(
        `https://${this.domain}/api/v2/users/${encodeURIComponent(auth0UserId)}/roles`,
        {
          headers: {
            Authorization: `Bearer ${mgmtToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Return array of role names
      return response.data.map(role => role.name);
    } catch (error) {
      console.log('Could not fetch user roles:', error.response?.data?.message || error.message);
      return [];
    }
  }

  /**
   * Get role string from Auth0 roles array
   * @param {string[]} roles - Array of role names from Auth0
   * @returns {string} 'admin' if user has ADMIN role, otherwise 'player'
   */
  getRoleFromAuth0Roles(roles) {
    const hasAdminRole = Array.isArray(roles) && roles.some(role =>
      typeof role === 'string' && role.toUpperCase() === 'ADMIN'
    );
    return hasAdminRole ? 'admin' : 'player';
  }

  /**
   * Get user info from access token
   * @param {string} accessToken - Auth0 access token
   * @returns {Promise<object>}
   */
  async getUserInfo(accessToken) {
    if (!this.isConfigured()) {
      throw new Error('Auth0 is not configured');
    }

    try {
      const response = await axios.get(`https://${this.domain}/userinfo`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      return response.data;
    } catch (error) {
      throw new Error('Failed to get user info');
    }
  }

  /**
   * Change user password
   * @param {string} email - User email
   * @returns {Promise<void>}
   */
  async sendPasswordReset(email) {
    if (!this.isConfigured()) {
      throw new Error('Auth0 is not configured');
    }

    try {
      await axios.post(`https://${this.domain}/dbconnections/change_password`, {
        client_id: this.clientId,
        email: email,
        connection: this.connection
      });
    } catch (error) {
      // Auth0 returns 200 even if email doesn't exist (security)
      // So we don't throw errors here
      console.error('Password reset error:', error.message);
    }
  }

  /**
   * Verify an access token
   * @param {string} token - Access token to verify
   * @returns {Promise<object>} Decoded token payload
   */
  async verifyToken(token) {
    const jwksClient = require('jwks-rsa');
    const jwt = require('jsonwebtoken');

    const client = jwksClient({
      jwksUri: `https://${this.domain}/.well-known/jwks.json`,
      cache: true,
      rateLimit: true
    });

    return new Promise((resolve, reject) => {
      jwt.verify(
        token,
        (header, callback) => {
          client.getSigningKey(header.kid, (err, key) => {
            if (err) return callback(err);
            callback(null, key.publicKey || key.rsaPublicKey);
          });
        },
        {
          audience: this.audience,
          issuer: `https://${this.domain}/`,
          algorithms: ['RS256']
        },
        (err, decoded) => {
          if (err) return reject(err);
          resolve(decoded);
        }
      );
    });
  }

  /**
   * Extract role from a decoded Auth0 token
   * Auth0 roles are added via Actions/Rules with a custom namespace
   * @param {object} decoded - Decoded JWT payload
   * @returns {string} 'admin' if user has ADMIN role, otherwise 'player'
   */
  extractRoleFromToken(decoded) {
    const rolesNamespace = process.env.AUTH0_ROLES_NAMESPACE || 'https://bt4500.com/roles';

    // Log token claims for debugging
    console.log('Auth0 Token Claims:', JSON.stringify(decoded, null, 2));
    console.log('Looking for roles in namespace:', rolesNamespace);

    // Try to get roles from custom namespace claim
    const roles = decoded[rolesNamespace] ||
                  decoded['roles'] ||
                  decoded['https://bt4500.com/roles'] ||
                  [];

    console.log('Found roles:', roles);

    // Check if user has ADMIN role (case-insensitive)
    const hasAdminRole = Array.isArray(roles) && roles.some(role =>
      typeof role === 'string' && role.toUpperCase() === 'ADMIN'
    );

    const finalRole = hasAdminRole ? 'admin' : 'player';
    console.log('Extracted role:', finalRole);

    return finalRole;
  }

  /**
   * Decode a token without verification (to extract claims)
   * @param {string} token - JWT token
   * @returns {object|null} Decoded payload or null
   */
  decodeToken(token) {
    const jwt = require('jsonwebtoken');
    try {
      return jwt.decode(token);
    } catch (e) {
      return null;
    }
  }
}

module.exports = new Auth0Service();
