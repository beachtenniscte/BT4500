/**
 * Debug G3 standings specifically
 */

const { pool, closePool } = require('./src/config/database');

async function debugG3(tournamentId) {
  try {
    // Get M2 category ID
    const [categories] = await pool.query(`
      SELECT tc.id as tournament_category_id
       FROM tournament_categories tc
       JOIN categories c ON tc.category_id = c.id
       WHERE tc.tournament_id = ? AND c.code = 'M2'
    `, [tournamentId]);

    const tcId = categories[0].tournament_category_id;

    // Get G3 matches
    const [matches] = await pool.query(`
      SELECT m.*,
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
        AND m.tournament_category_id = ?
        AND m.round LIKE '%G3%'
        AND m.status IN ('completed', 'walkover')
      ORDER BY m.round_order
    `, [tournamentId, tcId]);

    console.log(`\n=== G3 MATCHES (${matches.length}) ===`);

    // Track team stats
    const teamStats = new Map();

    for (const m of matches) {
      console.log(`\n${m.team1_name} vs ${m.team2_name}`);
      console.log(`  Score: ${m.set1_team1}-${m.set1_team2} ${m.set2_team1}-${m.set2_team2} ${m.set3_team1 ?? ''}-${m.set3_team2 ?? ''}`);
      console.log(`  Winner: ${m.winner_team_id === m.team1_id ? m.team1_name : m.team2_name}`);

      const team1Id = m.team1_id;
      const team2Id = m.team2_id;

      if (!teamStats.has(team1Id)) {
        teamStats.set(team1Id, {
          id: team1Id, name: m.team1_name,
          wins: 0, losses: 0, setsWon: 0, setsLost: 0, gamesWon: 0, gamesLost: 0,
          h2h: new Map()
        });
      }
      if (!teamStats.has(team2Id)) {
        teamStats.set(team2Id, {
          id: team2Id, name: m.team2_name,
          wins: 0, losses: 0, setsWon: 0, setsLost: 0, gamesWon: 0, gamesLost: 0,
          h2h: new Map()
        });
      }

      const t1 = teamStats.get(team1Id);
      const t2 = teamStats.get(team2Id);

      // Winner/loser
      if (m.winner_team_id === team1Id) {
        t1.wins++; t2.losses++;
        t1.h2h.set(team2Id, 1);
        t2.h2h.set(team1Id, -1);
      } else {
        t2.wins++; t1.losses++;
        t2.h2h.set(team1Id, 1);
        t1.h2h.set(team2Id, -1);
      }

      // Sets and games (with null = 0 fix)
      const sets = [
        { s1: m.set1_team1, s2: m.set1_team2 },
        { s1: m.set2_team1, s2: m.set2_team2 },
        { s1: m.set3_team1, s2: m.set3_team2 }
      ];

      for (const set of sets) {
        if (set.s1 === null && set.s2 === null) continue;

        const s1 = set.s1 ?? 0;
        const s2 = set.s2 ?? 0;

        t1.gamesWon += s1;
        t1.gamesLost += s2;
        t2.gamesWon += s2;
        t2.gamesLost += s1;

        if (s1 > s2) {
          t1.setsWon++;
          t2.setsLost++;
          console.log(`    Set ${s1}-${s2}: team1 wins`);
        } else if (s2 > s1) {
          t2.setsWon++;
          t1.setsLost++;
          console.log(`    Set ${s1}-${s2}: team2 wins`);
        }
      }
    }

    // Sort standings
    const standings = [...teamStats.values()];
    standings.sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      const h2h = a.h2h.get(b.id);
      if (h2h === 1) return -1;
      if (h2h === -1) return 1;
      const aSetDiff = a.setsWon - a.setsLost;
      const bSetDiff = b.setsWon - b.setsLost;
      if (bSetDiff !== aSetDiff) return bSetDiff - aSetDiff;
      const aGameDiff = a.gamesWon - a.gamesLost;
      const bGameDiff = b.gamesWon - b.gamesLost;
      if (bGameDiff !== aGameDiff) return bGameDiff - aGameDiff;
      return b.gamesWon - a.gamesWon;
    });

    console.log(`\n=== G3 FINAL STANDINGS ===`);
    standings.forEach((t, i) => {
      const setDiff = t.setsWon - t.setsLost;
      const gameDiff = t.gamesWon - t.gamesLost;
      console.log(`${i+1}. ${t.name}`);
      console.log(`   W/L: ${t.wins}-${t.losses}, Sets: ${t.setsWon}-${t.setsLost} (${setDiff >= 0 ? '+' : ''}${setDiff}), Games: ${t.gamesWon}-${t.gamesLost} (${gameDiff >= 0 ? '+' : ''}${gameDiff})`);

      // Show h2h
      const h2hStr = [...t.h2h.entries()].map(([id, val]) => {
        const opp = standings.find(s => s.id === id);
        return `${opp?.name?.split(' / ')[0]}: ${val > 0 ? 'W' : 'L'}`;
      }).join(', ');
      console.log(`   H2H: ${h2hStr}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await closePool();
  }
}

debugG3(6);
