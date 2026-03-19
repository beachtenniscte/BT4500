const express = require('express');
const router = express.Router();

const authRoutes = require('./auth');
const playersRoutes = require('./players');
const tournamentsRoutes = require('./tournaments');
const matchesRoutes = require('./matches');
const pointsRoutes = require('./points');
const adminRoutes = require('./admin');
const signupsRoutes = require('./signups');
const webhooksRoutes = require('./webhooks');

// API Routes
router.use('/auth', authRoutes);
router.use('/players', playersRoutes);
router.use('/tournaments', tournamentsRoutes);
router.use('/matches', matchesRoutes);
router.use('/points', pointsRoutes);
router.use('/admin', adminRoutes);
router.use('/signups', signupsRoutes);
router.use('/webhooks', webhooksRoutes);

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

module.exports = router;
