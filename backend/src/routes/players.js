const express = require('express');
const router = express.Router();
const Player = require('../models/Player');
const { authenticate, adminOnly } = require('../middleware/auth');
const { body, query, validationResult } = require('express-validator');

/**
 * GET /api/players
 * Get all players with optional filters
 */
router.get('/', async (req, res) => {
  try {
    const { gender, level, search, orderBy, order, limit, offset } = req.query;

    const players = await Player.findAll({
      gender,
      level: level ? parseInt(level) : null,
      search,
      orderBy,
      order,
      limit: limit ? parseInt(limit) : 100,
      offset: offset ? parseInt(offset) : 0
    });

    res.json({
      data: players,
      count: players.length
    });
  } catch (error) {
    console.error('Get players error:', error);
    res.status(500).json({ error: 'Failed to get players' });
  }
});

/**
 * GET /api/players/rankings
 * Get player rankings
 */
router.get('/rankings', async (req, res) => {
  try {
    const { gender, level, limit = 50 } = req.query;

    const players = await Player.findAll({
      gender,
      level: level ? parseInt(level) : null,
      orderBy: 'total_points',
      order: 'DESC',
      limit: parseInt(limit)
    });

    // Add ranking position
    const ranked = players.map((p, index) => ({
      ...p,
      rankPosition: index + 1
    }));

    res.json({
      data: ranked,
      count: ranked.length
    });
  } catch (error) {
    console.error('Get rankings error:', error);
    res.status(500).json({ error: 'Failed to get rankings' });
  }
});

/**
 * GET /api/players/:uuid
 * Get player by UUID with full profile data
 */
router.get('/:uuid', async (req, res) => {
  try {
    const player = await Player.findByUuid(req.params.uuid);

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Get stats and history
    const stats = await Player.getStats(player.id);
    const history = await Player.getTournamentHistory(player.id, 20);

    // Format tournaments for frontend display
    const tournaments = history.map(h => ({
      id: h.tournament_id,
      name: h.tournament_name,
      tier: h.tournament_tier,
      date: h.start_date,
      year: h.start_date ? new Date(h.start_date).getFullYear() : null,
      position: h.final_position,
      points: h.points_earned,
      category: h.category_code,
      partner: h.partner_name
    }));

    // Return data formatted for frontend Profile component
    res.json({
      // Basic player info
      full_name: player.full_name,
      first_name: player.first_name,
      last_name: player.last_name,
      age: player.birth_date ? Math.floor((Date.now() - new Date(player.birth_date)) / (365.25 * 24 * 60 * 60 * 1000)) : null,
      city: player.city,
      country: player.country,
      photo: player.photo_url,
      ranking: player.ranking,
      total_points: player.total_points,
      gender: player.gender,
      level: player.level,

      // Stats
      tournamentsPlayed: stats?.tournaments_played || 0,
      wins: stats?.titles || 0,
      podiums: stats?.podiums || 0,
      matchesWon: stats?.total_wins || 0,
      matchesLost: stats?.total_losses || 0,

      // Tournament history
      tournaments,

      // Raw data for advanced use
      player,
      stats,
      tournamentHistory: history
    });
  } catch (error) {
    console.error('Get player error:', error);
    res.status(500).json({ error: 'Failed to get player' });
  }
});

/**
 * POST /api/players
 * Create a new player (admin only)
 */
router.post('/', authenticate, adminOnly, [
  body('firstName').trim().notEmpty(),
  body('lastName').trim().notEmpty(),
  body('gender').isIn(['M', 'F'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const player = await Player.create(req.body);

    res.status(201).json({
      message: 'Player created',
      player
    });
  } catch (error) {
    console.error('Create player error:', error);
    res.status(500).json({ error: 'Failed to create player' });
  }
});

/**
 * PUT /api/players/:uuid
 * Update player
 */
router.put('/:uuid', authenticate, async (req, res) => {
  try {
    const player = await Player.findByUuid(req.params.uuid);

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Check permission - admin or own profile
    if (req.user.role !== 'admin' && player.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to update this player' });
    }

    const updated = await Player.update(player.id, req.body);

    res.json({
      message: 'Player updated',
      player: updated
    });
  } catch (error) {
    console.error('Update player error:', error);
    res.status(500).json({ error: 'Failed to update player' });
  }
});

/**
 * GET /api/players/:uuid/stats
 * Get player statistics
 */
router.get('/:uuid/stats', async (req, res) => {
  try {
    const player = await Player.findByUuid(req.params.uuid);

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const stats = await Player.getStats(player.id);

    res.json(stats);
  } catch (error) {
    console.error('Get player stats error:', error);
    res.status(500).json({ error: 'Failed to get player stats' });
  }
});

/**
 * GET /api/players/:uuid/tournaments
 * Get player tournament history
 */
router.get('/:uuid/tournaments', async (req, res) => {
  try {
    const player = await Player.findByUuid(req.params.uuid);

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const { limit = 20 } = req.query;
    const history = await Player.getTournamentHistory(player.id, parseInt(limit));

    res.json({
      data: history,
      count: history.length
    });
  } catch (error) {
    console.error('Get player tournaments error:', error);
    res.status(500).json({ error: 'Failed to get player tournaments' });
  }
});

/**
 * POST /api/players/recalculate-rankings
 * Recalculate all rankings (admin only)
 */
router.post('/recalculate-rankings', authenticate, adminOnly, async (req, res) => {
  try {
    const count = await Player.recalculateRankings();

    res.json({
      message: 'Rankings recalculated',
      playersUpdated: count
    });
  } catch (error) {
    console.error('Recalculate rankings error:', error);
    res.status(500).json({ error: 'Failed to recalculate rankings' });
  }
});

module.exports = router;
