/**
 * Verification harness for tournament points calculation.
 *
 * Loads the two tournament JOGOS CSVs, the corrected expected M ranking, runs the pure
 * PointsCalculator over both tournaments, aggregates per-player (M gender only), and prints a
 * diff against the expected totals. No DB needed.
 *
 * Run from backend/: node scripts/verify-points.js
 */

const fs = require('fs');
const path = require('path');
const PointsCalculator = require('../src/services/PointsCalculator');
const { lookupPoints } = require('../src/services/PointsData2025');

const CLASSIFICACAO_DIR = path.resolve(__dirname, '..', '..', 'classificacao');

const TOURNAMENTS = [
  {
    file: 'BT4500 PRATA 10-11 MAIO - Jogos.csv',
    tier: 'PRATA',
    season: 2025,
    column: '10-11 Maio',
  },
  {
    file: 'BT4500 BRONZE 21-22 JUNHO - Jogos (1).csv',
    tier: 'BRONZE',
    season: 2025,
    column: '21-22 Junho',
  },
];

const EXPECTED_FILE = '2025_BT4500_CLASSIFICAÇÃO - Cópia de M.csv';

// Player-name aliases: matches CSV → expected CSV
const NAME_ALIASES = new Map([
  ['Pascal Bihan', 'Pascal Le Bihan'],
  ['José Barbosa', 'José Pedro Barbosa'],
  ['Caio Junior', 'Caio Júnior'],
  ['Carlos Lopes', 'Carlos Bettencourt Lopes'],
  ['Italo Souza', 'Ítalo Roberto'],
  ['Rui Silva', 'Rui Pereira da Silva'],
  ['Helder Maia', 'Hélder Maia'],
  ['Rodrigo Nascimento', 'Rodrigo Diniz'],   // user's expected lists this player as "Rodrigo Diniz"
]);

function canonicalName(name) {
  const trimmed = name.trim();
  return NAME_ALIASES.get(trimmed) ?? trimmed;
}

// ---- CSV parsing ----

function parseCSV(text) {
  // Simple comma-split; fields don't contain commas in this dataset.
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',');
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = (cells[j] ?? '').trim();
    }
    rows.push(row);
  }
  return rows;
}

function parseScore(scoreStr) {
  if (!scoreStr) return [];
  const trimmed = scoreStr.trim();
  if (trimmed === '' || /^W\.O\.?$/i.test(trimmed) || /Desist/i.test(trimmed)) return [];
  const sets = [];
  const tokens = trimmed.split(/\s+/);
  for (const tok of tokens) {
    const m = tok.match(/^(\d+)(?:\(\d+\))?\/(\d+)(?:\(\d+\))?$/);
    if (m) sets.push({ t1: parseInt(m[1], 10), t2: parseInt(m[2], 10) });
  }
  return sets;
}

// e.g. "M1 - Pares Masculinos Nível 1" → { genderCode: 'M', subCode: 'M1', level: 1 }
function parseCategoria(categoria) {
  const m = categoria.match(/^([A-Z]+)(\d)\b/);
  if (!m) return null;
  const subCode = `${m[1]}${m[2]}`;     // M1, M2, F1, F2, MX1, MX2
  const genderCode = m[1];               // M, F, MX
  const levelMatch = categoria.match(/N[íi]vel\s*(\d)/i);
  const level = levelMatch ? parseInt(levelMatch[1], 10) : parseInt(m[2], 10);
  return { genderCode, subCode, level };
}

// Convert "Nuno Silva / Sérgio Silva" → ["Nuno Silva", "Sérgio Silva"]
function parsePlayers(s) {
  return s.split('/').map(p => p.trim()).filter(p => p.length > 0);
}

// Stable team id from sorted player names so partner order doesn't matter.
function teamIdOf(players) {
  return [...players].map(canonicalName).sort().join(' & ');
}

// Build the match list for a tournament file.
function buildTournamentMatches(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const rows = parseCSV(text);

  // Each match becomes: { categoryKey, subCode, level, round, team1Id, team2Id, winnerTeamId, sets, players }
  const matches = [];
  // Also track which players belong to which team
  const teamPlayers = new Map(); // teamId → [players]

  for (const row of rows) {
    const cat = parseCategoria(row['CATEGORIA']);
    if (!cat) continue;
    const players1 = parsePlayers(row['JOGADOR(ES) 01']);
    const players2 = parsePlayers(row['JOGADOR(ES) 02']);
    if (players1.length === 0 || players2.length === 0) continue;

    const team1Id = teamIdOf(players1);
    const team2Id = teamIdOf(players2);
    teamPlayers.set(team1Id, players1.map(canonicalName));
    teamPlayers.set(team2Id, players2.map(canonicalName));

    const winnerStr = (row['VENCEDOR(ES)'] || '').trim();
    let winnerTeamId = null;
    if (winnerStr) {
      const winnerPlayers = parsePlayers(winnerStr);
      const wid = teamIdOf(winnerPlayers);
      if (wid === team1Id) winnerTeamId = team1Id;
      else if (wid === team2Id) winnerTeamId = team2Id;
    }

    const sets = parseScore(row['RESULTADO']);

    matches.push({
      subCode: cat.subCode,
      genderCode: cat.genderCode,
      level: cat.level,
      categoryKey: `${cat.subCode}-N${cat.level}`,
      round: row['FASE'],
      team1Id, team2Id, winnerTeamId,
      sets,
    });
  }

  return { matches, teamPlayers };
}

// ---- Per-tournament calculation ----

function calculateTournament(filePath, season, tier) {
  const { matches, teamPlayers } = buildTournamentMatches(filePath);

  // Group matches by category
  const byCategory = new Map();
  for (const m of matches) {
    if (!byCategory.has(m.categoryKey)) byCategory.set(m.categoryKey, []);
    byCategory.get(m.categoryKey).push(m);
  }

  // Run calculator per category
  // Result: Map<teamId, { categoryKey, genderCode, level, classId, points, wins, losses, result }>
  const teamResults = new Map();
  for (const [categoryKey, catMatches] of byCategory) {
    const sample = catMatches[0];
    const level = sample.level;
    const genderCode = sample.genderCode;

    // The PointsCalculator only needs match data; group assignments inferred from match.round
    const perTeam = PointsCalculator.awardCategoryPoints(
      catMatches, season, tier, level, lookupPoints
    );

    for (const [teamId, r] of perTeam) {
      teamResults.set(`${categoryKey}|${teamId}`, {
        categoryKey, genderCode, level,
        teamId,
        ...r,
      });
    }
  }

  return { teamResults, teamPlayers };
}

// ---- Player aggregation (M gender only) ----

function aggregatePlayerPoints(tournamentResults, gender = 'M') {
  // tournamentResults: Array<{ tier, column, teamResults, teamPlayers }>
  // Returns: Map<playerName, { byTournament: Map<column, points>, total }>
  const players = new Map();

  function ensure(name) {
    if (!players.has(name)) {
      players.set(name, { byTournament: new Map(), total: 0, breakdown: [] });
    }
    return players.get(name);
  }

  for (const tr of tournamentResults) {
    const { column, teamResults, teamPlayers } = tr;
    for (const r of teamResults.values()) {
      if (r.genderCode !== gender) continue;
      const players_ = teamPlayers.get(r.teamId) || [];
      for (const p of players_) {
        const rec = ensure(p);
        rec.total += r.points;
        rec.byTournament.set(column,
          (rec.byTournament.get(column) || 0) + r.points
        );
        rec.breakdown.push({
          tournament: column,
          category: r.categoryKey,
          classId: r.classId,
          points: r.points,
          result: r.result,
          position: r.position,
          groupName: r.groupName,
          wins: r.wins,
          losses: r.losses,
        });
      }
    }
  }

  return players;
}

// ---- Expected file ----

function loadExpected(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split(/\r?\n/);
  const expected = new Map(); // name → { '10-11 Maio': n, '21-22 Junho': n, total: n }
  // Header: "Nome\t10-11 Maio\t21-22 Junho\tTotal"  — separator may be tab OR commas; detect.
  const sep = lines[0].includes('\t') ? '\t' : ',';
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(sep);
    if (cells.length < 4) continue;
    const name = cells[0].trim();
    if (!name) continue;
    const maio = parseInt(cells[1].trim(), 10) || 0;
    const junho = parseInt(cells[2].trim(), 10) || 0;
    const total = parseInt(cells[3].trim(), 10) || 0;
    expected.set(name, { maio, junho, total });
  }
  return expected;
}

// ---- Diff ----

function pad(s, n) { s = String(s); return s.length >= n ? s : s + ' '.repeat(n - s.length); }
function padL(s, n) { s = String(s); return s.length >= n ? s : ' '.repeat(n - s.length) + s; }

function diff(actual, expected) {
  const allNames = new Set([...actual.keys(), ...expected.keys()]);
  const sorted = [...allNames].sort();

  const headerLine = `${pad('Player', 32)} ${padL('Maio Exp', 10)} ${padL('Maio Act', 10)} ${padL('Junho Exp', 10)} ${padL('Junho Act', 10)} ${padL('Δ Tot', 8)} ${pad('Status', 8)}`;
  console.log(headerLine);
  console.log('-'.repeat(headerLine.length));

  const mismatches = [];
  for (const name of sorted) {
    const a = actual.get(name);
    const e = expected.get(name);
    const aMaio = a?.byTournament.get('10-11 Maio') || 0;
    const aJunho = a?.byTournament.get('21-22 Junho') || 0;
    const aTotal = a?.total || 0;
    const eMaio = e?.maio || 0;
    const eJunho = e?.junho || 0;
    const eTotal = e?.total || 0;
    const dTotal = aTotal - eTotal;

    if (dTotal === 0 && (aMaio === eMaio || (e === undefined && aTotal === 0)) && aJunho === eJunho) {
      continue; // exact match — skip from diff output
    }
    const status = dTotal === 0 ? '~match' : (dTotal > 0 ? `+${dTotal}` : `${dTotal}`);
    console.log(`${pad(name, 32)} ${padL(eMaio, 10)} ${padL(aMaio, 10)} ${padL(eJunho, 10)} ${padL(aJunho, 10)} ${padL(status, 8)} ${pad(a ? '' : 'NEW', 8)}`);
    mismatches.push({ name, actual: a, expected: e, dTotal });
  }

  return mismatches;
}

// ---- Main ----

function main() {
  const expectedPath = path.join(CLASSIFICACAO_DIR, EXPECTED_FILE);
  const expected = loadExpected(expectedPath);

  const tournamentResults = [];
  for (const t of TOURNAMENTS) {
    const filePath = path.join(CLASSIFICACAO_DIR, t.file);
    const { teamResults, teamPlayers } = calculateTournament(filePath, t.season, t.tier);
    tournamentResults.push({ ...t, teamResults, teamPlayers });
    console.log(`Loaded ${t.file}: ${teamResults.size} team-results across all categories`);
  }

  const playerPoints = aggregatePlayerPoints(tournamentResults, 'M');

  // Print non-matching rows
  console.log('\n=== Discrepancies (Calculator vs Expected file, M ranking) ===\n');
  const mismatches = diff(playerPoints, expected);

  console.log(`\n${mismatches.length} mismatched rows.\n`);

  // For each mismatch, print breakdown
  if (process.argv.includes('--verbose')) {
    console.log('\n=== Breakdown for mismatches ===\n');
    for (const m of mismatches) {
      console.log(`\n${m.name}: actual ${m.actual?.total ?? 0}, expected ${m.expected?.total ?? 0} (Δ ${m.dTotal})`);
      if (m.actual) {
        for (const b of m.actual.breakdown) {
          console.log(`  • ${b.tournament} ${b.category} ${b.groupName ? `g=${b.groupName}` : ''} pos=${b.position ?? '-'} w=${b.wins}/${b.losses} classId=${b.classId} pts=${b.points} (${b.result})`);
        }
      }
    }
  }
}

main();
