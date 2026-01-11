const { pool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class Player {
  static async findAll(options = {}) {
    const { limit = 100, offset = 0, gender, level, search, orderBy = 'ranking', order = 'ASC' } = options;

    let query = `
      SELECT p.*,
             u.email as user_email
      FROM players p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.active = 1
    `;
    const params = [];

    if (gender) {
      query += ` AND p.gender = ?`;
      params.push(gender);
    }

    if (level) {
      query += ` AND p.level = ?`;
      params.push(level);
    }

    if (search) {
      query += ` AND (p.full_name LIKE ? OR p.city LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    const validOrderBy = ['ranking', 'total_points', 'full_name', 'created_at'];
    const validOrder = ['ASC', 'DESC'];

    const safeOrderBy = validOrderBy.includes(orderBy) ? orderBy : 'ranking';
    const safeOrder = validOrder.includes(order.toUpperCase()) ? order.toUpperCase() : 'ASC';

    query += ` ORDER BY ${safeOrderBy} ${safeOrder} OFFSET ? ROWS FETCH NEXT ? ROWS ONLY`;
    params.push(parseInt(offset), parseInt(limit));

    const [rows] = await pool.query(query, params);
    return rows;
  }

  static async findById(id) {
    const [rows] = await pool.query(
      `SELECT p.*, u.email as user_email
       FROM players p
       LEFT JOIN users u ON p.user_id = u.id
       WHERE p.id = ?`,
      [id]
    );
    return rows[0] || null;
  }

  static async findByUuid(uuid) {
    const [rows] = await pool.query(
      `SELECT p.*, u.email as user_email
       FROM players p
       LEFT JOIN users u ON p.user_id = u.id
       WHERE p.uuid = ?`,
      [uuid]
    );
    return rows[0] || null;
  }

  static async findByName(fullName) {
    const [rows] = await pool.query(
      `SELECT * FROM players WHERE full_name = ? AND active = 1`,
      [fullName]
    );
    return rows[0] || null;
  }

  /**
   * Find a player by email address (for user-player linking)
   * @param {string} email - The email to search for
   * @returns {Promise<Object|null>} The player if found, null otherwise
   */
  static async findByEmail(email) {
    if (!email) return null;
    const [rows] = await pool.query(
      `SELECT * FROM players WHERE email = ? AND active = 1`,
      [email.toLowerCase().trim()]
    );
    return rows[0] || null;
  }

  /**
   * Find an unlinked player by email (no user_id set)
   * @param {string} email - The email to search for
   * @returns {Promise<Object|null>} The player if found and unlinked, null otherwise
   */
  static async findUnlinkedByEmail(email) {
    if (!email) return null;
    const [rows] = await pool.query(
      `SELECT * FROM players WHERE email = ? AND user_id IS NULL AND active = 1`,
      [email.toLowerCase().trim()]
    );
    return rows[0] || null;
  }

  /**
   * Link a player to a user account
   * @param {number} playerId - The player's internal ID
   * @param {number} userId - The user's internal ID
   * @returns {Promise<Object>} The updated player
   */
  static async linkToUser(playerId, userId) {
    await pool.query(
      `UPDATE players SET user_id = ? WHERE id = ?`,
      [userId, playerId]
    );
    return this.findById(playerId);
  }

  static async findOrCreateByName(firstName, lastName, gender) {
    const fullName = `${firstName} ${lastName}`;
    let player = await this.findByName(fullName);

    if (!player) {
      player = await this.create({
        firstName,
        lastName,
        gender,
        level: 2 // Default to intermediate
      });
    }

    return player;
  }

  static async create(data) {
    const uuid = uuidv4();
    const { firstName, lastName, gender, birthDate, city, country, photoUrl, level, userId, email } = data;

    const [result] = await pool.query(
      `INSERT INTO players (uuid, user_id, first_name, last_name, gender, birth_date, city, country, photo_url, level, email)
       OUTPUT INSERTED.id
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuid, userId || null, firstName, lastName, gender, birthDate || null, city || null, country || 'Portugal', photoUrl || null, level || 2, email ? email.toLowerCase().trim() : null]
    );

    const insertedId = result[0]?.id;
    return this.findById(insertedId);
  }

  static async update(id, data) {
    const fields = [];
    const values = [];

    const allowedFields = ['first_name', 'last_name', 'gender', 'birth_date', 'city', 'country', 'photo_url', 'level', 'total_points', 'ranking', 'active'];

    for (const [key, value] of Object.entries(data)) {
      const dbField = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (allowedFields.includes(dbField)) {
        fields.push(`${dbField} = ?`);
        values.push(value);
      }
    }

    if (fields.length === 0) return this.findById(id);

    values.push(id);
    await pool.query(
      `UPDATE players SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    return this.findById(id);
  }

  static async updatePoints(playerId, points) {
    await pool.query(
      `UPDATE players SET total_points = total_points + ? WHERE id = ?`,
      [points, playerId]
    );
  }

  static async recalculateRankings(categoryGender = null) {
    let query = `
      SELECT id, total_points, gender FROM players
      WHERE active = 1
    `;
    const params = [];

    if (categoryGender && categoryGender !== 'MX') {
      query += ` AND gender = ?`;
      params.push(categoryGender);
    }

    query += ` ORDER BY total_points DESC`;

    const [players] = await pool.query(query, params);

    for (let i = 0; i < players.length; i++) {
      await pool.query(
        `UPDATE players SET ranking = ? WHERE id = ?`,
        [i + 1, players[i].id]
      );
    }

    return players.length;
  }

  static async getStats(playerId) {
    const [stats] = await pool.query(`
      SELECT
        COUNT(DISTINCT ptr.tournament_id) as tournaments_played,
        SUM(ptr.matches_won) as total_wins,
        SUM(ptr.matches_lost) as total_losses,
        SUM(ptr.points_earned) as total_points,
        COUNT(CASE WHEN ptr.final_position = 1 THEN 1 END) as titles,
        COUNT(CASE WHEN ptr.final_position <= 3 THEN 1 END) as podiums
      FROM player_tournament_results ptr
      WHERE ptr.player_id = ?
    `, [playerId]);

    return stats[0];
  }

  static async getTournamentHistory(playerId, limit = 10) {
    const [history] = await pool.query(`
      SELECT TOP (?)
        ptr.*,
        t.name as tournament_name,
        t.tier as tournament_tier,
        t.start_date,
        c.code as category_code,
        c.name as category_name,
        p.full_name as partner_name
      FROM player_tournament_results ptr
      JOIN tournaments t ON ptr.tournament_id = t.id
      JOIN categories c ON ptr.category_id = c.id
      JOIN players p ON ptr.partner_id = p.id
      WHERE ptr.player_id = ?
      ORDER BY t.start_date DESC
    `, [limit, playerId]);

    return history;
  }

  static async delete(id) {
    await pool.query(`UPDATE players SET active = 0 WHERE id = ?`, [id]);
    return true;
  }
}

module.exports = Player;
