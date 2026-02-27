const { pool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class Signup {
  /**
   * Get all signups for a tournament
   */
  static async findByTournament(tournamentId, options = {}) {
    const { categoryCode, status } = options;

    let query = `
      SELECT s.*,
             c.code as category_code,
             c.name as category_name,
             t.name as tournament_name
      FROM tournament_signups s
      JOIN tournament_categories tc ON s.tournament_category_id = tc.id
      JOIN categories c ON tc.category_id = c.id
      JOIN tournaments t ON s.tournament_id = t.id
      WHERE s.tournament_id = ?
    `;
    const params = [tournamentId];

    if (categoryCode) {
      query += ` AND c.code = ?`;
      params.push(categoryCode);
    }

    if (status) {
      query += ` AND s.status = ?`;
      params.push(status);
    }

    query += ` ORDER BY s.created_at DESC`;

    const [rows] = await pool.query(query, params);
    return rows;
  }

  /**
   * Get signup by UUID
   */
  static async findByUuid(uuid) {
    const [rows] = await pool.query(`
      SELECT s.*,
             c.code as category_code,
             c.name as category_name,
             t.name as tournament_name,
             t.uuid as tournament_uuid
      FROM tournament_signups s
      JOIN tournament_categories tc ON s.tournament_category_id = tc.id
      JOIN categories c ON tc.category_id = c.id
      JOIN tournaments t ON s.tournament_id = t.id
      WHERE s.uuid = ?
    `, [uuid]);
    return rows[0] || null;
  }

  /**
   * Get signup by ID
   */
  static async findById(id) {
    const [rows] = await pool.query(`SELECT * FROM tournament_signups WHERE id = ?`, [id]);
    return rows[0] || null;
  }

  /**
   * Create a new signup
   */
  static async create(data) {
    const uuid = uuidv4();
    const {
      tournamentId,
      tournamentCategoryId,
      signupType,
      player1Name,
      player1Whatsapp,
      player1Email,
      player1Id,
      player2Name,
      player2Whatsapp,
      player2Email,
      player2Id,
      skillPot,
      notes
    } = data;

    const [result] = await pool.query(
      `INSERT INTO tournament_signups (
        uuid, tournament_id, tournament_category_id, signup_type,
        player1_name, player1_whatsapp, player1_email, player1_id,
        player2_name, player2_whatsapp, player2_email, player2_id,
        skill_pot, notes
      )
      OUTPUT INSERTED.id
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuid, tournamentId, tournamentCategoryId, signupType,
        player1Name, player1Whatsapp || null, player1Email || null, player1Id || null,
        player2Name || null, player2Whatsapp || null, player2Email || null, player2Id || null,
        skillPot || null, notes || null
      ]
    );

    const insertedId = result[0]?.id;
    return this.findById(insertedId);
  }

  /**
   * Update signup status
   */
  static async updateStatus(id, status, pairedWithId = null) {
    await pool.query(
      `UPDATE tournament_signups SET status = ?, paired_with_id = ?, updated_at = GETDATE() WHERE id = ?`,
      [status, pairedWithId, id]
    );
    return this.findById(id);
  }

  /**
   * Delete a signup
   */
  static async delete(id) {
    await pool.query(`DELETE FROM tournament_signups WHERE id = ?`, [id]);
    return true;
  }

  /**
   * Get signup counts by category for a tournament
   */
  static async getCountsByCategory(tournamentId) {
    const [rows] = await pool.query(`
      SELECT
        c.code as category_code,
        COUNT(*) as total,
        SUM(CASE WHEN s.signup_type = 'pair' THEN 1 ELSE 0 END) as pairs,
        SUM(CASE WHEN s.signup_type = 'individual' THEN 1 ELSE 0 END) as individuals,
        SUM(CASE WHEN s.status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
        SUM(CASE WHEN s.status = 'pending' THEN 1 ELSE 0 END) as pending
      FROM tournament_signups s
      JOIN tournament_categories tc ON s.tournament_category_id = tc.id
      JOIN categories c ON tc.category_id = c.id
      WHERE s.tournament_id = ?
      GROUP BY c.code
    `, [tournamentId]);
    return rows;
  }

  /**
   * Check if a player (by email or whatsapp) already signed up for a category
   */
  static async checkDuplicate(tournamentCategoryId, player1Email, player1Whatsapp) {
    let query = `
      SELECT id FROM tournament_signups
      WHERE tournament_category_id = ?
      AND status NOT IN ('cancelled')
      AND (
    `;
    const params = [tournamentCategoryId];
    const conditions = [];

    if (player1Email) {
      conditions.push(`player1_email = ? OR player2_email = ?`);
      params.push(player1Email, player1Email);
    }

    if (player1Whatsapp) {
      conditions.push(`player1_whatsapp = ? OR player2_whatsapp = ?`);
      params.push(player1Whatsapp, player1Whatsapp);
    }

    if (conditions.length === 0) {
      return null; // No identifier to check
    }

    query += conditions.join(' OR ') + `)`;

    const [rows] = await pool.query(query, params);
    return rows[0] || null;
  }

  /**
   * Get individual signups waiting to be paired
   */
  static async getUnpairedIndividuals(tournamentCategoryId) {
    const [rows] = await pool.query(`
      SELECT * FROM tournament_signups
      WHERE tournament_category_id = ?
      AND signup_type = 'individual'
      AND status = 'pending'
      AND paired_with_id IS NULL
      ORDER BY skill_pot, created_at
    `, [tournamentCategoryId]);
    return rows;
  }
}

module.exports = Signup;
