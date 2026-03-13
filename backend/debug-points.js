/**
 * Debug script to trace points calculation
 * Run: node debug-points.js <tournamentId>
 */

const { pool, closePool } = require('./src/config/database');
const PointsService = require('./src/services/PointsService');

async function debugPoints(tournamentId) {
  try {
    console.log(`\n=== DEBUG POINTS CALCULATION ===`);
    console.log(`Tournament ID: ${tournamentId}`);

    // First, check if João Santos / Matheus Santos have consistent team_id
    const [joaoTeams] = await pool.query(`
      SELECT m.team1_id, m.team2_id, m.round, m.round_order, m.winner_team_id,
             CONCAT(p1a.full_name, ' / ', p1b.full_name) as team1_name,
             CONCAT(p2a.full_name, ' / ', p2b.full_name) as team2_name
      FROM matches m
      LEFT JOIN teams t1 ON m.team1_id = t1.id
      LEFT JOIN teams t2 ON m.team2_id = t2.id
      LEFT JOIN players p1a ON t1.player1_id = p1a.id
      LEFT JOIN players p1b ON t1.player2_id = p1b.id
      LEFT JOIN players p2a ON t2.player1_id = p2a.id
      LEFT JOIN players p2b ON t2.player2_id = p2b.id
      WHERE m.tournament_id = ?
        AND (CONCAT(p1a.full_name, ' / ', p1b.full_name) LIKE '%João Santos%'
             OR CONCAT(p2a.full_name, ' / ', p2b.full_name) LIKE '%João Santos%')
      ORDER BY m.round_order
    `, [tournamentId]);

    console.log(`\n=== João Santos Team ID check ===`);
    const teamIds = new Set();
    for (const m of joaoTeams) {
      const isTeam1 = m.team1_name && m.team1_name.includes('João Santos');
      const teamId = isTeam1 ? m.team1_id : m.team2_id;
      teamIds.add(teamId);
      console.log(`  ${m.round}: team_id=${teamId} (${isTeam1 ? m.team1_name : m.team2_name})`);
    }
    console.log(`\n  UNIQUE TEAM IDs: ${teamIds.size} (should be 1 for consistency)`);
    if (teamIds.size > 1) {
      console.log(`  WARNING: Multiple team IDs found! This is the bug.`);
      console.log(`  Team IDs: ${[...teamIds].join(', ')}`);
    }

    // Also check finalists specifically (João Santos / Matheus Santos)
    console.log(`\n=== CHECKING FINALISTS TEAM CONSISTENCY ===`);
    const [finalistMatches] = await pool.query(`
      SELECT m.round, m.team1_id, m.team2_id, m.winner_team_id,
             CONCAT(p1a.full_name, ' / ', p1b.full_name) as team1_name,
             CONCAT(p2a.full_name, ' / ', p2b.full_name) as team2_name
      FROM matches m
      JOIN tournament_categories tc ON m.tournament_category_id = tc.id
      JOIN categories c ON tc.category_id = c.id
      LEFT JOIN teams t1 ON m.team1_id = t1.id
      LEFT JOIN teams t2 ON m.team2_id = t2.id
      LEFT JOIN players p1a ON t1.player1_id = p1a.id
      LEFT JOIN players p1b ON t1.player2_id = p1b.id
      LEFT JOIN players p2a ON t2.player1_id = p2a.id
      LEFT JOIN players p2b ON t2.player2_id = p2b.id
      WHERE m.tournament_id = ? AND c.code = 'M1'
        AND m.status IN ('completed', 'walkover')
        AND m.winner_team_id IS NOT NULL
      ORDER BY m.round_order
    `, [tournamentId]);

    // Track team_id for each team name across all matches
    const teamNameToIds = new Map();
    for (const m of finalistMatches) {
      if (m.team1_name) {
        if (!teamNameToIds.has(m.team1_name)) teamNameToIds.set(m.team1_name, new Set());
        teamNameToIds.get(m.team1_name).add(m.team1_id);
      }
      if (m.team2_name) {
        if (!teamNameToIds.has(m.team2_name)) teamNameToIds.set(m.team2_name, new Set());
        teamNameToIds.get(m.team2_name).add(m.team2_id);
      }
    }

    console.log('Team name → team_id mapping (should all be size 1):');
    for (const [name, ids] of teamNameToIds) {
      const status = ids.size === 1 ? 'OK' : 'INCONSISTENT';
      console.log(`  ${name}: ${[...ids].join(', ')} [${status}]`);
    }

    // Get tournament info
    const [tournaments] = await pool.query(
      `SELECT * FROM tournaments WHERE id = ?`,
      [tournamentId]
    );

    if (!tournaments.length) {
      console.log('Tournament not found!');
      // List available tournaments
      const [allTournaments] = await pool.query(`SELECT id, name, code FROM tournaments ORDER BY id`);
      console.log('\nAvailable tournaments:');
      for (const t of allTournaments) {
        console.log(`  ID ${t.id}: ${t.name} (${t.code})`);
      }
      return;
    }

    console.log(`Tournament: ${tournaments[0].name}`);

    // Get M1 category ID
    const [categories] = await pool.query(
      `SELECT tc.id as tournament_category_id, c.code, c.name
       FROM tournament_categories tc
       JOIN categories c ON tc.category_id = c.id
       WHERE tc.tournament_id = ? AND c.code = 'M1'`,
      [tournamentId]
    );

    if (!categories.length) {
      console.log('M1 category not found!');
      return;
    }

    const tcId = categories[0].tournament_category_id;
    console.log(`\nM1 Tournament Category ID: ${tcId}`);

    // Get all M1 matches
    const [matches] = await pool.query(
      `SELECT m.*,
              CONCAT(p1a.full_name, ' / ', p1b.full_name) as team1_name,
              CONCAT(p2a.full_name, ' / ', p2b.full_name) as team2_name,
              CONCAT(pw1.full_name, ' / ', pw2.full_name) as winner_name
       FROM matches m
       LEFT JOIN teams t1 ON m.team1_id = t1.id
       LEFT JOIN teams t2 ON m.team2_id = t2.id
       LEFT JOIN teams tw ON m.winner_team_id = tw.id
       LEFT JOIN players p1a ON t1.player1_id = p1a.id
       LEFT JOIN players p1b ON t1.player2_id = p1b.id
       LEFT JOIN players p2a ON t2.player1_id = p2a.id
       LEFT JOIN players p2b ON t2.player2_id = p2b.id
       LEFT JOIN players pw1 ON tw.player1_id = pw1.id
       LEFT JOIN players pw2 ON tw.player2_id = pw2.id
       WHERE m.tournament_id = ?
         AND m.tournament_category_id = ?
         AND m.status IN ('completed', 'walkover')
         AND m.winner_team_id IS NOT NULL
       ORDER BY m.round_order ASC`,
      [tournamentId, tcId]
    );

    console.log(`\nM1 Matches (${matches.length}):`);
    console.log('---');

    for (const m of matches) {
      console.log(`Round: ${m.round} (order ${m.round_order})`);
      console.log(`  Team1: ${m.team1_name} (ID ${m.team1_id})`);
      console.log(`  Team2: ${m.team2_name} (ID ${m.team2_id})`);
      console.log(`  Winner: ${m.winner_name} (ID ${m.winner_team_id})`);
      console.log('---');
    }

    // Count wins per team
    const teamWins = new Map();
    const teamLosses = new Map();
    const teamNames = new Map();

    for (const m of matches) {
      const winnerId = m.winner_team_id;
      const loserId = m.team1_id === winnerId ? m.team2_id : m.team1_id;
      const loserName = m.team1_id === winnerId ? m.team2_name : m.team1_name;

      teamWins.set(winnerId, (teamWins.get(winnerId) || 0) + 1);
      teamLosses.set(loserId, (teamLosses.get(loserId) || 0) + 1);

      if (m.team1_id === winnerId) {
        teamNames.set(winnerId, m.team1_name);
        teamNames.set(loserId, m.team2_name);
      } else {
        teamNames.set(winnerId, m.team2_name);
        teamNames.set(loserId, m.team1_name);
      }
    }

    console.log('\n=== TEAM SUMMARY ===');
    const allTeamIds = new Set([...teamWins.keys(), ...teamLosses.keys()]);

    for (const teamId of allTeamIds) {
      const wins = teamWins.get(teamId) || 0;
      const losses = teamLosses.get(teamId) || 0;
      const name = teamNames.get(teamId) || 'Unknown';
      console.log(`Team ${teamId} (${name}): ${wins} wins, ${losses} losses`);
    }

    // Check format detection for M1
    console.log('\n=== FORMAT DETECTION CHECK ===');
    const [m1Matches] = await pool.query(`
      SELECT m.round
      FROM matches m
      JOIN tournament_categories tc ON m.tournament_category_id = tc.id
      JOIN categories c ON tc.category_id = c.id
      WHERE m.tournament_id = ? AND c.code = 'M1'
        AND m.status IN ('completed', 'walkover')
    `, [tournamentId]);

    let hasGroupStage = false;
    let hasFinal = false;
    let hasElimination = false;

    for (const m of m1Matches) {
      if (!m.round) continue;
      const round = m.round.toLowerCase();
      if (round.includes('fase de grupos') || round.includes('grupo')) hasGroupStage = true;
      if (round.includes('final') && !round.includes('semifinal') && !round.includes('quartas')) hasFinal = true;
      if (round.includes('r16') || round.includes('r32') || round.includes('quartas')) hasElimination = true;
    }

    console.log(`  Groups: ${hasGroupStage}, Final: ${hasFinal}, Elimination: ${hasElimination}`);
    console.log(`  Expected format: ${hasElimination ? 'elimination' : (hasGroupStage && hasFinal ? 'groups+final' : 'unknown')}`);

    // Now run the actual points calculation
    console.log('\n=== RUNNING POINTS CALCULATION ===');
    const result = await PointsService.awardTournamentPoints(tournamentId);
    console.log(`\nResults: ${result.teamsProcessed} teams processed`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await closePool();
  }
}

// Get tournament ID from command line
const tournamentId = process.argv[2] || 1;
debugPoints(parseInt(tournamentId));
