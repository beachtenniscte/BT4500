const { pool } = require('../config/database');

class PointsService {
  static ROUND_MAPPING = {
    'Campeão': { order: 7, position: 1 },
    'Final': { order: 6, position: 2 },
    'Semifinal': { order: 5, position: 3 },   // 3rd-4th place
    'Quartas de Final': { order: 4, position: 5 }, // 5th-8th place
    'R16': { order: 3, position: 9 },
    'R32': { order: 2, position: 17 },
    'Fase de grupos': { order: 1, position: null },
    // Group stage positions
    'Grupo 1º': { order: 1, position: null },
    'Grupo 2º': { order: 1, position: null },
    'Grupo 3º': { order: 1, position: null },
    'Grupo 4º': { order: 1, position: null }
  };

  /**
   * Get points for a specific tier, level and round
   * @param {string} tier - Tournament tier (OURO, PRATA, BRONZE)
   * @param {number} level - Category level (1 or 2)
   * @param {string} roundName - Round name (Campeao, Final, etc.)
   */
  static async getPoints(tier, level, roundName) {
    const [rows] = await pool.query(
      `SELECT points FROM points_table WHERE tier = ? AND level = ? AND round_name = ?`,
      [tier, level, roundName]
    );
    const points = rows[0]?.points || 0;
    console.log(`getPoints(${tier}, ${level}, ${roundName}) = ${points}`);
    if (points === 0) {
      // Debug: list all available round names for this tier/level
      const [allRounds] = await pool.query(
        `SELECT round_name, points FROM points_table WHERE tier = ? AND level = ?`,
        [tier, level]
      );
      console.log(`Available rounds for ${tier}/${level}:`, allRounds.map(r => `${r.round_name}=${r.points}`).join(', '));
    }
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

    query += ` ORDER BY tier, level, round_order DESC`;

    const [rows] = await pool.query(query, params);
    return rows;
  }

  /**
   * Calculate points based on elimination round
   * Winner gets points for 'Campeão'
   * Loser in final gets points for 'Final'
   * Losers in semifinal get points for 'Semifinal'
   * etc.
   */
  static async calculateMatchPoints(tournamentId, matchId) {
    // Get match details including category level
    const [matches] = await pool.query(`
      SELECT m.*, t.tier, c.code as category_code, c.level as category_level
      FROM matches m
      JOIN tournaments t ON m.tournament_id = t.id
      JOIN tournament_categories tc ON m.tournament_category_id = tc.id
      JOIN categories c ON tc.category_id = c.id
      WHERE m.id = ?
    `, [matchId]);

    if (!matches.length) return null;

    const match = matches[0];

    if (match.status !== 'completed' || !match.winner_team_id) {
      return null;
    }

    const tier = match.tier;
    const level = match.category_level;
    const round = this.normalizeRound(match.round);
    const loserId = match.team1_id === match.winner_team_id ? match.team2_id : match.team1_id;

    // Get points for the loser (eliminated in this round)
    const loserPoints = await this.getPoints(tier, level, round);

    // Winner only gets final points if this is the final
    let winnerPoints = 0;
    if (round === 'Final') {
      winnerPoints = await this.getPoints(tier, level, 'Campeão');
    }

    return {
      winnerId: match.winner_team_id,
      winnerPoints,
      loserId,
      loserPoints,
      round,
      tier,
      level
    };
  }

  /**
   * Normalize round name for points lookup
   */
  static normalizeRound(roundStr) {
    if (roundStr.startsWith('Fase de grupos')) {
      return 'Fase de grupos';
    }
    return roundStr;
  }

  /**
   * Calculate final position based on elimination round
   */
  static getFinalPosition(eliminationRound, totalTeams) {
    const round = this.normalizeRound(eliminationRound);

    switch (round) {
      case 'Final':
        return 2; // Runner-up
      case 'Semifinal':
        return 3; // 3rd-4th (shared)
      case 'Quartas de Final':
        return 5; // 5th-8th (shared)
      case 'R16':
        return 9; // 9th-16th (shared)
      case 'R32':
        return 17; // 17th-32nd (shared)
      case 'Fase de grupos':
        return null; // Varies by group stage performance
      default:
        return null;
    }
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
    const teamStats = new Map(); // teamId -> { wins, losses, setsWon, setsLost, gamesWon, gamesLost }

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
          headToHead: new Map() // opponentId -> 1 (win) or -1 (loss)
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

      // 2. Head-to-head (if only comparing 2 teams with same wins)
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
   * Award points to all teams after tournament completion
   */
  static async awardTournamentPoints(tournamentId) {
    try {
      // Get tournament tier
      const [tournaments] = await pool.query(
        `SELECT tier FROM tournaments WHERE id = ?`,
        [tournamentId]
      );

      if (!tournaments.length) {
        throw new Error('Tournament not found');
      }

      const tier = tournaments[0].tier;

      // Get all completed matches with category level
      const [matches] = await pool.query(`
        SELECT m.*,
               tc.id as tournament_category_id,
               c.id as category_id,
               c.level as category_level
        FROM matches m
        JOIN tournament_categories tc ON m.tournament_category_id = tc.id
        JOIN categories c ON tc.category_id = c.id
        WHERE m.tournament_id = ?
          AND m.status IN ('completed', 'walkover')
          AND m.winner_team_id IS NOT NULL
        ORDER BY m.round_order DESC
      `, [tournamentId]);

      const teamResults = new Map(); // teamId -> { wins, losses, lastRound, points, level, highestRoundOrder, groupPosition }

      // First, process group stage standings for proper point assignment
      const processedGroups = new Set();

      for (const match of matches) {
        if (match.round && match.round.includes('Fase de grupos')) {
          const groupMatch = match.round.match(/Grupo\s*([A-Z])/i);
          const groupKey = `${match.tournament_category_id}-${groupMatch ? groupMatch[1] : 'default'}`;

          if (!processedGroups.has(groupKey) && groupMatch) {
            processedGroups.add(groupKey);
            const groupName = groupMatch[1];
            const standings = await this.calculateGroupStandings(
              tournamentId,
              match.tournament_category_id,
              groupName
            );

            // Store group positions for later use
            for (const teamStanding of standings) {
              if (!teamResults.has(teamStanding.teamId)) {
                teamResults.set(teamStanding.teamId, {
                  wins: 0, losses: 0, lastRound: null, points: 0,
                  categoryId: match.category_id, level: match.category_level,
                  highestRoundOrder: 0, groupPosition: null,
                  setsWon: 0, setsLost: 0, gamesWon: 0, gamesLost: 0
                });
              }
              const result = teamResults.get(teamStanding.teamId);
              result.groupPosition = teamStanding.position;
              result.setsWon = teamStanding.setsWon;
              result.setsLost = teamStanding.setsLost;
              result.gamesWon = teamStanding.gamesWon;
              result.gamesLost = teamStanding.gamesLost;
            }
          }
        }
      }

      // Process all matches
      for (const match of matches) {
        const winnerId = match.winner_team_id;
        const loserId = match.team1_id === winnerId ? match.team2_id : match.team1_id;
        const round = this.normalizeRound(match.round);
        const level = match.category_level;
        const roundOrder = match.round_order;

        // Track wins/losses
        if (!teamResults.has(winnerId)) {
          teamResults.set(winnerId, {
            wins: 0, losses: 0, lastRound: null, points: 0,
            categoryId: match.category_id, level, highestRoundOrder: 0, groupPosition: null
          });
        }
        if (!teamResults.has(loserId)) {
          teamResults.set(loserId, {
            wins: 0, losses: 0, lastRound: null, points: 0,
            categoryId: match.category_id, level, highestRoundOrder: 0, groupPosition: null
          });
        }

        teamResults.get(winnerId).wins++;
        teamResults.get(loserId).losses++;

        // Track highest round reached for winner
        if (roundOrder > teamResults.get(winnerId).highestRoundOrder) {
          teamResults.get(winnerId).highestRoundOrder = roundOrder;
        }

        // Set elimination round for loser (only if this is their highest round - they got eliminated here)
        if (roundOrder > teamResults.get(loserId).highestRoundOrder || !teamResults.get(loserId).lastRound) {
          teamResults.get(loserId).lastRound = round;
          teamResults.get(loserId).points = await this.getPoints(tier, level, round);
          teamResults.get(loserId).highestRoundOrder = roundOrder;
        }

        // If this is the final, winner gets champion points
        if (round === 'Final') {
          teamResults.get(winnerId).lastRound = 'Campeão';
          teamResults.get(winnerId).points = await this.getPoints(tier, level, 'Campeão');
        }
      }

      // Handle teams that only played group stage - assign points based on group position
      for (const [teamId, result] of teamResults) {
        if (!result.lastRound || result.lastRound === 'Fase de grupos') {
          if (result.groupPosition) {
            // Try to get position-specific points
            const positionRound = `Grupo ${result.groupPosition}º`;
            let positionPoints = await this.getPoints(tier, result.level, positionRound);

            // Fall back to generic group stage points if position-specific not found
            if (positionPoints === 0) {
              positionPoints = await this.getPoints(tier, result.level, 'Fase de grupos');
            }

            result.lastRound = positionRound;
            result.points = positionPoints;
            console.log(`Team ${teamId} finished ${result.groupPosition}º in group, points: ${positionPoints}`);
          } else {
            result.lastRound = 'Fase de grupos';
            result.points = await this.getPoints(tier, result.level, 'Fase de grupos');
            console.log(`Team ${teamId} had no group position, defaulting to Fase de grupos`);
          }
        }
      }

      // Update registrations with points
      for (const [teamId, result] of teamResults) {
        console.log(`Processing team ${teamId}: round=${result.lastRound}, points=${result.points}, categoryId=${result.categoryId}`);

        await pool.query(`
          UPDATE tournament_registrations
          SET points_earned = ?,
              final_position = ?,
              status = CASE WHEN ? = N'Campeão' THEN 'winner' ELSE 'eliminated' END
          WHERE tournament_id = ? AND team_id = ?
        `, [
          result.points,
          this.ROUND_MAPPING[result.lastRound]?.position || null,
          result.lastRound,
          tournamentId,
          teamId
        ]);

        // Update player tournament results
        const [team] = await pool.query(
          `SELECT player1_id, player2_id, category_id FROM teams WHERE id = ?`,
          [teamId]
        );

        if (team.length) {
          const { player1_id, player2_id, category_id } = team[0];
          console.log(`Team ${teamId} players: ${player1_id}, ${player2_id}, category: ${category_id}`);

          // Insert/update results for both players
          for (const playerId of [player1_id, player2_id]) {
            const partnerId = playerId === player1_id ? player2_id : player1_id;

            // Check if exists first (MS SQL doesn't have ON DUPLICATE KEY)
            const [existing] = await pool.query(
              `SELECT id FROM player_tournament_results WHERE player_id = ? AND tournament_id = ? AND category_id = ?`,
              [playerId, tournamentId, category_id]
            );

            console.log(`Player ${playerId} existing results for tournament ${tournamentId}: ${existing.length}`);

            if (existing.length > 0) {
              await pool.query(`
                UPDATE player_tournament_results
                SET final_round = ?, final_position = ?, points_earned = ?, matches_won = ?, matches_lost = ?
                WHERE player_id = ? AND tournament_id = ? AND category_id = ?
              `, [
                result.lastRound,
                this.ROUND_MAPPING[result.lastRound]?.position || null,
                result.points,
                result.wins,
                result.losses,
                playerId, tournamentId, category_id
              ]);
              console.log(`Updated player_tournament_results for player ${playerId}`);
            } else {
              try {
                await pool.query(`
                  INSERT INTO player_tournament_results
                    (player_id, tournament_id, category_id, team_id, partner_id, final_round, final_position, points_earned, matches_won, matches_lost)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                  playerId, tournamentId, category_id, teamId, partnerId,
                  result.lastRound,
                  this.ROUND_MAPPING[result.lastRound]?.position || null,
                  result.points,
                  result.wins,
                  result.losses
                ]);
                console.log(`Inserted player_tournament_results for player ${playerId}, tournament ${tournamentId}`);
              } catch (insertError) {
                console.error(`Failed to insert player_tournament_results for player ${playerId}:`, insertError.message);
              }
            }

            // Update player total points
            await pool.query(`
              UPDATE players SET total_points = (
                SELECT COALESCE(SUM(points_earned), 0)
                FROM player_tournament_results
                WHERE player_id = ?
              ) WHERE id = ?
            `, [playerId, playerId]);
          }
        } else {
          console.log(`WARNING: Team ${teamId} not found in teams table`);
        }
      }

      return {
        teamsProcessed: teamResults.size,
        results: Array.from(teamResults.entries()).map(([teamId, result]) => ({
          teamId,
          ...result
        }))
      };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = PointsService;
