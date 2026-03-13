/**
 * Debug M2 points calculation
 */

const { pool, closePool } = require('./src/config/database');

async function debugM2(tournamentId) {
  try {
    console.log(`\n=== DEBUG M2 CATEGORY ===`);
    console.log(`Tournament ID: ${tournamentId}`);

    // Get M2 category ID
    const [categories] = await pool.query(`
      SELECT tc.id as tournament_category_id, c.code, c.name
       FROM tournament_categories tc
       JOIN categories c ON tc.category_id = c.id
       WHERE tc.tournament_id = ? AND c.code = 'M2'
    `, [tournamentId]);

    if (!categories.length) {
      console.log('M2 category not found!');
      return;
    }

    const tcId = categories[0].tournament_category_id;
    console.log(`\nM2 Tournament Category ID: ${tcId}`);

    // Get all M2 matches
    const [matches] = await pool.query(`
      SELECT m.*,
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
      ORDER BY m.round_order ASC
    `, [tournamentId, tcId]);

    console.log(`\n=== ALL M2 MATCHES (${matches.length}) ===`);
    for (const m of matches) {
      console.log(`  ${m.round}: ${m.team1_name} vs ${m.team2_name}`);
      console.log(`    Winner: ${m.winner_name} (team_id=${m.winner_team_id})`);
      console.log(`    Score: ${m.set1_team1}-${m.set1_team2} ${m.set2_team1}-${m.set2_team2} ${m.set3_team1 || ''}-${m.set3_team2 || ''}`);
    }

    // Group by round type
    const groupMatches = matches.filter(m => m.round && m.round.includes('G'));
    const sfMatches = matches.filter(m => m.round && m.round.toLowerCase().includes('semifinal'));
    const finalMatches = matches.filter(m => m.round && m.round.toLowerCase() === 'final');

    console.log(`\n=== GROUP MATCHES (${groupMatches.length}) ===`);

    // Extract group names
    const groupNames = [...new Set(groupMatches.map(m => {
      const match = m.round.match(/G(\d+)/);
      return match ? `G${match[1]}` : null;
    }).filter(Boolean))];

    console.log(`Groups found: ${groupNames.join(', ')}`);

    // Calculate standings for each group
    for (const groupName of groupNames.sort()) {
      const gMatches = groupMatches.filter(m => m.round.includes(groupName));
      console.log(`\n--- ${groupName} (${gMatches.length} matches) ---`);

      const teamStats = new Map();

      for (const m of gMatches) {
        console.log(`  ${m.team1_name} vs ${m.team2_name} -> Winner: ${m.winner_name}`);

        if (!teamStats.has(m.team1_id)) {
          teamStats.set(m.team1_id, { id: m.team1_id, name: m.team1_name, wins: 0, losses: 0, setsWon: 0, setsLost: 0 });
        }
        if (!teamStats.has(m.team2_id)) {
          teamStats.set(m.team2_id, { id: m.team2_id, name: m.team2_name, wins: 0, losses: 0, setsWon: 0, setsLost: 0 });
        }

        const t1 = teamStats.get(m.team1_id);
        const t2 = teamStats.get(m.team2_id);

        if (m.winner_team_id === m.team1_id) {
          t1.wins++;
          t2.losses++;
        } else {
          t2.wins++;
          t1.losses++;
        }

        // Sets
        const sets = [
          { s1: m.set1_team1, s2: m.set1_team2 },
          { s1: m.set2_team1, s2: m.set2_team2 },
          { s1: m.set3_team1, s2: m.set3_team2 }
        ];
        for (const s of sets) {
          if (s.s1 != null && s.s2 != null) {
            if (s.s1 > s.s2) { t1.setsWon++; t2.setsLost++; }
            else if (s.s2 > s.s1) { t2.setsWon++; t1.setsLost++; }
          }
        }
      }

      // Sort standings
      const standings = [...teamStats.values()].sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        return (b.setsWon - b.setsLost) - (a.setsWon - a.setsLost);
      });

      console.log(`  Standings:`);
      standings.forEach((t, i) => {
        console.log(`    ${i+1}. ${t.name} (team_id=${t.id}) - ${t.wins}W/${t.losses}L, sets=${t.setsWon}-${t.setsLost}`);
      });
    }

    console.log(`\n=== SEMIFINAL MATCHES (${sfMatches.length}) ===`);
    for (const m of sfMatches) {
      console.log(`  ${m.round}: ${m.team1_name} vs ${m.team2_name}`);
      console.log(`    Winner: ${m.winner_name}`);
    }

    console.log(`\n=== FINAL MATCHES (${finalMatches.length}) ===`);
    for (const m of finalMatches) {
      console.log(`  ${m.round}: ${m.team1_name} vs ${m.team2_name}`);
      console.log(`    Winner: ${m.winner_name}`);
    }

    // Check specific teams
    console.log(`\n=== KEY TEAMS CHECK ===`);
    const keyNames = ['João Neto', 'Petrus Leal', 'Eduardo Mourão', 'Gustavo Salvini', 'Ricardo Nascimento', 'Rui Ribeiro'];

    for (const m of matches) {
      for (const name of keyNames) {
        if (m.team1_name?.includes(name) || m.team2_name?.includes(name)) {
          const isTeam1 = m.team1_name?.includes(name);
          const teamId = isTeam1 ? m.team1_id : m.team2_id;
          const teamName = isTeam1 ? m.team1_name : m.team2_name;
          const won = m.winner_team_id === teamId;
          console.log(`  ${name} (team ${teamId}): ${m.round} - ${won ? 'WON' : 'LOST'}`);
        }
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await closePool();
  }
}

const tournamentId = process.argv[2] || 6;
debugM2(parseInt(tournamentId));
