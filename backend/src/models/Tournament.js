const { pool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class Tournament {
  static async findAll(options = {}) {
    const { limit = 50, offset = 0, year, tier, status, orderBy = 'start_date', order = 'DESC' } = options;

    let query = `SELECT * FROM tournaments WHERE 1=1`;
    const params = [];

    if (year) {
      query += ` AND year = ?`;
      params.push(year);
    }

    if (tier) {
      query += ` AND tier = ?`;
      params.push(tier);
    }

    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }

    const validOrderBy = ['start_date', 'end_date', 'name', 'tier', 'created_at'];
    const validOrder = ['ASC', 'DESC'];

    const safeOrderBy = validOrderBy.includes(orderBy) ? orderBy : 'start_date';
    const safeOrder = validOrder.includes(order.toUpperCase()) ? order.toUpperCase() : 'DESC';

    query += ` ORDER BY ${safeOrderBy} ${safeOrder} OFFSET ? ROWS FETCH NEXT ? ROWS ONLY`;
    params.push(parseInt(offset), parseInt(limit));

    const [rows] = await pool.query(query, params);
    return rows;
  }

  static async findById(id) {
    const [rows] = await pool.query(`SELECT * FROM tournaments WHERE id = ?`, [id]);
    return rows[0] || null;
  }

  static async findByUuid(uuid) {
    const [rows] = await pool.query(`SELECT * FROM tournaments WHERE uuid = ?`, [uuid]);
    return rows[0] || null;
  }

  static async findByCode(code) {
    const [rows] = await pool.query(`SELECT * FROM tournaments WHERE code = ?`, [code]);
    return rows[0] || null;
  }

  static async create(data) {
    const uuid = uuidv4();
    const { name, code, tier, location, startDate, endDate, year, description } = data;

    const [result] = await pool.query(
      `INSERT INTO tournaments (uuid, name, code, tier, location, start_date, end_date, year, description)
       OUTPUT INSERTED.id
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuid, name, code, tier, location, startDate, endDate, year, description || null]
    );

    const insertedId = result[0]?.id;
    return this.findById(insertedId);
  }

  static async update(id, data) {
    const fields = [];
    const values = [];

    const allowedFields = ['name', 'code', 'tier', 'location', 'start_date', 'end_date', 'year', 'status', 'description'];

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
      `UPDATE tournaments SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    return this.findById(id);
  }

  static async getCategories(tournamentId) {
    const [rows] = await pool.query(`
      SELECT tc.*, c.code, c.name, c.gender, c.level
      FROM tournament_categories tc
      JOIN categories c ON tc.category_id = c.id
      WHERE tc.tournament_id = ?
    `, [tournamentId]);
    return rows;
  }

  static async addCategory(tournamentId, categoryId, drawSize = 16, format = 'mixed') {
    // Check if exists first (MS SQL doesn't have ON DUPLICATE KEY)
    const [existing] = await pool.query(
      `SELECT id FROM tournament_categories WHERE tournament_id = ? AND category_id = ?`,
      [tournamentId, categoryId]
    );

    if (existing.length > 0) {
      await pool.query(
        `UPDATE tournament_categories SET draw_size = ?, format = ? WHERE tournament_id = ? AND category_id = ?`,
        [drawSize, format, tournamentId, categoryId]
      );
      return existing[0];
    } else {
      const [result] = await pool.query(
        `INSERT INTO tournament_categories (tournament_id, category_id, draw_size, format)
         OUTPUT INSERTED.id
         VALUES (?, ?, ?, ?)`,
        [tournamentId, categoryId, drawSize, format]
      );
      return result[0];
    }
  }

  static async getMatches(tournamentId, categoryCode = null) {
    let query = `
      SELECT m.*,
             c.code as category_code,
             c.name as category_name,
             t1.id as team1_id,
             t2.id as team2_id,
             CONCAT(p1a.full_name, ' / ', p1b.full_name) as team1_name,
             CONCAT(p2a.full_name, ' / ', p2b.full_name) as team2_name,
             CONCAT(pw1.full_name, ' / ', pw2.full_name) as winner_name
      FROM matches m
      JOIN tournament_categories tc ON m.tournament_category_id = tc.id
      JOIN categories c ON tc.category_id = c.id
      LEFT JOIN teams t1 ON m.team1_id = t1.id
      LEFT JOIN teams t2 ON m.team2_id = t2.id
      LEFT JOIN players p1a ON t1.player1_id = p1a.id
      LEFT JOIN players p1b ON t1.player2_id = p1b.id
      LEFT JOIN players p2a ON t2.player1_id = p2a.id
      LEFT JOIN players p2b ON t2.player2_id = p2b.id
      LEFT JOIN teams tw ON m.winner_team_id = tw.id
      LEFT JOIN players pw1 ON tw.player1_id = pw1.id
      LEFT JOIN players pw2 ON tw.player2_id = pw2.id
      WHERE m.tournament_id = ?
    `;
    const params = [tournamentId];

    if (categoryCode) {
      query += ` AND c.code = ?`;
      params.push(categoryCode);
    }

    query += ` ORDER BY m.scheduled_date, m.scheduled_time, m.round_order, m.match_number`;

    const [rows] = await pool.query(query, params);
    return rows;
  }

  static async getStandings(tournamentId, categoryCode = null) {
    let query = `
      SELECT
        tr.*,
        CONCAT(p1.full_name, ' / ', p2.full_name) as team_name,
        c.code as category_code
      FROM tournament_registrations tr
      JOIN teams t ON tr.team_id = t.id
      JOIN players p1 ON t.player1_id = p1.id
      JOIN players p2 ON t.player2_id = p2.id
      JOIN tournament_categories tc ON tr.tournament_category_id = tc.id
      JOIN categories c ON tc.category_id = c.id
      WHERE tr.tournament_id = ?
    `;
    const params = [tournamentId];

    if (categoryCode) {
      query += ` AND c.code = ?`;
      params.push(categoryCode);
    }

    query += ` ORDER BY tr.points_earned DESC, tr.final_position ASC`;

    const [rows] = await pool.query(query, params);
    return rows;
  }

  static async delete(id) {
    await pool.query(`DELETE FROM tournaments WHERE id = ?`, [id]);
    return true;
  }
}

module.exports = Tournament;
