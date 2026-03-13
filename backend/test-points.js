/**
 * Test script for PointsService
 * Run: node test-points.js
 *
 * Compares calculated points with expected results
 */

const fs = require('fs');
const path = require('path');

// Expected results for M1 (Pares Masculinos Nível 1) - PRATA N1 tournament
// Points: ID1=750, ID2=500, ID3=333, ID4=222, ID5=148, ID6=15
const EXPECTED_M1 = {
  // Winners (ID 1 = 750)
  'Nuno Silva': 750,
  'Sérgio Silva': 750,
  // Finalists (ID 2 = 500)
  'João Santos': 500,
  'Matheus Santos': 500,
  // SF losers (ID 3 = 333)
  'Breno Jesus': 333,
  'Wellington Totti': 333,
  'Mário Minneman': 333,
  'Sérgio Real': 333,
  // QF losers (ID 4 = 222) - these teams WON in R16
  'António Martins': 222,
  'Rui Ferreira': 222,
  'Daniel Tavares': 222,
  'Jorge Duarte': 222,
  'Carlos Mouta': 222,
  'David Sá': 222,
  'Hugo Spratley': 222,
  'Márcio Soares': 222,
  // R16 losers with 1+ wins from R32 should get ID 5 = 148
  // But if they had BYE in R32 and lost R16 with 0 wins → ID 6 = 15
  // R16 losers with 0 wins = ID 6 = 15 points
  'Arthur Aguiar': 15,
  'Pedro Lima': 15,
  'Miguel Monteiro': 15,
  'Renato Ribeiro': 15,
  'Carlos Lopes': 15,
  'João Osório': 15,
  'Caio Zanardi': 15,
  'Rubens Trindade': 15,
  'Bruno Polónia': 15,
  'Ivo Brito': 15,
  'Eduardo Diniz': 15,
  'Rodrigo Nascimento': 15,
  'Caio Junior': 15,
  'Luciano Rocha': 15,
  'Arthur Santos': 15,
  'Lourenço Miranda': 15,
  // R32 losers (0 wins) = ID 6 = 15 points
  'Arlindo Carneiro': 15,
  'Carlos Soares': 15,
};

// Expected results for M2 (Pares Masculinos Nível 2) - PRATA tournament
const EXPECTED_M2 = {
  'José Barbosa': 222,    // Campeão N2 (ID 1) = 222
  'Nuno Ramos': 222,      // Campeão N2 (ID 1) = 222
  'Paulo Silva': 148,     // Finalista N2 (ID 2) = 148
  'Sandro Almeida': 148,
  'Carlos Ávila': 99,     // Semifinalista N2 (ID 3) = 99
  'Italo Souza': 99,
  'Arménio Ramos': 99,
  'Emanuel Silva': 99,
  'Eduardo Mourão': 66,   // 2º Grupo (ID 4) = 66 - 2nd in G4 (non-advancing)
  'Gustavo Salvini': 66,
  'João Neto': 44,        // Penúltimo (ID 5) = 44 - 2nd in G3 (non-advancing)
  'Petrus Leal': 44,
  'Ricardo Nascimento': 44, // Penúltimo (ID 5) = 44 - 3rd in G4
  'Rui Ribeiro': 44,
  // Últimos = ID 6 = 15 points
  'Daniel Mallmann': 15,
  'Juan Vasconcellos': 15,
  'Bernardo Antunes': 15,
  'Pedro Neto': 15,
  'João Menezes': 15,
  'Pascal Bihan': 15, // Note: database has "Pascal Bihan" instead of "Pascal Le Bihan"
};

function parseAppResult(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  const results = {};

  for (const line of lines) {
    // Skip numeric-only lines (line numbers)
    if (/^\d+$/.test(line.trim())) continue;

    // Parse "Name\tPoints" or "Name,Points"
    const parts = line.split(/[\t,]/);
    if (parts.length >= 2) {
      const name = parts[0].trim();
      const points = parseInt(parts[1].trim());
      if (name && !isNaN(points)) {
        results[name] = points;
      }
    }
  }

  return results;
}

// Debug: show points distribution summary
function showPointsDistribution(actual) {
  const pointCounts = {};
  for (const [name, points] of Object.entries(actual)) {
    pointCounts[points] = (pointCounts[points] || 0) + 1;
  }

  console.log('\nPoints distribution:');
  const sortedPoints = Object.keys(pointCounts).map(Number).sort((a, b) => b - a);
  for (const points of sortedPoints) {
    console.log(`  ${points} points: ${pointCounts[points]} players`);
  }
}

function compareResults(actual, expected, categoryName) {
  console.log(`\n=== ${categoryName} ===`);

  let passed = 0;
  let failed = 0;
  const errors = [];

  for (const [name, expectedPoints] of Object.entries(expected)) {
    const actualPoints = actual[name];

    if (actualPoints === undefined) {
      errors.push(`  MISSING: ${name} (expected ${expectedPoints})`);
      failed++;
    } else if (actualPoints !== expectedPoints) {
      errors.push(`  WRONG: ${name} = ${actualPoints} (expected ${expectedPoints})`);
      failed++;
    } else {
      passed++;
    }
  }

  // Check for unexpected players
  for (const [name, points] of Object.entries(actual)) {
    if (expected[name] === undefined) {
      console.log(`  EXTRA: ${name} = ${points} (not in expected)`);
    }
  }

  console.log(`Passed: ${passed}/${passed + failed}`);

  if (errors.length > 0) {
    console.log('\nErrors:');
    errors.forEach(e => console.log(e));
  }

  return failed === 0;
}

function runTests() {
  console.log('========================================');
  console.log('POINTS CALCULATION TEST');
  console.log('========================================');

  const appResultPath = path.join(__dirname, '..', 'classificacao', 'AppResult.csv');

  if (!fs.existsSync(appResultPath)) {
    console.error(`ERROR: AppResult.csv not found at ${appResultPath}`);
    console.log('Run the points calculation first, then run this test.');
    process.exit(1);
  }

  const actual = parseAppResult(appResultPath);
  console.log(`\nLoaded ${Object.keys(actual).length} results from AppResult.csv`);
  showPointsDistribution(actual);

  // Test M1 results
  const m1Passed = compareResults(actual, EXPECTED_M1, 'M1 - Pares Masculinos Nível 1');

  // Test M2 results
  const m2Passed = compareResults(actual, EXPECTED_M2, 'M2 - Pares Masculinos Nível 2');

  console.log('\n========================================');
  if (m1Passed && m2Passed) {
    console.log('ALL TESTS PASSED!');
    process.exit(0);
  } else {
    console.log('TESTS FAILED - See errors above');
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  runTests();
}

module.exports = { runTests, compareResults, parseAppResult, EXPECTED_M1, EXPECTED_M2 };
