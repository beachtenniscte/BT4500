const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate, adminOnly } = require('../middleware/auth');
const CSVImportService = require('../services/CSVImportService');
const Player = require('../models/Player');
const Tournament = require('../models/Tournament');
const User = require('../models/User');

// Configure multer for CSV upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'tournament-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || path.extname(file.originalname).toLowerCase() === '.csv') {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

/**
 * POST /api/admin/import-csv
 * Import tournament data from a single CSV file
 */
router.post('/import-csv', authenticate, adminOnly, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No CSV file uploaded' });
    }

    const filePath = req.file.path;
    const options = {
      calculatePoints: req.body.calculatePoints !== 'false'
    };

    console.log(`Importing CSV from: ${filePath}`);

    const result = await CSVImportService.importFromCSV(filePath, options);

    // Clean up uploaded file
    fs.unlink(filePath, (err) => {
      if (err) console.error('Failed to delete temp file:', err);
    });

    res.json({
      message: 'Import successful',
      data: {
        tournament: result.tournament ? {
          id: result.tournament.id,
          name: result.tournament.name,
          code: result.tournament.code,
          tier: result.tournament.tier
        } : null,
        categoriesCount: result.categories.length,
        playersCount: result.players.length,
        teamsCount: result.teams.length,
        matchesCount: result.matches.length,
        errorsCount: result.errors.length,
        errors: result.errors.slice(0, 10), // Only return first 10 errors
        pointsAwarded: result.pointsAwarded ? {
          teamsProcessed: result.pointsAwarded.teamsProcessed
        } : null
      }
    });
  } catch (error) {
    console.error('CSV import error:', error);

    // Clean up uploaded file on error
    if (req.file?.path) {
      fs.unlink(req.file.path, () => {});
    }

    res.status(500).json({ error: `Import failed: ${error.message}` });
  }
});

/**
 * POST /api/admin/import-csv-multiple
 * Import tournament data from multiple CSV files (processed sequentially)
 */
router.post('/import-csv-multiple', authenticate, adminOnly, upload.array('files', 10), async (req, res) => {
  const results = [];
  const filePaths = [];

  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No CSV files uploaded' });
    }

    console.log(`Importing ${req.files.length} CSV files...`);

    const options = {
      calculatePoints: req.body.calculatePoints !== 'false'
    };

    // Process files sequentially to maintain data consistency
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      filePaths.push(file.path);

      console.log(`Processing file ${i + 1}/${req.files.length}: ${file.originalname}`);

      try {
        const result = await CSVImportService.importFromCSV(file.path, options);

        results.push({
          filename: file.originalname,
          success: true,
          data: {
            tournament: result.tournament ? {
              id: result.tournament.id,
              name: result.tournament.name,
              code: result.tournament.code,
              tier: result.tournament.tier
            } : null,
            categoriesCount: result.categories.length,
            playersCount: result.players.length,
            teamsCount: result.teams.length,
            matchesCount: result.matches.length,
            errorsCount: result.errors.length,
            errors: result.errors.slice(0, 5), // Only return first 5 errors per file
            pointsAwarded: result.pointsAwarded ? {
              teamsProcessed: result.pointsAwarded.teamsProcessed
            } : null
          }
        });
      } catch (fileError) {
        console.error(`Error processing ${file.originalname}:`, fileError.message);
        results.push({
          filename: file.originalname,
          success: false,
          error: fileError.message
        });
      }
    }

    // Clean up all uploaded files
    for (const filePath of filePaths) {
      fs.unlink(filePath, (err) => {
        if (err) console.error('Failed to delete temp file:', err);
      });
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    res.json({
      message: `Import completed: ${successCount} successful, ${failCount} failed`,
      totalFiles: req.files.length,
      successCount,
      failCount,
      results
    });
  } catch (error) {
    console.error('Multiple CSV import error:', error);

    // Clean up uploaded files on error
    for (const filePath of filePaths) {
      fs.unlink(filePath, () => {});
    }

    res.status(500).json({ error: `Import failed: ${error.message}` });
  }
});

/**
 * GET /api/admin/stats
 * Get admin dashboard stats
 */
router.get('/stats', authenticate, adminOnly, async (req, res) => {
  try {
    const { pool } = require('../config/database');

    const [[playersCount]] = await pool.query('SELECT COUNT(*) as count FROM players WHERE active = 1');
    const [[tournamentsCount]] = await pool.query('SELECT COUNT(*) as count FROM tournaments');
    const [[matchesCount]] = await pool.query('SELECT COUNT(*) as count FROM matches');
    const [[usersCount]] = await pool.query('SELECT COUNT(*) as count FROM users');

    res.json({
      players: playersCount.count,
      tournaments: tournamentsCount.count,
      matches: matchesCount.count,
      users: usersCount.count
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

/**
 * GET /api/admin/users
 * Get all users (admin only)
 */
router.get('/users', authenticate, adminOnly, async (req, res) => {
  try {
    const { limit = 50, offset = 0, role } = req.query;
    const users = await User.findAll({ limit: parseInt(limit), offset: parseInt(offset), role });

    res.json({ data: users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

/**
 * PUT /api/admin/users/:id/role
 * Update user role
 */
router.put('/users/:id/role', authenticate, adminOnly, async (req, res) => {
  try {
    const { role } = req.body;
    const validRoles = ['player', 'admin', 'organizer'];

    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const user = await User.findByUuid(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await User.update(user.id, { role });

    res.json({ message: 'User role updated', user: { id: user.uuid, role } });
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

/**
 * POST /api/admin/recalculate-rankings
 * Recalculate all player rankings
 */
router.post('/recalculate-rankings', authenticate, adminOnly, async (req, res) => {
  try {
    const count = await Player.recalculateRankings();
    res.json({ message: 'Rankings recalculated', playersUpdated: count });
  } catch (error) {
    console.error('Recalculate rankings error:', error);
    res.status(500).json({ error: 'Failed to recalculate rankings' });
  }
});

/**
 * GET /api/admin/tournaments
 * Get all tournaments with management info
 */
router.get('/tournaments', authenticate, adminOnly, async (req, res) => {
  try {
    const tournaments = await Tournament.findAll({ limit: 100 });
    res.json({ data: tournaments });
  } catch (error) {
    console.error('Get tournaments error:', error);
    res.status(500).json({ error: 'Failed to get tournaments' });
  }
});

/**
 * DELETE /api/admin/tournaments/:id
 * Delete a tournament
 */
router.delete('/tournaments/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const tournament = await Tournament.findByUuid(req.params.id);
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
