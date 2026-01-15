const express = require('express');
const router = express.Router();
const Tournament = require('../models/Tournament');
const { pool } = require('../config/database');
const PointsService = require('../services/PointsService');
const CSVImportService = require('../services/CSVImportService');
const { authenticate, adminOnly, organizerOrAdmin } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for CSV uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  }
});

/**
 * GET /api/tournaments
 * Get all tournaments
 */
router.get('/', async (req, res) => {
  try {
    const { year, tier, status, orderBy, order, limit, offset } = req.query;

    const tournaments = await Tournament.findAll({
      year: year ? parseInt(year) : null,
      tier,
      status,
      orderBy,
      order,
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0
    });

    res.json({
      data: tournaments,
      count: tournaments.length
    });
  } catch (error) {
    console.error('Get tournaments error:', error);
    res.status(500).json({ error: 'Failed to get tournaments' });
  }
});

/**
 * GET /api/tournaments/:uuid
 * Get tournament by UUID
 */
router.get('/:uuid', async (req, res) => {
  try {
    const tournament = await Tournament.findByUuid(req.params.uuid);

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    const categories = await Tournament.getCategories(tournament.id);

    res.json({
      tournament,
      categories
    });
  } catch (error) {
    console.error('Get tournament error:', error);
    res.status(500).json({ error: 'Failed to get tournament' });
  }
});

/**
 * POST /api/tournaments
 * Create a new tournament
 */
router.post('/', authenticate, organizerOrAdmin, [
  body('name').trim().notEmpty(),
  body('code').trim().notEmpty(),
  body('tier').isIn(['OURO', 'PRATA', 'BRONZE']),
  body('location').trim().notEmpty(),
  body('startDate').isDate(),
  body('endDate').isDate()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const tournament = await Tournament.create({
      ...req.body,
      year: new Date(req.body.startDate).getFullYear()
    });

    res.status(201).json({
      message: 'Tournament created',
      tournament
    });
  } catch (error) {
    console.error('Create tournament error:', error);
    res.status(500).json({ error: 'Failed to create tournament' });
  }
});

/**
 * PUT /api/tournaments/:uuid
 * Update tournament
 */
router.put('/:uuid', authenticate, organizerOrAdmin, async (req, res) => {
  try {
    const tournament = await Tournament.findByUuid(req.params.uuid);

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    const updated = await Tournament.update(tournament.id, req.body);

    res.json({
      message: 'Tournament updated',
      tournament: updated
    });
  } catch (error) {
    console.error('Update tournament error:', error);
    res.status(500).json({ error: 'Failed to update tournament' });
  }
});

/**
 * GET /api/tournaments/:uuid/matches
 * Get tournament matches
 */
router.get('/:uuid/matches', async (req, res) => {
  try {
    const tournament = await Tournament.findByUuid(req.params.uuid);

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    const { category } = req.query;
    const matches = await Tournament.getMatches(tournament.id, category);

    res.json({
      data: matches,
      count: matches.length
    });
  } catch (error) {
    console.error('Get tournament matches error:', error);
    res.status(500).json({ error: 'Failed to get tournament matches' });
  }
});

/**
 * GET /api/tournaments/:uuid/standings
 * Get tournament standings
 */
router.get('/:uuid/standings', async (req, res) => {
  try {
    const tournament = await Tournament.findByUuid(req.params.uuid);

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    const { category } = req.query;
    const standings = await Tournament.getStandings(tournament.id, category);

    res.json({
      data: standings,
      count: standings.length
    });
  } catch (error) {
    console.error('Get tournament standings error:', error);
    res.status(500).json({ error: 'Failed to get tournament standings' });
  }
});

/**
 * GET /api/tournaments/:uuid/winners
 * Get tournament winners (1st place per category)
 */
router.get('/:uuid/winners', async (req, res) => {
  try {
    const tournament = await Tournament.findByUuid(req.params.uuid);

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    const winners = await Tournament.getWinners(tournament.id);

    res.json({
      data: winners,
      count: winners.length
    });
  } catch (error) {
    console.error('Get tournament winners error:', error);
    res.status(500).json({ error: 'Failed to get tournament winners' });
  }
});

/**
 * GET /api/tournaments/:uuid/matches-by-round
 * Get tournament matches grouped by round
 */
router.get('/:uuid/matches-by-round', async (req, res) => {
  try {
    const tournament = await Tournament.findByUuid(req.params.uuid);

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    const { category } = req.query;
    const matchesByRound = await Tournament.getMatchesByRound(tournament.id, category);

    res.json({
      data: matchesByRound
    });
  } catch (error) {
    console.error('Get tournament matches by round error:', error);
    res.status(500).json({ error: 'Failed to get tournament matches' });
  }
});

/**
 * POST /api/tournaments/:uuid/calculate-points
 * Calculate and award points for completed tournament
 */
router.post('/:uuid/calculate-points', authenticate, organizerOrAdmin, async (req, res) => {
  try {
    const tournament = await Tournament.findByUuid(req.params.uuid);

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    const result = await PointsService.awardTournamentPoints(tournament.id);

    res.json({
      message: 'Points calculated and awarded',
      ...result
    });
  } catch (error) {
    console.error('Calculate points error:', error);
    res.status(500).json({ error: 'Failed to calculate points' });
  }
});

/**
 * POST /api/tournaments/import
 * Import tournament from CSV
 */
router.post('/import', authenticate, adminOnly, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'CSV file is required' });
    }

    const result = await CSVImportService.importFromCSV(req.file.path, {
      calculatePoints: req.body.calculatePoints !== 'false'
    });

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.json({
      message: 'Tournament imported successfully',
      tournament: result.tournament,
      stats: {
        categories: result.categories.length,
        players: result.players.length,
        teams: result.teams.length,
        matches: result.matches.length,
        errors: result.errors.length
      },
      pointsAwarded: result.pointsAwarded,
      errors: result.errors.slice(0, 10) // Return first 10 errors
    });
  } catch (error) {
    console.error('Import tournament error:', error);

    // Clean up uploaded file on error
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {}
    }

    res.status(500).json({ error: `Failed to import tournament: ${error.message}` });
  }
});

/**
 * DELETE /api/tournaments/:uuid
 * Delete tournament (admin only)
 */
router.delete('/:uuid', authenticate, adminOnly, async (req, res) => {
  try {
    const tournament = await Tournament.findByUuid(req.params.uuid);

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    await Tournament.delete(tournament.id);

    res.json({ message: 'Tournament deleted' });
  } catch (error) {
    console.error('Delete tournament error:', error);
    res.status(500).json({ error: 'Failed to delete tournament' });
  }
});

module.exports = router;
