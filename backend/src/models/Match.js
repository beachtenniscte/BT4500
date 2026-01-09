const { pool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class Match {
  static ROUND_ORDER = {
    'Fase de grupos': 1,
    'R32': 2,
    'R16': 3,
    'Quartas de Final': 4,
    'Semifinal': 5,
    'Final': 6
  };

  static parseRound(roundStr) {
    // Handle group stage rounds like "Fase de grupos - G3"
    if (roundStr.startsWith('Fase de grupos')) {
      return { name: 'Fase de grupos', group: roundStr.split(' - ')[1] || null, order: 1 };
    }

    const order = this.ROUND_ORDER[roundStr] || 0;
    return { name: roundStr, group: null, order };
  }

  static parseResult(resultStr) {
    if (!resultStr || resultStr === 'Desistência' || resultStr === 'W.O.') {
      return { walkover: true, sets: [] };
    }

    // Parse results like "6/4 6/3" or "6/4 2/6 10/8" or "7/6(5) 6/4"
    const sets = resultStr.trim().split(' ').map(setStr => {
      // Handle tiebreak notation like "7/6(5)"
      const tiebreakMatch = setStr.match(/(\d+)\/(\d+)\((\d+)\)/);
      if (tiebreakMatch) {
        return {
          score1: parseInt(tiebreakMatch[1]),
          score2: parseInt(tiebreakMatch[2]),
          tiebreak: parseInt(tiebreakMatch[3])
        };
      }

      const [score1, score2] = setStr.split('/').map(s => parseInt(s));
      return { score1, score2 };
    });

    return { walkover: false, sets };
  }

  static determineWinner(resultStr, team1Name, team2Name, winnerName) {
    // If winner is explicitly provided
    if (winnerName) {
      if (winnerName === team1Name) return 1;
      if (winnerName === team2Name) return 2;
    }

    // If walkover or retirement
    if (resultStr === 'Desistência' || resultStr === 'W.O.') {
      return null; // Need explicit winner
    }

    // Parse and count sets won
    const parsed = this.parseResult(resultStr);
    if (parsed.walkover) return null;

    let team1Sets = 0;
    let team2Sets = 0;

    for (const set of parsed.sets) {
      if (set.score1 > set.score2) team1Sets++;
      else if (set.score2 > set.score1) team2Sets++;
    }

    if (team1Sets > team2Sets) return 1;
    if (team2Sets > team1Sets) return 2;
    return null;
  }

  static async findAll(options = {}) {
    const { tournamentId, categoryId, round, status, date, limit = 100, offset = 0 } = options;

    let query = `
      SELECT m.*,
             c.code as category_code,
             c.name as category_name
      FROM matches m
      JOIN tournament_categories tc ON m.tournament_category_id = tc.id
      JOIN categories c ON tc.category_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (tournamentId) {
      query += ` AND m.tournament_id = ?`;
      params.push(tournamentId);
    }

    if (categoryId) {
      query += ` AND tc.category_id = ?`;
      params.push(categoryId);
    }

    if (round) {
      query += ` AND m.round LIKE ?`;
      params.push(`%${round}%`);
    }

    if (status) {
      query += ` AND m.status = ?`;
      params.push(status);
    }

    if (date) {
      query += ` AND m.scheduled_date = ?`;
      params.push(date);
    }

    query += ` ORDER BY m.scheduled_date, m.scheduled_time, m.round_order OFFSET ? ROWS FETCH NEXT ? ROWS ONLY`;
    params.push(parseInt(offset), parseInt(limit));

    const [rows] = await pool.query(query, params);
    return rows;
  }

  static async findById(id) {
    const [rows] = await pool.query(`
      SELECT m.*,
             c.code as category_code,
             c.name as category_name
      FROM matches m
      JOIN tournament_categories tc ON m.tournament_category_id = tc.id
      JOIN categories c ON tc.category_id = c.id
      WHERE m.id = ?
    `, [id]);
    return rows[0] || null;
  }

  static async findByUuid(uuid) {
    const [rows] = await pool.query(`
      SELECT m.*,
             c.code as category_code,
             c.name as category_name
      FROM matches m
      JOIN tournament_categories tc ON m.tournament_category_id = tc.id
      JOIN categories c ON tc.category_id = c.id
      WHERE m.uuid = ?
    `, [uuid]);
    return rows[0] || null;
  }

  static async create(data) {
    const uuid = uuidv4();
    const {
      tournamentId, tournamentCategoryId, matchNumber, round, roundOrder,
      court, scheduledDate, scheduledTime, team1Id, team2Id,
      team1RegistrationId, team2RegistrationId
    } = data;

    const [result] = await pool.query(
      `INSERT INTO matches (uuid, tournament_id, tournament_category_id, match_number, round, round_order,
                           court, scheduled_date, scheduled_time, team1_id, team2_id,
                           team1_registration_id, team2_registration_id)
       OUTPUT INSERTED.id
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuid, tournamentId, tournamentCategoryId, matchNumber, round, roundOrder,
       court, scheduledDate, scheduledTime, team1Id, team2Id,
       team1RegistrationId, team2RegistrationId]
    );

    const insertedId = result[0]?.id;
    return this.findById(insertedId);
  }

  static async updateResult(id, data) {
    const { result, winnerTeamId, status, notes } = data;

    // Parse result to get set scores
    const parsed = this.parseResult(result);

    const setScores = {
      set1_team1: parsed.sets[0]?.score1 || null,
      set1_team2: parsed.sets[0]?.score2 || null,
      set2_team1: parsed.sets[1]?.score1 || null,
      set2_team2: parsed.sets[1]?.score2 || null,
      set3_team1: parsed.sets[2]?.score1 || null,
      set3_team2: parsed.sets[2]?.score2 || null
    };

    await pool.query(
      `UPDATE matches SET
        result = ?,
        winner_team_id = ?,
        status = ?,
        notes = ?,
        set1_team1 = ?, set1_team2 = ?,
        set2_team1 = ?, set2_team2 = ?,
        set3_team1 = ?, set3_team2 = ?
       WHERE id = ?`,
      [result, winnerTeamId, status || 'completed', notes,
       setScores.set1_team1, setScores.set1_team2,
       setScores.set2_team1, setScores.set2_team2,
       setScores.set3_team1, setScores.set3_team2,
       id]
    );

    return this.findById(id);
  }

  static async getByTeam(teamId, tournamentId = null) {
    let query = `
      SELECT m.*,
             c.code as category_code
      FROM matches m
      JOIN tournament_categories tc ON m.tournament_category_id = tc.id
      JOIN categories c ON tc.category_id = c.id
      WHERE (m.team1_id = ? OR m.team2_id = ?)
    `;
    const params = [teamId, teamId];

    if (tournamentId) {
      query += ` AND m.tournament_id = ?`;
      params.push(tournamentId);
    }

    query += ` ORDER BY m.scheduled_date, m.scheduled_time`;

    const [rows] = await pool.query(query, params);
    return rows;
  }

  static async delete(id) {
    await pool.query(`DELETE FROM matches WHERE id = ?`, [id]);
    return true;
  }
}

module.exports = Match;
