const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Player = require('../models/Player');
const { generateToken, authenticate, isAuth0Enabled } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const Auth0Service = require('../services/Auth0Service');

/**
 * POST /api/auth/register
 * Register a new user - supports both local and Auth0 registration
 */
router.post('/register', [
  body('email').trim().notEmpty().withMessage('Username is required'),
  body('password').isLength({ min: 6 }),
  body('firstName').optional().trim().notEmpty(),
  body('lastName').optional().trim().notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, firstName, lastName, gender, city } = req.body;

    // Check if user exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    let auth0Id = null;
    let token;

    // If Auth0 is configured, register user in Auth0 first
    if (Auth0Service.isConfigured()) {
      try {
        const auth0Result = await Auth0Service.register(email, password, {
          firstName,
          lastName
        });
        auth0Id = auth0Result.auth0Id;

        // Login to get access token
        const loginResult = await Auth0Service.login(email, password);
        token = loginResult.access_token;
      } catch (auth0Error) {
        console.error('Auth0 registration failed:', auth0Error.message);
        return res.status(400).json({ error: auth0Error.message || 'Registration failed' });
      }
    }

    // Create user in local database
    const user = await User.create({
      email,
      password: Auth0Service.isConfigured() ? null : password, // No local password if using Auth0
      role: 'player',
      auth0Id
    });

    // If player info provided, create player profile
    let player = null;
    if (firstName && lastName) {
      player = await Player.create({
        userId: user.id,
        firstName,
        lastName,
        gender: gender || 'M',
        city
      });
    }

    // Generate local token if not using Auth0
    if (!token) {
      token = generateToken(user);
    }

    res.status(201).json({
      message: 'Registration successful',
      user: { id: user.uuid, email: user.email, role: user.role },
      player: player ? { id: player.uuid, name: player.full_name } : null,
      token,
      tokenType: Auth0Service.isConfigured() ? 'auth0' : 'local'
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * POST /api/auth/login
 * Login user - supports both local and Auth0 authentication
 */
router.post('/login', [
  body('email').trim().notEmpty().withMessage('Username is required'),
  body('password').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // If Auth0 is configured, use Auth0 for authentication
    if (Auth0Service.isConfigured()) {
      try {
        const auth0Result = await Auth0Service.login(email, password);

        // Decode token to extract role from Auth0
        const decoded = Auth0Service.decodeToken(auth0Result.access_token);
        const auth0Role = decoded ? Auth0Service.extractRoleFromToken(decoded) : 'player';

        // Find or create user in local database
        let user = await User.findByEmail(email);

        if (!user) {
          // Create user from Auth0 with role from token
          user = await User.create({
            email: email,
            password: null, // No local password for Auth0 users
            role: auth0Role,
            auth0Id: decoded?.sub
          });
        } else {
          // Sync role from Auth0 if it changed
          if (user.role !== auth0Role) {
            await User.update(user.id, { role: auth0Role });
            user.role = auth0Role;
          }
        }

        const player = await User.getLinkedPlayer(user.id);

        res.json({
          message: 'Login successful',
          user: { id: user.uuid, email: user.email, role: user.role },
          player: player ? { id: player.uuid, name: player.full_name, ranking: player.ranking } : null,
          token: auth0Result.access_token,
          tokenType: 'auth0'
        });
        return;
      } catch (auth0Error) {
        console.error('Auth0 login failed:', auth0Error.message);
        return res.status(401).json({ error: auth0Error.message || 'Invalid credentials' });
      }
    }

    // Fallback to local authentication
    const user = await User.findByEmailWithPassword(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = await User.verifyPassword(user, password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user);
    const player = await User.getLinkedPlayer(user.id);

    res.json({
      message: 'Login successful',
      user: { id: user.uuid, email: user.email, role: user.role },
      player: player ? { id: player.uuid, name: player.full_name, ranking: player.ranking } : null,
      token,
      tokenType: 'local'
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    const player = await User.getLinkedPlayer(req.user.id);

    res.json({
      user: { id: req.user.uuid, email: req.user.email, role: req.user.role },
      player: player ? {
        id: player.uuid,
        name: player.full_name,
        ranking: player.ranking,
        totalPoints: player.total_points,
        city: player.city
      } : null
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

/**
 * POST /api/auth/change-password
 * Change password
 */
router.post('/change-password', authenticate, [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 6 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;

    const user = await User.findByEmailWithPassword(req.user.email);
    const isValid = await User.verifyPassword(user, currentPassword);

    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    await User.update(user.id, { password: newPassword });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

/**
 * GET /api/auth/config
 * Get authentication configuration (for frontend to know which auth method to use)
 */
router.get('/config', (req, res) => {
  res.json({
    auth0Enabled: Auth0Service.isConfigured(),
    auth0Domain: Auth0Service.isConfigured() ? process.env.AUTH0_DOMAIN : null
  });
});

/**
 * POST /api/auth/google
 * Login/Register with Google OAuth token
 */
router.post('/google', [
  body('token').notEmpty().withMessage('Google token is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { token } = req.body;

    // Verify Google token with Auth0
    if (!Auth0Service.isConfigured()) {
      return res.status(400).json({ error: 'Social login not configured' });
    }

    try {
      // Exchange Google token for Auth0 token
      const auth0Result = await Auth0Service.loginWithGoogle(token);

      // Decode token to extract user info and role
      const decoded = Auth0Service.decodeToken(auth0Result.access_token);
      const auth0Role = decoded ? Auth0Service.extractRoleFromToken(decoded) : 'player';
      const email = decoded?.email || decoded?.sub;

      if (!email) {
        return res.status(400).json({ error: 'Could not get email from Google account' });
      }

      // Find or create user in local database
      let user = await User.findByEmail(email);

      if (!user) {
        // Create user from Google login
        user = await User.create({
          email: email,
          password: null, // No local password for social login users
          role: auth0Role,
          auth0Id: decoded?.sub
        });
      } else {
        // Sync role from Auth0 if it changed
        if (user.role !== auth0Role || !user.auth0_id) {
          await User.update(user.id, {
            role: auth0Role,
            auth0Id: decoded?.sub
          });
          user.role = auth0Role;
        }
      }

      const player = await User.getLinkedPlayer(user.id);

      res.json({
        message: 'Login successful',
        user: { id: user.uuid, email: user.email, role: user.role },
        player: player ? { id: player.uuid, name: player.full_name, ranking: player.ranking } : null,
        token: auth0Result.access_token,
        tokenType: 'auth0'
      });
    } catch (googleError) {
      console.error('Google login failed:', googleError.message);
      return res.status(401).json({ error: googleError.message || 'Google login failed' });
    }
  } catch (error) {
    console.error('Google login error:', error);
    res.status(500).json({ error: 'Google login failed' });
  }
});

/**
 * POST /api/auth/forgot-password
 * Send password reset email
 */
router.post('/forgot-password', [
  body('email').trim().isEmail().withMessage('Valid email is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email } = req.body;

    if (Auth0Service.isConfigured()) {
      await Auth0Service.sendPasswordReset(email);
    }

    // Always return success to prevent email enumeration
    res.json({ message: 'If the email exists, a password reset link has been sent.' });
  } catch (error) {
    console.error('Password reset error:', error);
    // Still return success to prevent email enumeration
    res.json({ message: 'If the email exists, a password reset link has been sent.' });
  }
});

module.exports = router;
