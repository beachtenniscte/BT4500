const express = require('express');
const router = express.Router();
const Match = require('../models/Match');
const Tournament = require('../models/Tournament');
const { authenticate, organizerOrAdmin } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

/**
 * GET /api/matches
 * Get matches with filters
 */
router.get('/', async (req, res) => {
  try {
    const { tournamentId, categoryId, round, status, date, limit, offset } = req.query;

    // If tournamentId is a UUID, resolve it
    let resolvedTournamentId = tournamentId;
    if (tournamentId && tournamentId.includes('-')) {
      const tournament = await Tournament.findByUuid(tournamentId);
      resolvedTournamentId = tournament?.id;
    }

    const matches = await Match.findAll({
      tournamentId: resolvedTournamentId ? parseInt(resolvedTournamentId) : null,
      categoryId: categoryId ? parseInt(categoryId) : null,
      round,
      status,
      date,
      limit: limit ? parseInt(limit) : 100,
      offset: offset ? parseInt(offset) : 0
    });

    res.json({
      data: matches,
      count: matches.length
    });
  } catch (error) {
    console.error('Get matches error:', error);
    res.status(500).json({ error: 'Failed to get matches' });
  }
});

/**
 * GET /api/matches/:uuid
 * Get match by UUID
 */
router.get('/:uuid', async (req, res) => {
  try {
    const match = await Match.findByUuid(req.params.uuid);

    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    res.json(match);
  } catch (error) {
    console.error('Get match error:', error);
    res.status(500).json({ error: 'Failed to get match' });
  }
});

/**
 * PUT /api/matches/:uuid/result
 * Update match result
 */
router.put('/:uuid/result', authenticate, organizerOrAdmin, [
  body('result').optional().trim(),
  body('winnerTeamId').optional().isInt(),
  body('status').optional().isIn(['scheduled', 'in_progress', 'completed', 'walkover', 'cancelled'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const match = await Match.findByUuid(req.params.uuid);

    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    const updated = await Match.updateResult(match.id, req.body);

    res.json({
      message: 'Match result updated',
      match: updated
    });
  } catch (error) {
    console.error('Update match result error:', error);
    res.status(500).json({ error: 'Failed to update match result' });
  }
});

/**
 * GET /api/matches/live
 * Get today's matches (for live scores)
 */
router.get('/status/live', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const matches = await Match.findAll({
      date: today,
      limit: 50
    });

    res.json({
      data: matches,
      count: matches.length,
      date: today
    });
  } catch (error) {
    console.error('Get live matches error:', error);
    res.status(500).json({ error: 'Failed to get live matches' });
  }
});

module.exports = router;
