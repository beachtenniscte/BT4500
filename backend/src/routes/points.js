const express = require('express');
const router = express.Router();
const PointsService = require('../services/PointsService');
const { pool } = require('../config/database');
const { authenticate, adminOnly } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

/**
 * GET /api/points
 * Get points table
 */
router.get('/', async (req, res) => {
  try {
    const { tier } = req.query;
    const points = await PointsService.getPointsTable(tier);

    res.json({
      data: points,
      count: points.length
    });
  } catch (error) {
    console.error('Get points table error:', error);
    res.status(500).json({ error: 'Failed to get points table' });
  }
});

/**
 * GET /api/points/:tier
 * Get points for specific tier
 */
router.get('/:tier', async (req, res) => {
  try {
    const tier = req.params.tier.toUpperCase();

    if (!['OURO', 'PRATA', 'BRONZE'].includes(tier)) {
      return res.status(400).json({ error: 'Invalid tier. Must be OURO, PRATA, or BRONZE' });
    }

    const points = await PointsService.getPointsTable(tier);

    res.json({
      tier,
      data: points
    });
  } catch (error) {
    console.error('Get tier points error:', error);
    res.status(500).json({ error: 'Failed to get tier points' });
  }
});

/**
 * PUT /api/points/:tier/:round
 * Update points for a tier/round combination (admin only)
 */
router.put('/:tier/:round', authenticate, adminOnly, [
  body('points').isInt({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const tier = req.params.tier.toUpperCase();
    const round = req.params.round;
    const { points } = req.body;

    if (!['OURO', 'PRATA', 'BRONZE'].includes(tier)) {
      return res.status(400).json({ error: 'Invalid tier' });
    }

    await pool.query(
      `UPDATE points_table SET points = ? WHERE tier = ? AND round_name = ?`,
      [points, tier, round]
    );

    res.json({
      message: 'Points updated',
      tier,
      round,
      points
    });
  } catch (error) {
    console.error('Update points error:', error);
    res.status(500).json({ error: 'Failed to update points' });
  }
});

/**
 * GET /api/points/round/:round
 * Get points for all tiers for a specific round
 */
router.get('/round/:round', async (req, res) => {
  try {
    const round = req.params.round;

    const [points] = await pool.query(
      `SELECT * FROM points_table WHERE round_name = ? ORDER BY tier`,
      [round]
    );

    res.json({
      round,
      data: points
    });
  } catch (error) {
    console.error('Get round points error:', error);
    res.status(500).json({ error: 'Failed to get round points' });
  }
});

module.exports = router;
