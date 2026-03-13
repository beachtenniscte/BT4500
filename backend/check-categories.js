/**
 * Check all categories in a tournament
 */

const { pool, closePool } = require('./src/config/database');

async function checkCategories(tournamentId) {
  try {
    console.log(`\n=== CATEGORIES IN TOURNAMENT ${tournamentId} ===\n`);

    // Get category summary
    const [summary] = await pool.query(`
      SELECT c.code, c.name,
             COUNT(*) as players,
             MIN(ptr.points_earned) as min_pts,
             MAX(ptr.points_earned) as max_pts
      FROM player_tournament_results ptr
      JOIN categories c ON ptr.category_id = c.id
      WHERE ptr.tournament_id = ?
      GROUP BY c.code, c.name
      ORDER BY c.code
    `, [tournamentId]);

    console.table(summary);

    // Check mixed categories specifically
    console.log(`\n=== MIXED CATEGORY DETAILS ===`);
    const [mixed] = await pool.query(`
      SELECT c.code, p.full_name, ptr.points_earned, ptr.final_position
      FROM player_tournament_results ptr
      JOIN categories c ON ptr.category_id = c.id
      JOIN players p ON ptr.player_id = p.id
      WHERE ptr.tournament_id = ?
        AND c.code LIKE 'X%'
      ORDER BY c.code, ptr.points_earned DESC
    `, [tournamentId]);

    if (mixed.length > 0) {
      console.log(`Found ${mixed.length} players in mixed categories:`);
      for (const m of mixed) {
        console.log(`  ${m.code}: ${m.full_name} = ${m.points_earned} (pos=${m.final_position})`);
      }
    } else {
      console.log('No mixed category results found');
    }

    // Check Aurora specifically
    console.log(`\n=== AURORA'S RESULTS ===`);
    const [aurora] = await pool.query(`
      SELECT c.code, c.name, ptr.points_earned, ptr.final_position
      FROM player_tournament_results ptr
      JOIN categories c ON ptr.category_id = c.id
      JOIN players p ON ptr.player_id = p.id
      WHERE ptr.tournament_id = ?
        AND p.full_name LIKE '%Aurora%'
      ORDER BY c.code
    `, [tournamentId]);

    for (const a of aurora) {
      console.log(`  ${a.code} (${a.name}): ${a.points_earned} pts (pos=${a.final_position})`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await closePool();
  }
}

const tournamentId = process.argv[2] || 6;
checkCategories(parseInt(tournamentId));
