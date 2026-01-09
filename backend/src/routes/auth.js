const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Player = require('../models/Player');
const { generateToken, authenticate } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

/**
 * POST /api/auth/register
 * Register a new user
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

    // Create user
    const user = await User.create({ email, password, role: 'player' });

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

    const token = generateToken(user);

    res.status(201).json({
      message: 'Registration successful',
      user: { id: user.uuid, email: user.email, role: user.role },
      player: player ? { id: player.uuid, name: player.full_name } : null,
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * POST /api/auth/login
 * Login user
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
      token
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

module.exports = router;
