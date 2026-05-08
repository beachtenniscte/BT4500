const express = require('express');
const router = express.Router();
const Signup = require('../models/Signup');
const Tournament = require('../models/Tournament');
const { authenticate, adminOnly } = require('../middleware/auth');
const { pool } = require('../config/database');

/**
 * GET /api/signups/tournament/:uuid
 * Get signup configuration and counts for a tournament (public)
 */
router.get('/tournament/:uuid', async (req, res) => {
  try {
    const tournament = await Tournament.findByUuid(req.params.uuid);
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    // Get categories with registration config
    const [categories] = await pool.query(`
      SELECT tc.id as tournament_category_id,
             c.code,
             c.name,
             c.gender,
             tc.registration_type,
             tc.registration_url,
             tc.registration_open
      FROM tournament_categories tc
      JOIN categories c ON tc.category_id = c.id
      WHERE tc.tournament_id = ?
      ORDER BY c.gender, c.level
    `, [tournament.id]);

    // Get signup counts per category
    const counts = await Signup.getCountsByCategory(tournament.id);
    const countMap = {};
    for (const c of counts) {
      countMap[c.category_code] = c;
    }

    // Merge counts into categories
    const categoriesWithCounts = categories.map(cat => ({
      ...cat,
      signupCount: countMap[cat.code] || { total: 0, pairs: 0, individuals: 0, confirmed: 0, pending: 0 }
    }));

    res.json({
      tournament: {
        id: tournament.id,
        uuid: tournament.uuid,
        name: tournament.name,
        tier: tournament.tier,
        location: tournament.location,
        startDate: tournament.start_date,
        endDate: tournament.end_date
      },
      categories: categoriesWithCounts
    });
  } catch (error) {
    console.error('Get tournament signups error:', error);
    res.status(500).json({ error: 'Failed to get tournament signup info' });
  }
});

/**
 * POST /api/signups
 * Create a new signup (public - no auth required)
 */
router.post('/', async (req, res) => {
  try {
    const {
      tournamentUuid,
      categoryCode,
      signupType,
      player1Name,
      player1Whatsapp,
      player1Email,
      player2Name,
      player2Whatsapp,
      player2Email,
      skillPot,
      notes
    } = req.body;

    // Validate required fields
    if (!tournamentUuid || !categoryCode || !signupType || !player1Name) {
      return res.status(400).json({
        error: 'Campos obrigatórios em falta: torneio, categoria, tipo e nome do jogador 1'
      });
    }

    // For pair signups, player2 is required
    if (signupType === 'pair' && !player2Name) {
      return res.status(400).json({
        error: 'Nome do parceiro é obrigatório para inscrição em par'
      });
    }

    // Get tournament
    const tournament = await Tournament.findByUuid(tournamentUuid);
    if (!tournament) {
      return res.status(404).json({ error: 'Torneio não encontrado' });
    }

    // Tournament-level gate: registrations are only accepted while
    // status === 'open_registration'. Per-category gating below remains
    // as a second-level filter.
    if (tournament.status !== 'open_registration') {
      return res.status(400).json({
        error: 'As inscrições para este torneio não estão abertas.'
      });
    }

    // Get tournament category
    const [tcRows] = await pool.query(`
      SELECT tc.id, tc.registration_type, tc.registration_open
      FROM tournament_categories tc
      JOIN categories c ON tc.category_id = c.id
      WHERE tc.tournament_id = ? AND c.code = ?
    `, [tournament.id, categoryCode]);

    if (tcRows.length === 0) {
      return res.status(404).json({ error: 'Categoria não encontrada neste torneio' });
    }

    const tournamentCategory = tcRows[0];

    // Check if registration is open and type is 'form'
    if (tournamentCategory.registration_type !== 'form') {
      return res.status(400).json({ error: 'Inscrições por formulário não estão disponíveis para esta categoria' });
    }

    if (!tournamentCategory.registration_open) {
      return res.status(400).json({ error: 'Inscrições estão fechadas para esta categoria' });
    }

    // Check for duplicates
    const identifier = player1Email || player1Whatsapp;
    if (identifier) {
      const duplicate = await Signup.checkDuplicate(
        tournamentCategory.id,
        player1Email,
        player1Whatsapp
      );
      if (duplicate) {
        return res.status(400).json({
          error: 'Já existe uma inscrição com este email ou WhatsApp nesta categoria'
        });
      }
    }

    // Create signup
    const signup = await Signup.create({
      tournamentId: tournament.id,
      tournamentCategoryId: tournamentCategory.id,
      signupType,
      player1Name,
      player1Whatsapp,
      player1Email,
      player2Name: signupType === 'pair' ? player2Name : null,
      player2Whatsapp: signupType === 'pair' ? player2Whatsapp : null,
      player2Email: signupType === 'pair' ? player2Email : null,
      skillPot: signupType === 'individual' ? skillPot : null,
      notes
    });

    res.status(201).json({
      message: 'Inscrição realizada com sucesso!',
      signup: {
        id: signup.uuid,
        type: signup.signup_type,
        player1: signup.player1_name,
        player2: signup.player2_name,
        status: signup.status
      }
    });
  } catch (error) {
    console.error('Create signup error:', error);
    res.status(500).json({ error: 'Falha ao criar inscrição' });
  }
});

/**
 * GET /api/signups/admin/tournament/:uuid
 * Get all signups for a tournament (admin only)
 */
router.get('/admin/tournament/:uuid', authenticate, adminOnly, async (req, res) => {
  try {
    const tournament = await Tournament.findByUuid(req.params.uuid);
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    const { category, status } = req.query;
    const signups = await Signup.findByTournament(tournament.id, {
      categoryCode: category,
      status
    });

    res.json({
      tournament: {
        id: tournament.id,
        uuid: tournament.uuid,
        name: tournament.name
      },
      data: signups,
      count: signups.length
    });
  } catch (error) {
    console.error('Get admin signups error:', error);
    res.status(500).json({ error: 'Failed to get signups' });
  }
});

/**
 * PUT /api/signups/admin/:uuid/status
 * Update signup status (admin only)
 */
router.put('/admin/:uuid/status', authenticate, adminOnly, async (req, res) => {
  try {
    const { status, pairedWithId } = req.body;
    const validStatuses = ['pending', 'confirmed', 'waitlist', 'cancelled', 'paired'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const signup = await Signup.findByUuid(req.params.uuid);
    if (!signup) {
      return res.status(404).json({ error: 'Signup not found' });
    }

    const updated = await Signup.updateStatus(signup.id, status, pairedWithId);

    res.json({
      message: 'Status updated',
      signup: updated
    });
  } catch (error) {
    console.error('Update signup status error:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

/**
 * DELETE /api/signups/admin/:uuid
 * Delete a signup (admin only)
 */
router.delete('/admin/:uuid', authenticate, adminOnly, async (req, res) => {
  try {
    const signup = await Signup.findByUuid(req.params.uuid);
    if (!signup) {
      return res.status(404).json({ error: 'Signup not found' });
    }

    await Signup.delete(signup.id);

    res.json({ message: 'Signup deleted' });
  } catch (error) {
    console.error('Delete signup error:', error);
    res.status(500).json({ error: 'Failed to delete signup' });
  }
});

/**
 * PUT /api/signups/admin/category/:id/config
 * Update registration config for a category (admin only)
 */
router.put('/admin/category/:id/config', authenticate, adminOnly, async (req, res) => {
  try {
    const { registrationType, registrationUrl, registrationOpen } = req.body;

    const validTypes = ['none', 'external', 'form'];
    if (registrationType && !validTypes.includes(registrationType)) {
      return res.status(400).json({ error: 'Invalid registration type' });
    }

    const updates = [];
    const params = [];

    if (registrationType !== undefined) {
      updates.push('registration_type = ?');
      params.push(registrationType);
    }

    if (registrationUrl !== undefined) {
      updates.push('registration_url = ?');
      params.push(registrationUrl || null);
    }

    if (registrationOpen !== undefined) {
      updates.push('registration_open = ?');
      params.push(registrationOpen ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    params.push(req.params.id);

    await pool.query(
      `UPDATE tournament_categories SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    res.json({ message: 'Registration config updated' });
  } catch (error) {
    console.error('Update category config error:', error);
    res.status(500).json({ error: 'Failed to update config' });
  }
});

module.exports = router;
