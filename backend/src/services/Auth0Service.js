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
}

module.exports = new Auth0Service();
