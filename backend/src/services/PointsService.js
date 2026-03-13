const { pool } = require('../config/database');

class PointsService {
  // In-memory cache for points table
  static pointsCache = null;
  static pointsCacheExpiry = null;
  static CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Load points table into memory cache
   */
  static async loadPointsCache() {
    if (this.pointsCache && this.pointsCacheExpiry && Date.now() < this.pointsCacheExpiry) {
      return this.pointsCache;
    }

    const [rows] = await pool.query(`SELECT season, tier, level, classification_id, points FROM points_table`);

    // Build lookup map: season_tier_level_classId -> points
    this.pointsCache = new Map();
    for (const row of rows) {
      const key = `${row.season}_${row.tier}_${row.level}_${row.classification_id}`;
      this.pointsCache.set(key, row.points);
    }

    this.pointsCacheExpiry = Date.now() + this.CACHE_DURATION_MS;
    console.log(`Loaded ${rows.length} points entries into cache`);
    return this.pointsCache;
  }

  /**
   * Clear the points cache (call after updating points_table)
   */
  static clearCache() {
    this.pointsCache = null;
    this.pointsCacheExpiry = null;
  }

  /**
   * Tournament format definitions based on team count and level
   * From N1.csv and N2.csv
   */
  static FORMATS = {
    // Level 1 formats
    1: {
      8: 'elimination',      // 8+ teams: direct elimination
      7: '1g3_1g4_final',    // 7 teams: 1 group of 3 + 1 group of 4 + final
      6: '2g3_final',        // 6 teams: 2 groups of 3 + final
      5: '1g5',              // 5 teams: 1 group of 5
      4: '1g4',              // 4 teams: 1 group of 4
      3: '1g3'               // 3 teams: 1 group of 3
    },
    // Level 2 formats
    2: {
      9: 'elimination',      // 9+ teams: direct elimination
      8: '2g4_final',        // 8 teams: 2 groups of 4 + final
      7: '1g3_1g4_final',    // 7 teams: 1 group of 3 + 1 group of 4 + final
      6: '2g3_final',        // 6 teams: 2 groups of 3 + final
      5: '1g5',              // 5 teams: 1 group of 5
      4: '1g4',              // 4 teams: 1 group of 4
      3: '1g3'               // 3 teams: 1 group of 3
    }
  };

  /**
   * Get tournament format based on team count and level
   * @param {number} teamCount - Number of teams in the category
   * @param {number} level - Category level (1 or 2)
   * @returns {string} Format identifier
   */
  static getTournamentFormat(teamCount, level) {
    const formatMap = this.FORMATS[level] || this.FORMATS[1];

    if (level === 1) {
      if (teamCount >= 8) return 'elimination';
    } else {
      if (teamCount >= 9) return 'elimination';
    }

    return formatMap[teamCount] || 'elimination';
  }

  /**
   * Detect tournament format from actual match rounds
   * This overrides the team-count based format if we have actual match data
   * @param {Array} matches - Array of match objects
   * @returns {string|null} Detected format or null if can't determine
   */
  static detectFormatFromMatches(matches) {
    if (!matches || matches.length === 0) return null;

    let hasGroupStage = false;
    let hasFinal = false;
    let hasElimination = false;
    const groupNames = new Set();

    for (const match of matches) {
      if (!match.round) continue;
      const round = match.round.toLowerCase();

      if (round.includes('fase de grupos') || round.includes('grupo')) {
        hasGroupStage = true;
        // Extract group name
        const groupMatch = match.round.match(/G(\d+)/i);
        if (groupMatch) groupNames.add(groupMatch[1]);
      }

      if (round.includes('final') && !round.includes('semifinal') && !round.includes('quartas')) {
        hasFinal = true;
      }

      if (round.includes('r16') || round.includes('r32') || round.includes('quartas')) {
        hasElimination = true;
      }
    }

    console.log(`  Format detection: groups=${hasGroupStage}, final=${hasFinal}, elimination=${hasElimination}, groupCount=${groupNames.size}`);

    if (hasGroupStage && hasFinal) {
      // Groups + Final format
      const groupCount = groupNames.size;
      if (groupCount === 1) return '1g5'; // Single group (approximate)
      if (groupCount === 2) return '2g3_final';
      if (groupCount === 3) return '3g_final'; // 3 groups + final (custom)
      if (groupCount === 4) return '4g_final'; // 4 groups + final (custom)
      return `${groupCount}g_final`;
    }

    if (hasGroupStage && !hasFinal && !hasElimination) {
      // Single group format
      return '1g5';
    }

    if (hasElimination) {
      return 'elimination';
    }

    return null; // Couldn't determine
  }

  /**
   * Get classification ID (1-6) based on format and result
   * @param {string} format - Tournament format
   * @param {string} result - Result code (V, F, SF, QF, R16, R32, 1G, 2G, 3G, PENULTIMO, ULTIMO)
   * @param {number} groupSize - Size of the group (for single group formats)
   * @returns {number} Classification ID (1-6)
   */
  static getClassificationId(format, result, groupSize = null) {
    // Direct elimination formats
    if (format === 'elimination') {
      switch (result) {
        case 'V': case 'Campeão': return 1;
        case 'F': case 'Final': return 2;
        case 'SF': case 'Semifinal': return 3;
        case 'QF': case 'Quartas de Final': return 4;
        case 'R16': return 5;
        case 'R32': return 6;
        default: return 6;
      }
    }

    // Group + Final formats - classification depends on number of groups
    // 4g_final: V=1, F=2, SF=3, PENULTIMO=4, ULTIMO=6
    // 3g_final: V=1, F=2, SF=3, 2ºG=4, PENULTIMO=5, ULTIMO=6
    // 2g_final: V=1, F=2, 2ºG=3, PENULTIMO=4, ULTIMO=6
    if (format.endsWith('_final')) {
      switch (result) {
        case 'V': case 'Campeão': return 1;
        case 'F': case 'Final': return 2;
        case 'FINALISTA': return 2;  // Temporary - will be updated by playoff results
        case 'SF': case 'Semifinal': return 3;
        case '2ºG': case '2G': case 'Grupo 2º': return 4;  // 2nd in group (didn't advance)
        case '3ºG': case '3G': case 'Grupo 3º': return 5;
        case 'PENULTIMO': return 5;  // Default, may be overridden in processGroups
        case 'ULTIMO': return 6;
        default: return 6;
      }
    }

    // Single group formats (1g3, 1g4, 1g5) - no playoffs
    if (format.startsWith('1g')) {
      switch (result) {
        case '1G': case 'Grupo 1º': return 1;
        case '2G': case 'Grupo 2º': return 2;
        case '3G': case 'Grupo 3º': return 3;
        case 'PENULTIMO':
          // Penultimate position varies by group size
          if (format === '1g3') return 2;  // In group of 3, penultimate = 2nd
          if (format === '1g4') return 3;  // In group of 4, penultimate = 3rd
          if (format === '1g5') return 4;  // In group of 5, penultimate = 4th
          return 4;
        case 'ULTIMO': return 6;
        default: return 6;
      }
    }

    return 6; // Default to worst classification
  }

  /**
   * Map group position to result code
   * @param {number} position - Position in group (1, 2, 3, 4, 5...)
   * @param {number} groupSize - Total teams in group
   * @param {string} format - Tournament format
   * @returns {string} Result code for classification lookup
   */
  static getResultFromGroupPosition(position, groupSize, format) {
    // For formats with playoffs (semifinals/finals)
    if (format.endsWith('_final')) {
      // 1st in each group goes to playoffs (semi or final)
      // Use FINALISTA as temporary - will be updated based on playoff results
      if (position === 1) return 'FINALISTA';
      if (position === 2) return '2G';
      if (position === 3) return '3G';
      if (position === groupSize) return 'ULTIMO';
      return `${position}G`;  // Middle positions
    }

    // For single group formats (no playoffs)
    if (position === 1) return '1G';
    if (position === 2) return '2G';
    if (position === 3) return '3G';
    if (position === groupSize) return 'ULTIMO';
    return `${position}G`;
  }

  /**
   * Get points for a specific season, tier, level and classification ID
   * Uses in-memory cache for fast lookups
   * @param {number} season - Tournament season/year (e.g., 2025, 2026)
   * @param {string} tier - Tournament tier (OURO, PRATA, BRONZE)
   * @param {number} level - Category level (1, 2, or 3 for 2026+)
   * @param {number} classificationId - Classification ID (1-6)
   * @returns {number} Points
   */
  static async getPointsByClassification(season, tier, level, classificationId) {
    await this.loadPointsCache();

    const key = `${season}_${tier}_${level}_${classificationId}`;
    const points = this.pointsCache.get(key) || 0;
    return points;
  }

  /**
   * Get all points for a tier (optionally filtered by level)
   */
  static async getPointsTable(tier = null, level = null) {
    let query = `SELECT * FROM points_table`;
    const params = [];
    const conditions = [];

    if (tier) {
      conditions.push(`tier = ?`);
      params.push(tier);
    }

    if (level) {
      conditions.push(`level = ?`);
      params.push(level);
    }

    if (conditions.length > 0) {
      query += ` WHERE ` + conditions.join(' AND ');
    }

    query += ` ORDER BY tier, level, classification_id`;

    const [rows] = await pool.query(query, params);
    return rows;
  }

  /**
   * Calculate group stage standings with tiebreakers
   * Returns teams sorted by: wins, head-to-head, set diff, game diff
   * @param {number} tournamentId
   * @param {number} tournamentCategoryId
   * @param {string} groupName - e.g., "A", "B", etc.
   */
  static async calculateGroupStandings(tournamentId, tournamentCategoryId, groupName) {
    // Get all group stage matches for this group
    const [matches] = await pool.query(`
      SELECT m.*
      FROM matches m
      WHERE m.tournament_id = ?
        AND m.tournament_category_id = ?
        AND m.round LIKE ?
        AND m.status IN ('completed', 'walkover')
        AND m.winner_team_id IS NOT NULL
    `, [tournamentId, tournamentCategoryId, `%${groupName}%`]);

    // Build team stats
    const teamStats = new Map(); // teamId -> stats

    for (const match of matches) {
      const team1Id = match.team1_id;
      const team2Id = match.team2_id;
      const winnerId = match.winner_team_id;

      // Initialize team stats if not exists
      if (!teamStats.has(team1Id)) {
        teamStats.set(team1Id, {
          teamId: team1Id,
          wins: 0, losses: 0,
          setsWon: 0, setsLost: 0,
          gamesWon: 0, gamesLost: 0,
          headToHead: new Map()
        });
      }
      if (!teamStats.has(team2Id)) {
        teamStats.set(team2Id, {
          teamId: team2Id,
          wins: 0, losses: 0,
          setsWon: 0, setsLost: 0,
          gamesWon: 0, gamesLost: 0,
          headToHead: new Map()
        });
      }

      const team1Stats = teamStats.get(team1Id);
      const team2Stats = teamStats.get(team2Id);

      // Track wins/losses
      if (winnerId === team1Id) {
        team1Stats.wins++;
        team2Stats.losses++;
        team1Stats.headToHead.set(team2Id, 1);
        team2Stats.headToHead.set(team1Id, -1);
      } else {
        team2Stats.wins++;
        team1Stats.losses++;
        team2Stats.headToHead.set(team1Id, 1);
        team1Stats.headToHead.set(team2Id, -1);
      }

      // Calculate sets and games from match scores
      const sets = [
        { t1: match.set1_team1, t2: match.set1_team2 },
        { t1: match.set2_team1, t2: match.set2_team2 },
        { t1: match.set3_team1, t2: match.set3_team2 }
      ];

      for (const set of sets) {
        if (set.t1 !== null && set.t2 !== null) {
          // Games
          team1Stats.gamesWon += set.t1;
          team1Stats.gamesLost += set.t2;
          team2Stats.gamesWon += set.t2;
          team2Stats.gamesLost += set.t1;

          // Sets
          if (set.t1 > set.t2) {
            team1Stats.setsWon++;
            team2Stats.setsLost++;
          } else if (set.t2 > set.t1) {
            team2Stats.setsWon++;
            team1Stats.setsLost++;
          }
        }
      }
    }

    // Convert to array and sort with tiebreakers
    const standings = Array.from(teamStats.values());

    standings.sort((a, b) => {
      // 1. Wins (descending)
      if (b.wins !== a.wins) return b.wins - a.wins;

      // 2. Head-to-head
      const h2h = a.headToHead.get(b.teamId);
      if (h2h !== undefined) {
        if (h2h === 1) return -1; // a beat b
        if (h2h === -1) return 1; // b beat a
      }

      // 3. Set difference (descending)
      const aSetDiff = a.setsWon - a.setsLost;
      const bSetDiff = b.setsWon - b.setsLost;
      if (bSetDiff !== aSetDiff) return bSetDiff - aSetDiff;

      // 4. Game difference (descending)
      const aGameDiff = a.gamesWon - a.gamesLost;
      const bGameDiff = b.gamesWon - b.gamesLost;
      if (bGameDiff !== aGameDiff) return bGameDiff - aGameDiff;

      // 5. Total games won (descending)
      return b.gamesWon - a.gamesWon;
    });

    // Add position to each team
    standings.forEach((team, index) => {
      team.position = index + 1;
      team.setDiff = team.setsWon - team.setsLost;
      team.gameDiff = team.gamesWon - team.gamesLost;
    });

    return standings;
  }

  /**
   * Get all groups for a tournament category
   */
  static async getGroupNames(tournamentId, tournamentCategoryId) {
    const [rows] = await pool.query(`
      SELECT DISTINCT group_name
      FROM tournament_registrations
      WHERE tournament_id = ?
        AND tournament_category_id = ?
        AND group_name IS NOT NULL
      ORDER BY group_name
    `, [tournamentId, tournamentCategoryId]);

    return rows.map(r => r.group_name);
  }

  /**
   * Count teams in a tournament category
   */
  static async getTeamCount(tournamentId, tournamentCategoryId) {
    const [rows] = await pool.query(`
      SELECT COUNT(*) as count
      FROM tournament_registrations
      WHERE tournament_id = ?
        AND tournament_category_id = ?
    `, [tournamentId, tournamentCategoryId]);

    return rows[0]?.count || 0;
  }

  /**
   * Award points to all teams after tournament completion
   * Optimized: loads all data into memory first, then processes
   */
  static async awardTournamentPoints(tournamentId) {
    try {
      console.log('\n========================================');
      console.log(`AWARD TOURNAMENT POINTS - Tournament ID: ${tournamentId}`);
      console.log('========================================\n');
      console.time('awardTournamentPoints');

      // Pre-load points cache
      await this.loadPointsCache();
      console.log(`Points cache loaded: ${this.pointsCache?.size || 0} entries`);

      // Load ALL tournament data in a single query batch
      const tournamentData = await this.loadTournamentData(tournamentId);

      if (!tournamentData.tournament) {
        console.error('ERROR: Tournament not found in database');
        throw new Error('Tournament not found');
      }

      const { tier, season } = tournamentData.tournament;
      console.log(`Tournament: tier=${tier}, season=${season}`);
      console.log(`Categories: ${tournamentData.categories.length}`);
      console.log(`Matches loaded: ${tournamentData.matches.length}`);
      console.log(`Registrations loaded: ${tournamentData.registrations.length}`);

      const teamResults = new Map();

      for (const category of tournamentData.categories) {
        const { tournamentCategoryId, categoryId, level, teamCount } = category;

        // Get matches for this category from pre-loaded data
        const categoryMatches = tournamentData.matches.filter(m => m.tournament_category_id === tournamentCategoryId);
        const categoryRegistrations = tournamentData.registrations.filter(r => r.tournament_category_id === tournamentCategoryId);

        console.log(`\n--- Processing Category ---`);
        console.log(`  Category ID: ${categoryId}, Tournament Category ID: ${tournamentCategoryId}`);
        console.log(`  Teams: ${teamCount}, Level: ${level}, Season: ${season}`);
        console.log(`  Matches for this category: ${categoryMatches.length}`);
        console.log(`  Registrations for this category: ${categoryRegistrations.length}`);

        if (categoryMatches.length === 0) {
          console.log(`  WARNING: No completed matches found for this category!`);
          continue;
        }

        // Detect format from actual match data, fallback to team-count based
        let format = this.detectFormatFromMatches(categoryMatches);
        if (!format) {
          format = this.getTournamentFormat(teamCount, level);
          console.log(`  Format (from team count): ${format}`);
        } else {
          console.log(`  Format (detected from matches): ${format}`);
        }

        // Process based on format
        if (format === 'elimination') {
          console.log(`  Processing as ELIMINATION format`);
          await this.processEliminationMatchesOptimized(categoryMatches, season, tier, level, categoryId, teamResults);
        } else if (format.endsWith('_final')) {
          console.log(`  Processing as GROUP+FINAL format`);
          await this.processGroupsWithFinalOptimized(categoryMatches, categoryRegistrations, season, tier, level, categoryId, format, teamResults);
        } else if (format.startsWith('1g')) {
          console.log(`  Processing as SINGLE GROUP format`);
          await this.processSingleGroupOptimized(categoryMatches, categoryRegistrations, season, tier, level, categoryId, format, teamResults);
        } else {
          // Default: treat as groups with final
          console.log(`  Processing as GROUP+FINAL format (custom: ${format})`);
          await this.processGroupsWithFinalOptimized(categoryMatches, categoryRegistrations, season, tier, level, categoryId, format, teamResults);
        }

        console.log(`  Teams processed so far: ${teamResults.size}`);
      }

      console.log(`\nTotal teams with results: ${teamResults.size}`);

      // Update registrations and player results
      await this.saveResults(tournamentId, teamResults);

      console.timeEnd('awardTournamentPoints');
      console.log('\n========================================');
      console.log(`AWARD COMPLETE: ${teamResults.size} teams processed`);
      console.log('========================================\n');

      return {
        teamsProcessed: teamResults.size,
        results: Array.from(teamResults.entries()).map(([teamId, result]) => ({
          teamId,
          ...result
        }))
      };
    } catch (error) {
      console.error('ERROR in awardTournamentPoints:', error);
      throw error;
    }
  }

  /**
   * Load all tournament data in bulk queries
   */
  static async loadTournamentData(tournamentId) {
    // Single batch of queries
    const [tournaments, categories, matches, registrations] = await Promise.all([
      pool.query(`SELECT tier, year FROM tournaments WHERE id = ?`, [tournamentId]),
      pool.query(`
        SELECT tc.id as tournament_category_id, c.id as category_id, c.level as category_level,
               (SELECT COUNT(*) FROM tournament_registrations tr WHERE tr.tournament_category_id = tc.id) as team_count
        FROM tournament_categories tc
        JOIN categories c ON tc.category_id = c.id
        WHERE tc.tournament_id = ?
      `, [tournamentId]),
      pool.query(`
        SELECT m.*
        FROM matches m
        WHERE m.tournament_id = ?
          AND m.status IN ('completed', 'walkover')
          AND m.winner_team_id IS NOT NULL
        ORDER BY m.tournament_category_id, m.round_order ASC
      `, [tournamentId]),
      pool.query(`
        SELECT tr.*, t.player1_id, t.player2_id, t.category_id as team_category_id
        FROM tournament_registrations tr
        JOIN teams t ON tr.team_id = t.id
        WHERE tr.tournament_id = ?
      `, [tournamentId])
    ]);

    return {
      tournament: tournaments[0].length ? { tier: tournaments[0][0].tier, season: tournaments[0][0].year } : null,
      categories: categories[0].map(c => ({
        tournamentCategoryId: c.tournament_category_id,
        categoryId: c.category_id,
        level: c.category_level,
        teamCount: c.team_count
      })),
      matches: matches[0],
      registrations: registrations[0]
    };
  }

  /**
   * Process elimination matches - OPTIMIZED (uses pre-loaded data)
   * Two-pass approach for reliability:
   * 1. First pass: count all wins/losses and track elimination round for each team
   * 2. Second pass: assign classifications based on elimination round AND total wins
   */
  static async processEliminationMatchesOptimized(matches, season, tier, level, categoryId, teamResults) {
    // Track elimination info for each team: { wins, losses, eliminationRound, isFinalWinner }
    const teamData = new Map();

    console.log(`  === PASS 1: Processing ${matches.length} matches ===`);

    // PASS 1: Count all wins/losses and track when each team was eliminated
    for (const match of matches) {
      const winnerId = match.winner_team_id;
      const loserId = match.team1_id === winnerId ? match.team2_id : match.team1_id;
      const round = match.round || '';
      const roundLower = round.toLowerCase();

      console.log(`    Match: round=${round}, team1=${match.team1_id}, team2=${match.team2_id}, winner=${winnerId}, loser=${loserId}`);

      // Initialize team data
      if (!teamData.has(winnerId)) {
        teamData.set(winnerId, { wins: 0, losses: 0, eliminationRound: null, isFinalWinner: false });
      }
      if (!teamData.has(loserId)) {
        teamData.set(loserId, { wins: 0, losses: 0, eliminationRound: null, isFinalWinner: false });
      }

      // Count wins/losses
      teamData.get(winnerId).wins++;
      teamData.get(loserId).losses++;

      // Track when team was eliminated (only first elimination matters)
      if (!teamData.get(loserId).eliminationRound) {
        teamData.get(loserId).eliminationRound = round;
      }

      // Check if this is THE final
      const isFinal = (roundLower === 'final') ||
                      (roundLower.includes('final') && !roundLower.includes('semi') && !roundLower.includes('quartas'));

      if (isFinal) {
        teamData.get(winnerId).isFinalWinner = true;
        teamData.get(loserId).eliminationRound = 'Final';
      }
    }

    console.log(`  Pass 1 complete: ${teamData.size} teams found`);
    // Debug: show all team states after Pass 1
    for (const [teamId, data] of teamData) {
      console.log(`    Team ${teamId}: wins=${data.wins}, losses=${data.losses}, eliminationRound=${data.eliminationRound}, isFinalWinner=${data.isFinalWinner}`);
    }

    // PASS 2: Assign classifications based on elimination round AND wins
    for (const [teamId, data] of teamData) {
      let classId;
      let result;

      if (data.isFinalWinner) {
        // Tournament winner
        classId = 1;
        result = 'Campeão';
      } else if (data.eliminationRound) {
        // Eliminated team: check if they have 0 wins
        if (data.wins === 0) {
          classId = 6;
          result = '1ª Derrota';
        } else {
          // Use round-based classification
          classId = this.getClassificationId('elimination', data.eliminationRound);
          result = data.eliminationRound;
        }
      } else {
        // Should not happen, but default to ID 6
        classId = 6;
        result = 'Desconhecido';
      }

      teamResults.set(teamId, {
        wins: data.wins,
        losses: data.losses,
        categoryId,
        level,
        classificationId: classId,
        points: await this.getPointsByClassification(season, tier, level, classId),
        result
      });

      console.log(`  Team ${teamId}: wins=${data.wins}, round=${data.eliminationRound || 'WINNER'}, classId=${classId}`);
    }
  }

  /**
   * Process groups with final - OPTIMIZED (uses pre-loaded data)
   * Handles: 2 groups (direct final), 3 groups (best 2nd to SF), 4 groups (all 1sts to SF)
   */
  static async processGroupsWithFinalOptimized(matches, registrations, season, tier, level, categoryId, format, teamResults) {
    // Extract group names from match rounds
    const groupNamesFromMatches = this.extractGroupNamesFromMatches(matches);
    const groupNamesFromRegs = [...new Set(registrations.filter(r => r.group_name).map(r => r.group_name))];
    const groupNames = [...new Set([...groupNamesFromMatches, ...groupNamesFromRegs])];

    const numGroups = groupNames.length;
    console.log(`  Groups found: ${numGroups > 0 ? groupNames.join(', ') : 'NONE'} (${numGroups} groups)`);

    // Collect all group standings and 2nd place teams
    const allGroupStandings = [];
    const secondPlaceTeams = [];

    if (numGroups === 0) {
      console.log(`  WARNING: No groups found! Processing all non-final matches as single group`);
      const groupMatches = matches.filter(m => m.round && !m.round.toLowerCase().includes('final'));
      if (groupMatches.length > 0) {
        const standings = this.calculateGroupStandingsFromMatches(groupMatches);
        allGroupStandings.push({ groupName: 'default', standings });
      }
    } else {
      for (const groupName of groupNames) {
        const groupMatches = matches.filter(m => {
          if (!m.round) return false;
          const roundLower = m.round.toLowerCase();
          if (roundLower.includes('final') || roundLower.includes('semifinal')) return false;
          const groupId = groupName.substring(1);
          return m.round.includes(`G${groupId}`) || m.round.includes(`Grupo ${groupId}`);
        });
        console.log(`  Group ${groupName}: ${groupMatches.length} matches`);
        const standings = this.calculateGroupStandingsFromMatches(groupMatches);
        allGroupStandings.push({ groupName, standings });

        // Collect 2nd place team for "best 2nd" logic
        const secondPlace = standings.find(t => t.position === 2);
        if (secondPlace) {
          secondPlaceTeams.push({ ...secondPlace, groupName });
        }
      }
    }

    // Determine best 2nd place if we have 3 groups (9-11 teams scenario)
    let best2ndTeamId = null;
    if (numGroups === 3 && secondPlaceTeams.length >= 2) {
      // Sort 2nd place teams by tiebreaker criteria
      secondPlaceTeams.sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        const aSetDiff = a.setsWon - a.setsLost;
        const bSetDiff = b.setsWon - b.setsLost;
        if (bSetDiff !== aSetDiff) return bSetDiff - aSetDiff;
        const aGameDiff = a.gamesWon - a.gamesLost;
        const bGameDiff = b.gamesWon - b.gamesLost;
        if (bGameDiff !== aGameDiff) return bGameDiff - aGameDiff;
        return b.gamesWon - a.gamesWon;
      });
      best2ndTeamId = secondPlaceTeams[0].teamId;
      console.log(`  Best 2nd place: team ${best2ndTeamId} from group ${secondPlaceTeams[0].groupName}`);
    }

    // Determine classification based on number of groups and group size
    // 4 groups of 3: 1sts → SF, 2nds = PENULTIMO (ID=4), 3rds = ULTIMO (ID=6)
    // 3 groups (mixed): 1sts + best 2nd → SF
    //   - For G4 (4 teams): 3rd = 2ºG (ID=4), 4th = ULTIMO (ID=6)
    //   - For G3 (3 teams): 2nd (non-advancing) = PENULTIMO (ID=5), 3rd = ULTIMO (ID=6)
    // 2 groups: 1sts → Final, 2nds = 2ºG (ID=3), etc.
    const getClassForPosition = (position, groupSize, isBest2nd = false) => {
      if (position === 1) return { result: 'FINALISTA', classId: 2 }; // Will be updated by playoff results

      if (numGroups === 3) {
        if (position === 2) {
          if (isBest2nd) return { result: 'FINALISTA', classId: 2 }; // Best 2nd goes to SF
          // Non-advancing 2nd: in G4 this is 2ºG, in G3 this is PENULTIMO
          if (groupSize === 4) {
            return { result: '2ºG', classId: 4 }; // 2nd in G4 that doesn't advance
          }
          return { result: 'PENULTIMO', classId: 5 }; // 2nd in G3 that doesn't advance
        }
        // In G4 (4 teams): 3rd = PENULTIMO, 4th = ULTIMO
        if (groupSize === 4) {
          if (position === 3) return { result: 'PENULTIMO', classId: 5 };
          if (position === 4) return { result: 'ULTIMO', classId: 6 };
        }
        // In G3 (3 teams): 3rd = ULTIMO
        if (position === groupSize) return { result: 'ULTIMO', classId: 6 };
        return { result: 'PENULTIMO', classId: 5 };
      }

      if (numGroups === 4) {
        // With 4 groups of 3, 2nd place = PENULTIMO
        if (position === 2) return { result: 'PENULTIMO', classId: 4 };
        if (position === groupSize) return { result: 'ULTIMO', classId: 6 };
        return { result: `${position}ºG`, classId: 4 };
      }

      // 2 groups or default
      if (position === 2) return { result: '2ºG', classId: 3 };
      if (position === groupSize - 1) return { result: 'PENULTIMO', classId: 4 };
      if (position === groupSize) return { result: 'ULTIMO', classId: 6 };
      return { result: `${position}ºG`, classId: 4 };
    };

    // Process all group standings
    for (const { groupName, standings } of allGroupStandings) {
      const groupSize = standings.length;
      for (const team of standings) {
        const isBest2nd = team.position === 2 && team.teamId === best2ndTeamId;
        const { result, classId } = getClassForPosition(team.position, groupSize, isBest2nd);

        if (!teamResults.has(team.teamId)) {
          teamResults.set(team.teamId, {
            wins: team.wins, losses: team.losses, categoryId, level,
            classificationId: classId, points: 0, groupPosition: team.position
          });
        } else {
          teamResults.get(team.teamId).wins = team.wins;
          teamResults.get(team.teamId).losses = team.losses;
          teamResults.get(team.teamId).groupPosition = team.position;
          teamResults.get(team.teamId).classificationId = classId;
        }

        teamResults.get(team.teamId).points = await this.getPointsByClassification(season, tier, level, classId);
        teamResults.get(team.teamId).result = result === 'FINALISTA' ? 'Finalista' : `Grupo ${team.position}º`;

        console.log(`  Team ${team.teamId}: group ${groupName}, pos=${team.position}, classId=${classId}, result=${result}${isBest2nd ? ' (BEST 2ND)' : ''}`);
      }
    }

    // Process semifinals first (losers get classification 3)
    const semifinalMatches = matches.filter(m => {
      if (!m.round) return false;
      const roundLower = m.round.toLowerCase();
      return roundLower.includes('semifinal') || roundLower === 'sf';
    });
    console.log(`  Semifinal matches found: ${semifinalMatches.length}`);

    for (const match of semifinalMatches) {
      const winnerId = match.winner_team_id;
      const loserId = match.team1_id === winnerId ? match.team2_id : match.team1_id;

      // Semifinal losers get classification 3
      if (teamResults.has(loserId)) {
        teamResults.get(loserId).classificationId = 3;
        teamResults.get(loserId).points = await this.getPointsByClassification(season, tier, level, 3);
        teamResults.get(loserId).result = 'Semifinal';
        console.log(`  Semifinal loser: team ${loserId} -> classificationId=3`);
      }
      // Semifinal winners go to final (will be updated below)
      if (teamResults.has(winnerId)) {
        teamResults.get(winnerId).classificationId = 2; // Temporary, will be updated if they win final
        teamResults.get(winnerId).result = 'Finalista';
      }
    }

    // Process finals (winner = 1, loser = 2)
    const finalMatches = matches.filter(m => {
      if (!m.round) return false;
      const roundLower = m.round.toLowerCase();
      // Match "Final" but not "Semifinal" or "Quartas de Final"
      return roundLower === 'final' || (roundLower.includes('final') && !roundLower.includes('semi') && !roundLower.includes('quartas'));
    });
    console.log(`  Final matches found: ${finalMatches.length}`);

    for (const match of finalMatches) {
      const winnerId = match.winner_team_id;
      const loserId = match.team1_id === winnerId ? match.team2_id : match.team1_id;

      if (teamResults.has(winnerId)) {
        teamResults.get(winnerId).classificationId = 1;
        teamResults.get(winnerId).points = await this.getPointsByClassification(season, tier, level, 1);
        teamResults.get(winnerId).result = 'Campeão';
        console.log(`  Winner: team ${winnerId} -> classificationId=1`);
      }
      if (teamResults.has(loserId)) {
        teamResults.get(loserId).classificationId = 2;
        teamResults.get(loserId).points = await this.getPointsByClassification(season, tier, level, 2);
        teamResults.get(loserId).result = 'Final';
        console.log(`  Finalist: team ${loserId} -> classificationId=2`);
      }
    }
  }

  /**
   * Extract group names from match round strings
   * e.g., "Fase de grupos - G1" -> "G1", "Grupo A - Jogo 1" -> "Grupo A"
   */
  static extractGroupNamesFromMatches(matches) {
    const groupNames = new Set();
    const groupPatterns = [
      /Fase de grupos\s*-\s*G(\d+)/i,  // "Fase de grupos - G1", "Fase de grupos - G2"
      /Grupo\s+([A-Z\d]+)/i,           // "Grupo A", "Grupo B", "Grupo 1"
      /Group\s+([A-Z\d]+)/i,           // "Group A", "Group B"
      /\bG([A-Z\d]+)\b/i,              // "G1", "GA", "GB"
    ];

    for (const match of matches) {
      if (!match.round) continue;

      // Skip finals/semifinals - not group matches
      const roundLower = match.round.toLowerCase();
      if (roundLower.includes('final') || roundLower.includes('semifinal') ||
          roundLower.includes('quartas') || roundLower.startsWith('r16') ||
          roundLower.startsWith('r32')) {
        continue;
      }

      for (const pattern of groupPatterns) {
        const found = match.round.match(pattern);
        if (found) {
          // Normalize to "G1", "G2" or "Grupo A" format
          const groupId = found[1].toUpperCase();
          groupNames.add(`G${groupId}`);
          break;
        }
      }
    }

    console.log(`  extractGroupNamesFromMatches: found groups from rounds: ${Array.from(groupNames).join(', ') || 'none'}`);
    return Array.from(groupNames);
  }

  /**
   * Process single group - OPTIMIZED (uses pre-loaded data)
   */
  static async processSingleGroupOptimized(matches, registrations, season, tier, level, categoryId, format, teamResults) {
    console.log(`  Processing single group with ${matches.length} matches`);

    if (matches.length === 0) {
      console.log(`  WARNING: No matches to process for single group format`);
      return;
    }

    const standings = this.calculateGroupStandingsFromMatches(matches);
    console.log(`  Calculated standings for ${standings.length} teams`);

    for (const team of standings) {
      const result = this.getResultFromGroupPosition(team.position, standings.length, format);
      const classId = this.getClassificationId(format, result, standings.length);

      teamResults.set(team.teamId, {
        wins: team.wins, losses: team.losses, categoryId, level,
        classificationId: classId,
        points: await this.getPointsByClassification(season, tier, level, classId),
        groupPosition: team.position,
        result: `Grupo ${team.position}º`
      });

      console.log(`  Team ${team.teamId}: position=${team.position}, classificationId=${classId}, wins=${team.wins}, losses=${team.losses}`);
    }
  }

  /**
   * Calculate group standings from pre-loaded matches (no DB query)
   */
  static calculateGroupStandingsFromMatches(matches) {
    const teamStats = new Map();

    for (const match of matches) {
      const team1Id = match.team1_id;
      const team2Id = match.team2_id;
      const winnerId = match.winner_team_id;

      if (!teamStats.has(team1Id)) {
        teamStats.set(team1Id, {
          teamId: team1Id, wins: 0, losses: 0,
          setsWon: 0, setsLost: 0, gamesWon: 0, gamesLost: 0,
          headToHead: new Map()
        });
      }
      if (!teamStats.has(team2Id)) {
        teamStats.set(team2Id, {
          teamId: team2Id, wins: 0, losses: 0,
          setsWon: 0, setsLost: 0, gamesWon: 0, gamesLost: 0,
          headToHead: new Map()
        });
      }

      const team1Stats = teamStats.get(team1Id);
      const team2Stats = teamStats.get(team2Id);

      if (winnerId === team1Id) {
        team1Stats.wins++;
        team2Stats.losses++;
        team1Stats.headToHead.set(team2Id, 1);
        team2Stats.headToHead.set(team1Id, -1);
      } else {
        team2Stats.wins++;
        team1Stats.losses++;
        team2Stats.headToHead.set(team1Id, 1);
        team1Stats.headToHead.set(team2Id, -1);
      }

      // Calculate sets and games (treat null as 0)
      const sets = [
        { t1: match.set1_team1, t2: match.set1_team2 },
        { t1: match.set2_team1, t2: match.set2_team2 },
        { t1: match.set3_team1, t2: match.set3_team2 }
      ];

      for (const set of sets) {
        // Skip only if BOTH values are null (no set played)
        if (set.t1 === null && set.t2 === null) continue;

        // Treat null as 0 for games calculation
        const t1Score = set.t1 ?? 0;
        const t2Score = set.t2 ?? 0;

        team1Stats.gamesWon += t1Score;
        team1Stats.gamesLost += t2Score;
        team2Stats.gamesWon += t2Score;
        team2Stats.gamesLost += t1Score;

        if (t1Score > t2Score) {
          team1Stats.setsWon++;
          team2Stats.setsLost++;
        } else if (t2Score > t1Score) {
          team2Stats.setsWon++;
          team1Stats.setsLost++;
        }
      }
    }

    // Sort with tiebreakers
    // Note: Set diff is used before h2h to handle 3-way circular ties correctly
    const standings = Array.from(teamStats.values());
    standings.sort((a, b) => {
      // 1. Wins (descending)
      if (b.wins !== a.wins) return b.wins - a.wins;

      // 2. Set difference (descending) - primary tiebreaker
      const aSetDiff = a.setsWon - a.setsLost;
      const bSetDiff = b.setsWon - b.setsLost;
      if (bSetDiff !== aSetDiff) return bSetDiff - aSetDiff;

      // 3. Head-to-head (only applies when set diff is equal)
      const h2h = a.headToHead.get(b.teamId);
      if (h2h === 1) return -1;
      if (h2h === -1) return 1;

      // 4. Game difference
      const aGameDiff = a.gamesWon - a.gamesLost;
      const bGameDiff = b.gamesWon - b.gamesLost;
      if (bGameDiff !== aGameDiff) return bGameDiff - aGameDiff;

      // 5. Games won
      return b.gamesWon - a.gamesWon;
    });

    standings.forEach((team, index) => { team.position = index + 1; });
    return standings;
  }

  /**
   * Process elimination format matches (LEGACY - kept for compatibility)
   * Uses two-pass approach for reliability
   */
  static async processEliminationMatches(tournamentId, tournamentCategoryId, season, tier, level, categoryId, teamResults) {
    const [matches] = await pool.query(`
      SELECT m.*
      FROM matches m
      WHERE m.tournament_id = ?
        AND m.tournament_category_id = ?
        AND m.status IN ('completed', 'walkover')
        AND m.winner_team_id IS NOT NULL
    `, [tournamentId, tournamentCategoryId]);

    // Use the optimized two-pass processing
    await this.processEliminationMatchesOptimized(matches, season, tier, level, categoryId, teamResults);
  }

  /**
   * Process groups with final format
   */
  static async processGroupsWithFinal(tournamentId, tournamentCategoryId, season, tier, level, categoryId, format, teamResults) {
    // First process group standings
    const groupNames = await this.getGroupNames(tournamentId, tournamentCategoryId);
    const groupTeamCount = format === '2g4_final' ? 4 : 3;

    for (const groupName of groupNames) {
      const standings = await this.calculateGroupStandings(tournamentId, tournamentCategoryId, groupName);

      for (const team of standings) {
        if (!teamResults.has(team.teamId)) {
          teamResults.set(team.teamId, {
            wins: team.wins,
            losses: team.losses,
            categoryId,
            level,
            classificationId: null,
            points: 0,
            groupPosition: team.position
          });
        } else {
          teamResults.get(team.teamId).wins = team.wins;
          teamResults.get(team.teamId).losses = team.losses;
          teamResults.get(team.teamId).groupPosition = team.position;
        }

        // Assign classification based on group position (will be updated for finalists)
        const result = this.getResultFromGroupPosition(team.position, groupTeamCount, format);
        const classId = this.getClassificationId(format, result, groupTeamCount);
        teamResults.get(team.teamId).classificationId = classId;
        teamResults.get(team.teamId).points = await this.getPointsByClassification(season, tier, level, classId);
        // Set result - finalists get special label
        teamResults.get(team.teamId).result = result === 'FINALISTA' ? 'Finalista' : `Grupo ${team.position}º`;
      }
    }

    // Process final match
    const [finalMatches] = await pool.query(`
      SELECT m.*
      FROM matches m
      WHERE m.tournament_id = ?
        AND m.tournament_category_id = ?
        AND m.round LIKE '%Final%'
        AND m.status IN ('completed', 'walkover')
        AND m.winner_team_id IS NOT NULL
    `, [tournamentId, tournamentCategoryId]);

    console.log(`Found ${finalMatches.length} final matches for tournament_category_id ${tournamentCategoryId}`);

    for (const match of finalMatches) {
      const winnerId = match.winner_team_id;
      const loserId = match.team1_id === winnerId ? match.team2_id : match.team1_id;

      if (teamResults.has(winnerId)) {
        teamResults.get(winnerId).classificationId = 1;
        teamResults.get(winnerId).points = await this.getPointsByClassification(season, tier, level, 1);
        teamResults.get(winnerId).result = 'Campeão';
      }
      if (teamResults.has(loserId)) {
        teamResults.get(loserId).classificationId = 2;
        teamResults.get(loserId).points = await this.getPointsByClassification(season, tier, level, 2);
        teamResults.get(loserId).result = 'Final';
      }
    }
  }

  /**
   * Process single group format
   */
  static async processSingleGroup(tournamentId, tournamentCategoryId, season, tier, level, categoryId, format, teamResults) {
    const groupSize = parseInt(format.slice(2)); // 1g3 -> 3, 1g4 -> 4, 1g5 -> 5
    const groupNames = await this.getGroupNames(tournamentId, tournamentCategoryId);

    // If no group names, try to get all matches
    if (groupNames.length === 0) {
      const [matches] = await pool.query(`
        SELECT DISTINCT team1_id, team2_id
        FROM matches
        WHERE tournament_id = ?
          AND tournament_category_id = ?
      `, [tournamentId, tournamentCategoryId]);

      const teamIds = new Set();
      for (const match of matches) {
        if (match.team1_id) teamIds.add(match.team1_id);
        if (match.team2_id) teamIds.add(match.team2_id);
      }

      // Calculate standings for default group
      const standings = await this.calculateGroupStandings(tournamentId, tournamentCategoryId, '');

      for (const team of standings) {
        const result = this.getResultFromGroupPosition(team.position, standings.length, format);
        const classId = this.getClassificationId(format, result, standings.length);

        teamResults.set(team.teamId, {
          wins: team.wins,
          losses: team.losses,
          categoryId,
          level,
          classificationId: classId,
          points: await this.getPointsByClassification(season, tier, level, classId),
          groupPosition: team.position,
          result: `Grupo ${team.position}º`
        });
      }
      return;
    }

    // Process each group
    for (const groupName of groupNames) {
      const standings = await this.calculateGroupStandings(tournamentId, tournamentCategoryId, groupName);

      for (const team of standings) {
        const result = this.getResultFromGroupPosition(team.position, standings.length, format);
        const classId = this.getClassificationId(format, result, standings.length);

        teamResults.set(team.teamId, {
          wins: team.wins,
          losses: team.losses,
          categoryId,
          level,
          classificationId: classId,
          points: await this.getPointsByClassification(season, tier, level, classId),
          groupPosition: team.position,
          result: `Grupo ${team.position}º`
        });
      }
    }
  }

  /**
   * Save results to database - OPTIMIZED with pre-loaded team data
   */
  static async saveResults(tournamentId, teamResults) {
    console.log(`\n=== saveResults START ===`);
    console.log(`Tournament ID: ${tournamentId}, Teams to process: ${teamResults.size}`);

    // Pre-load all team data and existing player results
    const teamIds = Array.from(teamResults.keys());
    if (teamIds.length === 0) {
      console.log('No teams to save, exiting');
      return;
    }

    // MSSQL needs individual placeholders for IN clause
    const teamPlaceholders = teamIds.map((_, i) => `?`).join(', ');
    const [teams] = await pool.query(
      `SELECT id, player1_id, player2_id, category_id FROM teams WHERE id IN (${teamPlaceholders})`,
      teamIds
    );
    const teamMap = new Map(teams.map(t => [t.id, t]));
    console.log(`Loaded ${teams.length} teams from DB`);

    const [existingResults] = await pool.query(
      `SELECT player_id, tournament_id, category_id FROM player_tournament_results WHERE tournament_id = ?`,
      [tournamentId]
    );
    const existingSet = new Set(existingResults.map(r => `${r.player_id}_${r.tournament_id}_${r.category_id}`));
    console.log(`Found ${existingResults.length} existing player_tournament_results`);

    // Process all updates
    const playerPointsToUpdate = new Set();
    const playerCategoryStats = new Map(); // playerId_categoryId -> { points, wins, losses, tournaments }

    for (const [teamId, result] of teamResults) {
      console.log(`Saving team ${teamId}: classification=${result.classificationId}, points=${result.points}, result=${result.result}`);

      // Update registration
      await pool.query(`
        UPDATE tournament_registrations
        SET points_earned = ?, final_position = ?,
            status = CASE WHEN ? = 1 THEN 'winner' ELSE 'eliminated' END
        WHERE tournament_id = ? AND team_id = ?
      `, [result.points, result.classificationId, result.classificationId, tournamentId, teamId]);

      const team = teamMap.get(teamId);
      if (!team) {
        console.log(`  Team ${teamId} not found in teamMap, skipping`);
        continue;
      }

      const { player1_id, player2_id, category_id } = team;
      console.log(`  Team ${teamId}: player1=${player1_id}, player2=${player2_id}, category=${category_id}`);

      for (const playerId of [player1_id, player2_id]) {
        const partnerId = playerId === player1_id ? player2_id : player1_id;
        const key = `${playerId}_${tournamentId}_${category_id}`;
        const finalRound = result.result || `ID-${result.classificationId}`;

        if (existingSet.has(key)) {
          await pool.query(`
            UPDATE player_tournament_results
            SET final_round = ?, final_position = ?, points_earned = ?, matches_won = ?, matches_lost = ?
            WHERE player_id = ? AND tournament_id = ? AND category_id = ?
          `, [finalRound, result.classificationId, result.points, result.wins, result.losses,
              playerId, tournamentId, category_id]);
          console.log(`  Updated player_tournament_results for player ${playerId}`);
        } else {
          await pool.query(`
            INSERT INTO player_tournament_results
              (player_id, tournament_id, category_id, team_id, partner_id, final_round, final_position, points_earned, matches_won, matches_lost)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [playerId, tournamentId, category_id, teamId, partnerId,
              finalRound, result.classificationId, result.points, result.wins, result.losses]);
          existingSet.add(key);
          console.log(`  Inserted player_tournament_results for player ${playerId}`);
        }
        playerPointsToUpdate.add(playerId);

        // Accumulate stats for player_rankings
        const playerCatKey = `${playerId}_${category_id}`;
        if (!playerCategoryStats.has(playerCatKey)) {
          playerCategoryStats.set(playerCatKey, { playerId, categoryId: category_id, points: 0, wins: 0, losses: 0, tournaments: 0 });
        }
        const stats = playerCategoryStats.get(playerCatKey);
        stats.points += result.points;
        stats.wins += result.wins;
        stats.losses += result.losses;
        stats.tournaments += 1;
      }
    }

    // Batch update all player total points
    if (playerPointsToUpdate.size > 0) {
      const playerIds = Array.from(playerPointsToUpdate);
      const playerPlaceholders = playerIds.map(() => `?`).join(', ');
      await pool.query(`
        UPDATE players SET total_points = (
          SELECT COALESCE(SUM(points_earned), 0)
          FROM player_tournament_results
          WHERE player_id = players.id
        ) WHERE id IN (${playerPlaceholders})
      `, playerIds);
      console.log(`Updated total_points for ${playerPointsToUpdate.size} players`);
    }

    // Update player_rankings table
    await this.updatePlayerRankings(playerCategoryStats);

    console.log(`=== saveResults END: ${teamResults.size} teams, ${playerPointsToUpdate.size} players ===\n`);
  }

  /**
   * Update player_rankings table with latest stats
   */
  static async updatePlayerRankings(playerCategoryStats) {
    console.log(`Updating player_rankings for ${playerCategoryStats.size} player-category combinations`);

    const today = new Date().toISOString().split('T')[0];

    for (const [key, stats] of playerCategoryStats) {
      const { playerId, categoryId, wins, losses } = stats;

      // Get player's total points for this category
      const [pointsResult] = await pool.query(`
        SELECT COALESCE(SUM(points_earned), 0) as total_points,
               COUNT(*) as tournaments_played,
               COALESCE(SUM(matches_won), 0) as total_wins,
               COALESCE(SUM(matches_lost), 0) as total_losses
        FROM player_tournament_results
        WHERE player_id = ? AND category_id = ?
      `, [playerId, categoryId]);

      const totalPoints = pointsResult[0]?.total_points || 0;
      const tournamentsPlayed = pointsResult[0]?.tournaments_played || 0;
      const totalWins = pointsResult[0]?.total_wins || 0;
      const totalLosses = pointsResult[0]?.total_losses || 0;

      // Check if ranking entry exists for today
      const [existing] = await pool.query(`
        SELECT id FROM player_rankings
        WHERE player_id = ? AND category_id = ? AND ranking_date = ?
      `, [playerId, categoryId, today]);

      if (existing.length > 0) {
        await pool.query(`
          UPDATE player_rankings
          SET total_points = ?, tournaments_played = ?, wins = ?, losses = ?
          WHERE id = ?
        `, [totalPoints, tournamentsPlayed, totalWins, totalLosses, existing[0].id]);
      } else {
        // Insert new ranking entry (ranking will be calculated separately)
        await pool.query(`
          INSERT INTO player_rankings (player_id, category_id, ranking, total_points, tournaments_played, wins, losses, ranking_date)
          VALUES (?, ?, 0, ?, ?, ?, ?, ?)
        `, [playerId, categoryId, totalPoints, tournamentsPlayed, totalWins, totalLosses, today]);
      }
    }

    // Recalculate rankings (position based on points)
    await this.recalculateRankings(today);
  }

  /**
   * Recalculate ranking positions for all players on a given date
   */
  static async recalculateRankings(rankingDate) {
    console.log(`Recalculating rankings for date: ${rankingDate}`);

    // Get all categories with rankings
    const [categories] = await pool.query(`
      SELECT DISTINCT category_id FROM player_rankings WHERE ranking_date = ?
    `, [rankingDate]);

    for (const { category_id } of categories) {
      // Get players ordered by points descending
      const [players] = await pool.query(`
        SELECT id FROM player_rankings
        WHERE category_id = ? AND ranking_date = ?
        ORDER BY total_points DESC, wins DESC
      `, [category_id, rankingDate]);

      // Update rankings
      for (let i = 0; i < players.length; i++) {
        await pool.query(`
          UPDATE player_rankings SET ranking = ? WHERE id = ?
        `, [i + 1, players[i].id]);
      }
    }

    console.log(`Rankings recalculated for ${categories.length} categories`);
  }
}

module.exports = PointsService;
