const { pool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const csv = require('csv-parser');
const Match = require('../models/Match');
const PointsService = require('./PointsService');

class CSVImportService {
  /**
   * Parse player names from CSV format "Player1 / Player2"
   */
  static parseTeamPlayers(teamStr) {
    if (!teamStr) return null;

    const players = teamStr.split(' / ').map(name => {
      const parts = name.trim().split(' ');
      if (parts.length === 1) {
        return { firstName: parts[0], lastName: '' };
      }
      const firstName = parts[0];
      const lastName = parts.slice(1).join(' ');
      return { firstName, lastName };
    });

    return players.length === 2 ? players : null;
  }

  /**
   * Parse date from DD/MM/YYYY format
   */
  static parseDate(dateStr) {
    if (!dateStr) return null;
    const [day, month, year] = dateStr.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  /**
   * Parse time from HH:MMh format
   */
  static parseTime(timeStr) {
    if (!timeStr) return null;
    return timeStr.replace('h', ':00');
  }

  /**
   * Determine gender from category code
   */
  static getGenderFromCategory(categoryCode) {
    if (categoryCode.startsWith('F')) return 'F';
    if (categoryCode.startsWith('M') && !categoryCode.startsWith('MX')) return 'M';
    return 'MX';
  }

  /**
   * Get player gender based on category and position in mixed doubles
   */
  static getPlayerGender(categoryCode, playerIndex, players) {
    const categoryGender = this.getGenderFromCategory(categoryCode);

    if (categoryGender === 'F') return 'F';
    if (categoryGender === 'M') return 'M';

    // For mixed doubles, we need to infer gender
    // Convention: usually listed as Female / Male or based on names
    // This is a simplified heuristic - in production, you'd have a gender database
    return playerIndex === 0 ? 'F' : 'M'; // Assume first player is female in mixed
  }

  /**
   * Import tournament data from CSV file
   */
  static async importFromCSV(filePath, options = {}) {
    // For MS SQL, we use simple queries without explicit transaction management
    const results = {
      tournament: null,
      categories: [],
      players: [],
      teams: [],
      matches: [],
      errors: []
    };

    try {

      // Read and parse CSV
      const rows = await this.readCSV(filePath);

      if (rows.length === 0) {
        throw new Error('CSV file is empty');
      }

      // Extract tournament info from first row
      const firstRow = rows[0];
      const tournamentCode = firstRow['TORNEIO'] || firstRow.TORNEIO;

      // Parse tournament info
      const tournamentInfo = this.parseTournamentCode(tournamentCode);

      // Create or find tournament
      let tournament = await this.findOrCreateTournament({
        ...tournamentInfo,
        location: firstRow['LOCAL'] || firstRow.LOCAL || 'BT Espinho'
      });
      results.tournament = tournament;

      // Get unique categories
      const categorySet = new Set();
      for (const row of rows) {
        const catStr = row['CATEGORIA'] || row.CATEGORIA;
        if (catStr) {
          const catCode = catStr.split(' - ')[0].trim();
          categorySet.add(catCode);
        }
      }

      // Create tournament categories
      for (const catCode of categorySet) {
        const category = await this.findOrCreateCategory(catCode);
        const tournamentCategory = await this.createTournamentCategory(tournament.id, category.id);
        results.categories.push({ code: catCode, ...category, tournamentCategoryId: tournamentCategory.id });
      }

      // Create category lookup
      const categoryLookup = {};
      for (const cat of results.categories) {
        categoryLookup[cat.code] = cat;
      }

      // Process each match
      const playerCache = new Map();
      const teamCache = new Map();

      for (const row of rows) {
        try {
          const catStr = row['CATEGORIA'] || row.CATEGORIA;
          const catCode = catStr?.split(' - ')[0].trim();
          const category = categoryLookup[catCode];

          if (!category) {
            results.errors.push({ row, error: `Category not found: ${catCode}` });
            continue;
          }

          // Parse teams
          const team1Str = row['JOGADOR(ES) 01'] || row['JOGADOR(ES)_01'];
          const team2Str = row['JOGADOR(ES) 02'] || row['JOGADOR(ES)_02'];
          const winnerStr = row['VENCEDOR(ES)'] || row['VENCEDOR(ES)'];

          if (!team1Str || !team2Str) {
            results.errors.push({ row, error: 'Missing team names' });
            continue;
          }

          // Get or create players and teams
          const team1 = await this.getOrCreateTeam(
            team1Str, catCode, category.id, playerCache, teamCache
          );
          const team2 = await this.getOrCreateTeam(
            team2Str, catCode, category.id, playerCache, teamCache
          );

          if (!team1 || !team2) {
            results.errors.push({ row, error: 'Could not create teams' });
            continue;
          }

          // Determine winner
          const resultStr = (row['RESULTADO'] || row.RESULTADO || '').trim();
          const status = (row['STATUS'] || row.STATUS || '').toLowerCase();

          let winnerTeamId = null;
          if (winnerStr) {
            if (this.normalizeTeamName(winnerStr) === this.normalizeTeamName(team1Str)) {
              winnerTeamId = team1.id;
            } else if (this.normalizeTeamName(winnerStr) === this.normalizeTeamName(team2Str)) {
              winnerTeamId = team2.id;
            }
          }

          // If no explicit winner, determine from result
          if (!winnerTeamId && resultStr && resultStr !== 'Desistência' && resultStr !== 'W.O.') {
            const winnerNum = Match.determineWinner(resultStr, team1Str, team2Str, winnerStr);
            if (winnerNum === 1) winnerTeamId = team1.id;
            else if (winnerNum === 2) winnerTeamId = team2.id;
          }

          // Parse round
          const roundStr = row['FASE'] || row.FASE || '';
          const roundInfo = Match.parseRound(roundStr);

          // Create match
          const match = await this.createMatch({
            tournamentId: tournament.id,
            tournamentCategoryId: category.tournamentCategoryId,
            matchNumber: parseInt(row['NUMERO'] || row.NUMERO || 0),
            round: roundStr,
            roundOrder: roundInfo.order,
            court: row['QUADRA'] || row.QUADRA,
            scheduledDate: this.parseDate(row['DATA'] || row.DATA),
            scheduledTime: this.parseTime(row['HORA'] || row.HORA),
            team1Id: team1.id,
            team2Id: team2.id,
            winnerTeamId,
            result: resultStr || null,
            status: status.includes('conclu') ? 'completed' : (status.includes('desist') || status === 'w.o.' ? 'walkover' : 'scheduled')
          });

          results.matches.push(match);
        } catch (rowError) {
          results.errors.push({ row, error: rowError.message });
        }
      }

      // Collect unique players and teams
      results.players = Array.from(playerCache.values());
      results.teams = Array.from(teamCache.values());

      // Award points after import
      if (options.calculatePoints !== false) {
        try {
          const pointsResult = await PointsService.awardTournamentPoints(tournament.id);
          results.pointsAwarded = pointsResult;
        } catch (pointsError) {
          results.errors.push({ error: `Points calculation failed: ${pointsError.message}` });
        }
      }

      return results;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Read CSV file and return rows
   */
  static readCSV(filePath) {
    return new Promise((resolve, reject) => {
      const rows = [];
      fs.createReadStream(filePath, { encoding: 'utf-8' })
        .pipe(csv())
        .on('data', (row) => rows.push(row))
        .on('end', () => resolve(rows))
        .on('error', reject);
    });
  }

  /**
   * Parse tournament code like "BT4500 PRATA 10-11 MAIO"
   */
  static parseTournamentCode(code) {
    const parts = code.split(' ');
    const tier = parts.find(p => ['OURO', 'PRATA', 'BRONZE'].includes(p.toUpperCase()))?.toUpperCase() || 'PRATA';

    // Extract dates
    const dateMatch = code.match(/(\d{1,2})-(\d{1,2})\s+(\w+)/);
    let startDate, endDate, year = new Date().getFullYear();

    if (dateMatch) {
      const monthMap = {
        'JAN': '01', 'FEV': '02', 'MAR': '03', 'ABR': '04',
        'MAI': '05', 'JUN': '06', 'JUL': '07', 'AGO': '08',
        'SET': '09', 'OUT': '10', 'NOV': '11', 'DEZ': '12',
        'MAIO': '05'
      };
      const month = monthMap[dateMatch[3].toUpperCase()] || '01';
      startDate = `${year}-${month}-${dateMatch[1].padStart(2, '0')}`;
      endDate = `${year}-${month}-${dateMatch[2].padStart(2, '0')}`;
    } else {
      startDate = new Date().toISOString().split('T')[0];
      endDate = startDate;
    }

    return {
      name: `Liga BT4500 ${tier}`,
      code,
      tier,
      startDate,
      endDate,
      year
    };
  }

  /**
   * Find or create tournament
   */
  static async findOrCreateTournament(data) {
    const [existing] = await pool.query(
      `SELECT * FROM tournaments WHERE code = ?`,
      [data.code]
    );

    if (existing.length) {
      return existing[0];
    }

    const uuid = uuidv4();
    const [result] = await pool.query(
      `INSERT INTO tournaments (uuid, name, code, tier, location, start_date, end_date, year, status)
       OUTPUT INSERTED.id
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'completed')`,
      [uuid, data.name, data.code, data.tier, data.location, data.startDate, data.endDate, data.year]
    );

    const insertedId = result[0]?.id;
    const [tournament] = await pool.query(`SELECT * FROM tournaments WHERE id = ?`, [insertedId]);
    return tournament[0];
  }

  /**
   * Find or create category
   */
  static async findOrCreateCategory(code) {
    const [existing] = await pool.query(
      `SELECT * FROM categories WHERE code = ?`,
      [code]
    );

    if (existing.length) {
      return existing[0];
    }

    // This shouldn't happen if seed was run, but handle it
    const gender = this.getGenderFromCategory(code);
    const level = code.endsWith('1') ? 1 : 2;
    const name = `${gender === 'F' ? 'Femininos' : gender === 'M' ? 'Masculinos' : 'Mistos'} Nível ${level}`;

    const [result] = await pool.query(
      `INSERT INTO categories (code, name, gender, level)
       OUTPUT INSERTED.id
       VALUES (?, ?, ?, ?)`,
      [code, name, gender, level]
    );

    const insertedId = result[0]?.id;
    const [category] = await pool.query(`SELECT * FROM categories WHERE id = ?`, [insertedId]);
    return category[0];
  }

  /**
   * Create tournament category link
   */
  static async createTournamentCategory(tournamentId, categoryId) {
    const [existing] = await pool.query(
      `SELECT * FROM tournament_categories WHERE tournament_id = ? AND category_id = ?`,
      [tournamentId, categoryId]
    );

    if (existing.length) {
      return existing[0];
    }

    const [result] = await pool.query(
      `INSERT INTO tournament_categories (tournament_id, category_id)
       OUTPUT INSERTED.id
       VALUES (?, ?)`,
      [tournamentId, categoryId]
    );

    const insertedId = result[0]?.id;
    return { id: insertedId, tournamentId, categoryId };
  }

  /**
   * Get or create team with players
   */
  static async getOrCreateTeam(teamStr, categoryCode, categoryId, playerCache, teamCache) {
    const cacheKey = `${teamStr}|${categoryId}`;
    if (teamCache.has(cacheKey)) {
      return teamCache.get(cacheKey);
    }

    const players = this.parseTeamPlayers(teamStr);
    if (!players || players.length !== 2) {
      return null;
    }

    // Get or create players
    const playerIds = [];
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      const fullName = `${p.firstName} ${p.lastName}`.trim();
      const playerCacheKey = fullName;

      let player;
      if (playerCache.has(playerCacheKey)) {
        player = playerCache.get(playerCacheKey);
      } else {
        // Check if player exists
        const [existing] = await pool.query(
          `SELECT * FROM players WHERE full_name = ?`,
          [fullName]
        );

        if (existing.length) {
          player = existing[0];
        } else {
          // Determine gender
          const gender = this.getPlayerGender(categoryCode, i, players);

          const uuid = uuidv4();
          const [result] = await pool.query(
            `INSERT INTO players (uuid, first_name, last_name, gender, level)
             OUTPUT INSERTED.id
             VALUES (?, ?, ?, ?, ?)`,
            [uuid, p.firstName, p.lastName, gender, categoryCode.endsWith('1') ? 1 : 2]
          );

          const insertedId = result[0]?.id;
          const [newPlayer] = await pool.query(`SELECT * FROM players WHERE id = ?`, [insertedId]);
          player = newPlayer[0];
        }
        playerCache.set(playerCacheKey, player);
      }
      playerIds.push(player.id);
    }

    // Get or create team
    const [existingTeam] = await pool.query(
      `SELECT t.*, CONCAT(p1.full_name, ' / ', p2.full_name) as team_name
       FROM teams t
       JOIN players p1 ON t.player1_id = p1.id
       JOIN players p2 ON t.player2_id = p2.id
       WHERE t.category_id = ?
         AND ((t.player1_id = ? AND t.player2_id = ?) OR (t.player1_id = ? AND t.player2_id = ?))`,
      [categoryId, playerIds[0], playerIds[1], playerIds[1], playerIds[0]]
    );

    let team;
    if (existingTeam.length) {
      team = existingTeam[0];
    } else {
      const uuid = uuidv4();
      const [result] = await pool.query(
        `INSERT INTO teams (uuid, player1_id, player2_id, category_id)
         OUTPUT INSERTED.id
         VALUES (?, ?, ?, ?)`,
        [uuid, playerIds[0], playerIds[1], categoryId]
      );

      const insertedId = result[0]?.id;
      const [newTeam] = await pool.query(`
        SELECT t.*, CONCAT(p1.full_name, ' / ', p2.full_name) as team_name
        FROM teams t
        JOIN players p1 ON t.player1_id = p1.id
        JOIN players p2 ON t.player2_id = p2.id
        WHERE t.id = ?
      `, [insertedId]);
      team = newTeam[0];
    }

    teamCache.set(cacheKey, team);
    return team;
  }

  /**
   * Create match
   */
  static async createMatch(data) {
    const uuid = uuidv4();
    const parsed = Match.parseResult(data.result);

    const [result] = await pool.query(
      `INSERT INTO matches (uuid, tournament_id, tournament_category_id, match_number, round, round_order,
                           court, scheduled_date, scheduled_time, team1_id, team2_id,
                           winner_team_id, result, status,
                           set1_team1, set1_team2, set2_team1, set2_team2, set3_team1, set3_team2)
       OUTPUT INSERTED.id
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuid, data.tournamentId, data.tournamentCategoryId, data.matchNumber,
        data.round, data.roundOrder, data.court, data.scheduledDate, data.scheduledTime,
        data.team1Id, data.team2Id, data.winnerTeamId, data.result, data.status,
        parsed.sets[0]?.score1 || null, parsed.sets[0]?.score2 || null,
        parsed.sets[1]?.score1 || null, parsed.sets[1]?.score2 || null,
        parsed.sets[2]?.score1 || null, parsed.sets[2]?.score2 || null
      ]
    );

    const insertedId = result[0]?.id;
    return { id: insertedId, ...data };
  }

  /**
   * Normalize team name for comparison
   */
  static normalizeTeamName(name) {
    return name?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() || '';
  }
}

module.exports = CSVImportService;
