/**
 * Export player results from database to CSV
 */

const { pool, closePool } = require('./src/config/database');
const fs = require('fs');
const path = require('path');

async function exportResults(tournamentId) {
  try {
    console.log(`\n=== EXPORTING RESULTS FOR TOURNAMENT ${tournamentId} ===`);

    // Get all player results for this tournament
    const [results] = await pool.query(`
      SELECT p.full_name, ptr.points_earned as points, c.code as category_code, ptr.final_position
      FROM player_tournament_results ptr
      JOIN players p ON ptr.player_id = p.id
      JOIN categories c ON ptr.category_id = c.id
      WHERE ptr.tournament_id = ?
      ORDER BY c.code, ptr.points_earned DESC, p.full_name
    `, [tournamentId]);

    console.log(`Found ${results.length} player results`);

    // Group by category - only M1 and M2
    const byCategory = {};
    for (const r of results) {
      if (r.category_code === 'M1' || r.category_code === 'M2') {
        if (!byCategory[r.category_code]) {
          byCategory[r.category_code] = [];
        }
        byCategory[r.category_code].push(r);
      }
    }

    // Output - M1 first, then M2
    let csvContent = '';
    let rank = 1;
    const categoryOrder = ['M1', 'M2'];
    for (const cat of categoryOrder) {
      const players = byCategory[cat] || [];
      console.log(`\n=== ${cat} ===`);
      for (const p of players) {
        console.log(`  ${p.full_name}\t${p.points}\t(pos=${p.final_position})`);
        csvContent += `${rank}\n${p.full_name}\t${p.points}\n`;
        rank++;
      }
    }

    // Write CSV
    const outputPath = path.join(__dirname, '..', 'classificacao', 'AppResult.csv');
    fs.writeFileSync(outputPath, csvContent, 'utf-8');
    console.log(`\nWritten to: ${outputPath}`);

    // Also check M2 specifically
    console.log(`\n=== M2 SPECIFIC CHECK ===`);
    const m2Players = byCategory['M2'] || [];
    const expectedM2 = {
      'José Barbosa': 222,
      'Nuno Ramos': 222,
      'Paulo Silva': 148,
      'Sandro Almeida': 148,
      'Carlos Ávila': 99,
      'Italo Souza': 99,
      'Arménio Ramos': 99,
      'Emanuel Silva': 99,
      'Eduardo Mourão': 66,
      'Gustavo Salvini': 66,
      'João Neto': 44,
      'Petrus Leal': 44,
      'Ricardo Nascimento': 44,
      'Rui Ribeiro': 44,
      'Daniel Mallmann': 15,
      'Juan Vasconcellos': 15,
      'Bernardo Antunes': 15,
      'Pedro Neto': 15,
      'João Menezes': 15,
      'Pascal Le Bihan': 15,
    };

    let passed = 0;
    let failed = 0;
    for (const p of m2Players) {
      const expected = expectedM2[p.full_name];
      if (expected !== undefined) {
        if (p.points === expected) {
          console.log(`  OK: ${p.full_name} = ${p.points}`);
          passed++;
        } else {
          console.log(`  WRONG: ${p.full_name} = ${p.points} (expected ${expected})`);
          failed++;
        }
      }
    }
    console.log(`\nM2: ${passed}/${passed + failed} correct`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await closePool();
  }
}

const tournamentId = process.argv[2] || 6;
exportResults(parseInt(tournamentId));
