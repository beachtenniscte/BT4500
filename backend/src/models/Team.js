const { pool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class Team {
  static async findAll(options = {}) {
    const { categoryId, playerId, active = true, limit = 100, offset = 0 } = options;

    let query = `
      SELECT t.*,
             p1.full_name as player1_name,
             p2.full_name as player2_name,
             p1.gender as player1_gender,
             p2.gender as player2_gender,
             c.code as category_code,
             c.name as category_name,
             CONCAT(p1.full_name, ' / ', p2.full_name) as team_name
      FROM teams t
      JOIN players p1 ON t.player1_id = p1.id
      JOIN players p2 ON t.player2_id = p2.id
      JOIN categories c ON t.category_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (active !== null) {
      query += ` AND t.active = ?`;
      params.push(active ? 1 : 0);
    }

    if (categoryId) {
      query += ` AND t.category_id = ?`;
      params.push(categoryId);
    }

    if (playerId) {
      query += ` AND (t.player1_id = ? OR t.player2_id = ?)`;
      params.push(playerId, playerId);
    }

    query += ` ORDER BY t.id OFFSET ? ROWS FETCH NEXT ? ROWS ONLY`;
    params.push(parseInt(offset), parseInt(limit));

    const [rows] = await pool.query(query, params);
    return rows;
  }

  static async findById(id) {
    const [rows] = await pool.query(`
      SELECT t.*,
             p1.full_name as player1_name,
             p2.full_name as player2_name,
             c.code as category_code,
             c.name as category_name,
             CONCAT(p1.full_name, ' / ', p2.full_name) as team_name
      FROM teams t
      JOIN players p1 ON t.player1_id = p1.id
      JOIN players p2 ON t.player2_id = p2.id
      JOIN categories c ON t.category_id = c.id
      WHERE t.id = ?
    `, [id]);
    return rows[0] || null;
  }

  static async findByUuid(uuid) {
    const [rows] = await pool.query(`
      SELECT t.*,
             p1.full_name as player1_name,
             p2.full_name as player2_name,
             c.code as category_code,
             CONCAT(p1.full_name, ' / ', p2.full_name) as team_name
      FROM teams t
      JOIN players p1 ON t.player1_id = p1.id
      JOIN players p2 ON t.player2_id = p2.id
      JOIN categories c ON t.category_id = c.id
      WHERE t.uuid = ?
    `, [uuid]);
    return rows[0] || null;
  }

  static async findByPlayers(player1Id, player2Id, categoryId) {
    // Check both combinations since order might differ
    const [rows] = await pool.query(`
      SELECT t.*,
             p1.full_name as player1_name,
             p2.full_name as player2_name,
             CONCAT(p1.full_name, ' / ', p2.full_name) as team_name
      FROM teams t
      JOIN players p1 ON t.player1_id = p1.id
      JOIN players p2 ON t.player2_id = p2.id
      WHERE t.category_id = ?
        AND ((t.player1_id = ? AND t.player2_id = ?) OR (t.player1_id = ? AND t.player2_id = ?))
        AND t.active = 1
    `, [categoryId, player1Id, player2Id, player2Id, player1Id]);

    return rows[0] || null;
  }

  static async findByTeamName(teamName, categoryId) {
    // Team name format: "Player1 Name / Player2 Name"
    const [rows] = await pool.query(`
      SELECT t.*,
             p1.full_name as player1_name,
             p2.full_name as player2_name,
             CONCAT(p1.full_name, ' / ', p2.full_name) as team_name
      FROM teams t
      JOIN players p1 ON t.player1_id = p1.id
      JOIN players p2 ON t.player2_id = p2.id
      WHERE t.category_id = ?
        AND (CONCAT(p1.full_name, ' / ', p2.full_name) = ?
             OR CONCAT(p2.full_name, ' / ', p1.full_name) = ?)
        AND t.active = 1
    `, [categoryId, teamName, teamName]);

    return rows[0] || null;
  }

  static async findOrCreate(player1Id, player2Id, categoryId) {
    let team = await this.findByPlayers(player1Id, player2Id, categoryId);

    if (!team) {
      team = await this.create({ player1Id, player2Id, categoryId });
    }

    return team;
  }

  static async create(data) {
    const uuid = uuidv4();
    const { player1Id, player2Id, categoryId } = data;

    const [result] = await pool.query(
      `INSERT INTO teams (uuid, player1_id, player2_id, category_id)
       OUTPUT INSERTED.id
       VALUES (?, ?, ?, ?)`,
      [uuid, player1Id, player2Id, categoryId]
    );

    const insertedId = result[0]?.id;
    return this.findById(insertedId);
  }

  static async update(id, data) {
    const fields = [];
    const values = [];

    const allowedFields = ['player1_id', 'player2_id', 'category_id', 'active'];

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
      `UPDATE teams SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    return this.findById(id);
  }

  static async getMatches(teamId, tournamentId = null) {
    let query = `
      SELECT m.*,
             c.code as category_code,
             t.name as tournament_name,
             CASE
               WHEN m.team1_id = ? THEN CONCAT(p2a.full_name, ' / ', p2b.full_name)
               ELSE CONCAT(p1a.full_name, ' / ', p1b.full_name)
             END as opponent_name,
             CASE WHEN m.winner_team_id = ? THEN 'won' ELSE 'lost' END as result
      FROM matches m
      JOIN tournaments t ON m.tournament_id = t.id
      JOIN tournament_categories tc ON m.tournament_category_id = tc.id
      JOIN categories c ON tc.category_id = c.id
      LEFT JOIN teams t1 ON m.team1_id = t1.id
      LEFT JOIN teams t2 ON m.team2_id = t2.id
      LEFT JOIN players p1a ON t1.player1_id = p1a.id
      LEFT JOIN players p1b ON t1.player2_id = p1b.id
      LEFT JOIN players p2a ON t2.player1_id = p2a.id
      LEFT JOIN players p2b ON t2.player2_id = p2b.id
      WHERE (m.team1_id = ? OR m.team2_id = ?)
        AND m.status = 'completed'
    `;
    const params = [teamId, teamId, teamId, teamId];

    if (tournamentId) {
      query += ` AND m.tournament_id = ?`;
      params.push(tournamentId);
    }

    query += ` ORDER BY m.scheduled_date DESC, m.scheduled_time DESC`;

    const [rows] = await pool.query(query, params);
    return rows;
  }

  static async delete(id) {
    await pool.query(`UPDATE teams SET active = 0 WHERE id = ?`, [id]);
    return true;
  }
}

module.exports = Team;
