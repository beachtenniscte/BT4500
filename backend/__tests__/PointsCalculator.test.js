/**
 * Unit tests for the pure PointsCalculator. Run with:
 *   node --test backend/__tests__/PointsCalculator.test.js
 * (Node ≥ 18 has the built-in test runner; no devDependency needed.)
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const PC = require('../src/services/PointsCalculator');
const { lookupPoints } = require('../src/services/PointsData2025');

// ---- Helpers for building matches succinctly ----

function group(round, t1, t2, winner, sets = []) {
  return { team1Id: t1, team2Id: t2, winnerTeamId: winner, round, sets };
}

const G1 = (t1, t2, winner, sets) => group('Fase de grupos - G1', t1, t2, winner, sets);
const G2 = (t1, t2, winner, sets) => group('Fase de grupos - G2', t1, t2, winner, sets);
const G3 = (t1, t2, winner, sets) => group('Fase de grupos - G3', t1, t2, winner, sets);
const SF = (t1, t2, winner, sets) => group('Semifinal', t1, t2, winner, sets);
const FINAL = (t1, t2, winner, sets) => group('Final', t1, t2, winner, sets);

// ---- Tiebreaker tests ----

test('2-way tie: head-to-head decides', () => {
  // A and B both have 1 win, A beat B → A first
  const matches = [
    G1('A', 'B', 'A', [{ t1: 6, t2: 4 }, { t1: 6, t2: 4 }]),
    G1('A', 'C', 'C', [{ t1: 0, t2: 6 }, { t1: 0, t2: 6 }]),
    G1('B', 'C', 'C', [{ t1: 0, t2: 6 }, { t1: 0, t2: 6 }]),
  ];
  const stats = [...PC.buildTeamStats(matches).values()];
  const ranked = PC.rankStandings(stats);
  assert.equal(ranked[0].teamId, 'C', 'C with 2 wins is first');
  // A and B both 1W. A beat B → A is 2nd.
  assert.equal(ranked[1].teamId, 'A', 'A is 2nd by H2H');
  assert.equal(ranked[2].teamId, 'B', 'B is 3rd');
});

test('3-way circular H2H: resolved by game diff (skip H2H)', () => {
  // F beat J, A beat F, J beat A — circular; all 1-1-1, set diff 0.
  // F: gW = 6+6+3+5 = 20, gL = 3+0+6+7 = 16  → +4
  // A: gW = 6+7+3+5 = 21, gL = 3+5+6+7 = 21  ← let me recompute: vs F won 6/3 7/5, vs J lost 3-6 0-6 = 3+0=3w / 6+6=12L; total 13W+3L=16, 8L+12L=20, +-4? Let me use specific scenarios from Junho M1 N1 G2.
  const matches = [
    G2('F', 'J', 'F', [{ t1: 6, t2: 3 }, { t1: 6, t2: 0 }]),    // F beat J 12-3
    G2('A', 'F', 'A', [{ t1: 6, t2: 3 }, { t1: 7, t2: 5 }]),    // A beat F 13-8
    G2('J', 'A', 'J', [{ t1: 7, t2: 6 }, { t1: 7, t2: 6 }]),    // J beat A 14-12
  ];
  // F: 6+6=12 W, 3+0=3 L  vs J ; 3+5=8 W, 6+7=13 L vs A → 20W, 16L, gameDiff +4
  // A: 6+7=13 W, 3+5=8 L vs F ; 6+6=12 W, 7+7=14 L vs J → 25W, 22L, gameDiff +3
  // J: 7+7=14 W, 6+6=12 L vs A ; 3+0=3 W, 6+6=12 L vs F → 17W, 24L, gameDiff -7
  const stats = [...PC.buildTeamStats(matches).values()];
  const ranked = PC.rankStandings(stats);
  assert.deepEqual(ranked.map(t => t.teamId), ['F', 'A', 'J'],
    'Circular H2H resolved by game diff: F (+4) > A (+3) > J (-7)');
});

test('clear ranking by wins (no tiebreak needed)', () => {
  const matches = [
    G1('X', 'Y', 'X', [{ t1: 6, t2: 0 }]),
    G1('X', 'Z', 'X', [{ t1: 6, t2: 0 }]),
    G1('Y', 'Z', 'Y', [{ t1: 6, t2: 0 }]),
  ];
  const ranked = PC.rankStandings([...PC.buildTeamStats(matches).values()]);
  assert.equal(ranked[0].teamId, 'X');
  assert.equal(ranked[1].teamId, 'Y');
  assert.equal(ranked[2].teamId, 'Z');
});

// ---- Classification tests ----

test('classifyGroupPosition: 0 wins always ULT (group+playoff)', () => {
  const r = PC.classifyGroupPosition(3, 3, 0, false, true);
  assert.equal(r.classId, 6);
});

test('classifyGroupPosition: last in 4-team group with 1W → ULT (group+playoff)', () => {
  const r = PC.classifyGroupPosition(4, 4, 1, false, true);
  assert.equal(r.classId, 6, '4th in 4-team with 1W is still ULT (Maio M2 N2 G3 D/J case)');
});

test('classifyGroupPosition: last in 3-team group with 1W → PEN (group+playoff)', () => {
  const r = PC.classifyGroupPosition(3, 3, 1, false, true);
  assert.equal(r.classId, 5, '3rd in 3-team group with 1W is PEN (Junho M1 N1 G2 J.Santos case)');
});

test('classifyGroupPosition: 2nd in 4-team group not advancing → 2ºG (4)', () => {
  const r = PC.classifyGroupPosition(2, 4, 2, false, true);
  assert.equal(r.classId, 4);
});

test('classifyGroupPosition: 2nd in 4-team group as best 2nd → temp Finalist (2)', () => {
  const r = PC.classifyGroupPosition(2, 4, 2, true, true);
  assert.equal(r.classId, 2);
});

test('classifyGroupPosition: 2nd in 3-team group not advancing → PEN (5)', () => {
  const r = PC.classifyGroupPosition(2, 3, 1, false, true);
  assert.equal(r.classId, 5, 'Junho M1 N1 G1 Sérgio/Nuno case');
});

test('classifyGroupPosition: 3rd in 4-team group with 1W → PEN (5)', () => {
  const r = PC.classifyGroupPosition(3, 4, 1, false, true);
  assert.equal(r.classId, 5, 'Junho M1 N1 G3 A.Martins/E.Diniz case');
});

test('classifyGroupPosition: position 1 → temp Finalist (overridden by playoff)', () => {
  const r = PC.classifyGroupPosition(1, 3, 2, false, true);
  assert.equal(r.classId, 2);
});

// ---- End-to-end on Junho M1 N1 (10 teams, 1G4+2G3) ----

test('Junho M1 N1: full bracket reproduces expected classIds and points', () => {
  // Teams (deterministic ids)
  const RR = 'Ricardo/Rui', NS = 'Nuno/Sérgio', JM = 'João/Maurício';
  const FP = 'Fábio/Paulo', AC = 'Arlindo/Carlos', JS = 'JoãoS/Miguel';
  const CW = 'Caio/Wellington', DL = 'Daniel/Lourenço', AE = 'António/Eduardo', AN = 'André/NunoR';

  const matches = [
    // G1 (3 teams)
    G1(NS, JM, NS, [{ t1: 6, t2: 1 }, { t1: 4, t2: 6 }, { t1: 10, t2: 6 }]),
    G1(JM, RR, RR, [{ t1: 3, t2: 6 }, { t1: 4, t2: 6 }]),
    G1(RR, NS, RR, [{ t1: 6, t2: 2 }, { t1: 6, t2: 1 }]),

    // G2 (3 teams, 1-1-1 circular)
    G2(JS, FP, FP, [{ t1: 3, t2: 6 }, { t1: 0, t2: 6 }]),
    G2(FP, AC, AC, [{ t1: 3, t2: 6 }, { t1: 5, t2: 7 }]),
    G2(AC, JS, JS, [{ t1: 6, t2: 7 }, { t1: 6, t2: 7 }]),

    // G3 (4 teams)
    G3(CW, AE, CW, [{ t1: 6, t2: 2 }, { t1: 6, t2: 4 }]),
    G3(DL, AN, DL, [{ t1: 6, t2: 2 }, { t1: 6, t2: 2 }]),
    G3(CW, DL, CW, [{ t1: 3, t2: 6 }, { t1: 7, t2: 6 }, { t1: 10, t2: 5 }]),
    G3(AE, AN, AE, [{ t1: 6, t2: 2 }, { t1: 4, t2: 6 }, { t1: 10, t2: 4 }]),
    G3(DL, AE, DL, [{ t1: 6, t2: 2 }, { t1: 7, t2: 5 }]),
    G3(AN, CW, CW, [{ t1: 3, t2: 6 }, { t1: 7, t2: 5 }, { t1: 3, t2: 10 }]),

    // SF: best 2nd from G3 (Daniel/Lourenço, 2W) advances. SFs:
    SF(RR, DL, RR, [{ t1: 6, t2: 2 }, { t1: 6, t2: 3 }]),
    SF(FP, CW, FP, [{ t1: 7, t2: 5 }, { t1: 6, t2: 4 }]),
    // Final
    FINAL(RR, FP, RR, [{ t1: 6, t2: 1 }, { t1: 6, t2: 3 }]),
  ];

  const out = PC.awardCategoryPoints(matches, 2025, 'BRONZE', 1, lookupPoints);

  // Expected: BRONZE × N1 lookup
  // RR (winner)             classId 1 → 375
  // FP (finalist)            classId 2 → 250
  // CW (SF lost)             classId 3 → 167
  // DL (best 2nd → SF lost)  classId 3 → 167
  // NS (G1 2nd, 1W)          classId 5 → 74
  // AC (G2 2nd by tiebreak)  classId 5 → 74
  // JS (G2 3rd, 1W tied last)classId 5 → 74
  // AE (G3 3rd, 1W)          classId 5 → 74
  // JM (G1 last, 0W)         classId 6 → 15
  // AN (G3 4th, 0W)          classId 6 → 15
  assert.equal(out.get(RR).classId, 1, 'Ricardo/Rui = winner');
  assert.equal(out.get(RR).points, 375);
  assert.equal(out.get(FP).classId, 2, 'Fábio/Paulo = finalist');
  assert.equal(out.get(FP).points, 250);
  assert.equal(out.get(CW).classId, 3, 'Caio/Wellington = SF lost');
  assert.equal(out.get(CW).points, 167);
  assert.equal(out.get(DL).classId, 3, 'Daniel/Lourenço = SF lost (best 2nd)');
  assert.equal(out.get(DL).points, 167);
  assert.equal(out.get(NS).classId, 5, 'Nuno/Sérgio = PEN (3-team group 2nd not advancing)');
  assert.equal(out.get(NS).points, 74);
  assert.equal(out.get(AC).classId, 5, 'Arlindo/Carlos = PEN (3-team G2 2nd by tiebreak)');
  assert.equal(out.get(AC).points, 74);
  assert.equal(out.get(JS).classId, 5, 'João/Miguel = PEN (3-team last with 1W)');
  assert.equal(out.get(JS).points, 74);
  assert.equal(out.get(AE).classId, 5, 'António/Eduardo = PEN (4-team 3rd with 1W)');
  assert.equal(out.get(AE).points, 74);
  assert.equal(out.get(JM).classId, 6, 'João/Maurício = ULT (0W)');
  assert.equal(out.get(JM).points, 15);
  assert.equal(out.get(AN).classId, 6, 'André/Nuno R = ULT (0W)');
  assert.equal(out.get(AN).points, 15);
});

// ---- End-to-end: M2 N2 7-team format (1G3 + 1G4 + Final, no SF) ----

test('Junho M2 N2: 1G3+1G4+Final, last-in-4-team-group rule applies', () => {
  // G1 (3 teams)
  const AR = 'Arménio/RuiSilva', FB = 'Fábio/Beijoco', HP = 'Helder/Pedro';
  // G2 (4 teams)
  const CV = 'Caio/Vasco', CL = 'Carlos/Osório', JT = 'JoãoM/Tiago', CP = 'Camilo/Pascal';

  const matches = [
    // G1
    G1(AR, FB, AR, [{ t1: 1, t2: 6 }, { t1: 6, t2: 2 }, { t1: 10, t2: 8 }]),
    G1(FB, HP, FB, [{ t1: 7, t2: 5 }, { t1: 6, t2: 1 }]),
    G1(HP, AR, AR, [{ t1: 5, t2: 7 }, { t1: 1, t2: 6 }]),
    // G2
    G2(CL, CP, CL, [{ t1: 6, t2: 2 }, { t1: 6, t2: 4 }]),
    G2(JT, CV, CV, [{ t1: 3, t2: 6 }, { t1: 5, t2: 7 }]),
    G2(CL, JT, CL, [{ t1: 6, t2: 1 }, { t1: 6, t2: 1 }]),
    G2(CP, CV, CV, [{ t1: 6, t2: 4 }, { t1: 4, t2: 6 }, { t1: 8, t2: 10 }]),
    G2(JT, CP, JT, [{ t1: 6, t2: 7 }, { t1: 6, t2: 1 }, { t1: 10, t2: 5 }]),
    G2(CV, CL, CV, [{ t1: 6, t2: 4 }, { t1: 0, t2: 6 }, { t1: 17, t2: 15 }]),
    // Final (no SF)
    FINAL(CV, AR, CV, [{ t1: 6, t2: 3 }]),
  ];

  const out = PC.awardCategoryPoints(matches, 2025, 'BRONZE', 2, lookupPoints);

  // Expected (BRONZE × N2):
  //  CV (winner)           classId 1 → 111
  //  AR (finalist)         classId 2 → 74
  //  CL (G2 2nd, 4-team)   classId 4 → 33     (2ºG)
  //  JT (G2 3rd, 1W)       classId 5 → 22     (PEN)
  //  CP (G2 4th, 0W)       classId 6 → 15     (ULT)
  //  FB (G1 2nd, 1W)       classId 5 → 22     (PEN, 3-team)
  //  HP (G1 3rd, 0W)       classId 6 → 15
  assert.equal(out.get(CV).classId, 1);  assert.equal(out.get(CV).points, 111);
  assert.equal(out.get(AR).classId, 2);  assert.equal(out.get(AR).points, 74);
  assert.equal(out.get(CL).classId, 4);  assert.equal(out.get(CL).points, 33);
  assert.equal(out.get(JT).classId, 5);  assert.equal(out.get(JT).points, 22);
  assert.equal(out.get(CP).classId, 6);  assert.equal(out.get(CP).points, 15);
  assert.equal(out.get(FB).classId, 5);  assert.equal(out.get(FB).points, 22);
  assert.equal(out.get(HP).classId, 6);  assert.equal(out.get(HP).points, 15);
});

// ---- End-to-end: elimination format ----

test('Elimination: 0-wins first-round losers → ULT (15)', () => {
  const matches = [
    { round: 'R32', team1Id: 'A', team2Id: 'B', winnerTeamId: 'A', sets: [{ t1: 6, t2: 0 }] },
    { round: 'R16', team1Id: 'A', team2Id: 'C', winnerTeamId: 'A', sets: [{ t1: 6, t2: 0 }] },
    { round: 'R16', team1Id: 'D', team2Id: 'E', winnerTeamId: 'D', sets: [{ t1: 6, t2: 0 }] },
    { round: 'R16', team1Id: 'H', team2Id: 'I', winnerTeamId: 'H', sets: [{ t1: 6, t2: 0 }] },
    { round: 'Quartas de Final', team1Id: 'A', team2Id: 'D', winnerTeamId: 'A', sets: [{ t1: 6, t2: 0 }] },
    { round: 'Quartas de Final', team1Id: 'F', team2Id: 'G', winnerTeamId: 'F', sets: [{ t1: 6, t2: 0 }] },
    { round: 'Quartas de Final', team1Id: 'H', team2Id: 'J', winnerTeamId: 'H', sets: [{ t1: 6, t2: 0 }] },
    { round: 'Semifinal', team1Id: 'A', team2Id: 'F', winnerTeamId: 'A', sets: [{ t1: 6, t2: 0 }] },
    { round: 'Semifinal', team1Id: 'H', team2Id: 'K', winnerTeamId: 'H', sets: [{ t1: 6, t2: 0 }] },
    { round: 'Final', team1Id: 'A', team2Id: 'H', winnerTeamId: 'A', sets: [{ t1: 6, t2: 0 }] },
  ];
  const out = PC.awardCategoryPoints(matches, 2025, 'PRATA', 1, lookupPoints);

  assert.equal(out.get('A').classId, 1, 'A is winner');     // 750
  assert.equal(out.get('A').points, 750);
  assert.equal(out.get('H').classId, 2, 'H is finalist');   // 500
  assert.equal(out.get('H').points, 500);
  assert.equal(out.get('F').classId, 3, 'F lost SF (1+ wins)');
  assert.equal(out.get('F').points, 333);
  assert.equal(out.get('D').classId, 4, 'D lost QF (1 win from R16)');
  assert.equal(out.get('D').points, 222);
  assert.equal(out.get('B').classId, 6, 'B lost R32 with 0 wins → ULT');
  assert.equal(out.get('B').points, 15);
  assert.equal(out.get('C').classId, 6, 'C lost R16 with 0 wins → ULT');
  assert.equal(out.get('C').points, 15);
  assert.equal(out.get('E').classId, 6, 'E lost R16 with 0 wins → ULT');
  assert.equal(out.get('E').points, 15);
  assert.equal(out.get('G').classId, 6, 'G lost QF with 0 wins → ULT');
  assert.equal(out.get('G').points, 15);
});

// ---- Single-group format ----

test('Single group 1G5: position-based classification, no playoff', () => {
  const matches = [
    { round: 'Fase de grupos', team1Id: 'A', team2Id: 'B', winnerTeamId: 'A', sets: [{ t1: 6, t2: 0 }] },
    { round: 'Fase de grupos', team1Id: 'A', team2Id: 'C', winnerTeamId: 'A', sets: [{ t1: 6, t2: 0 }] },
    { round: 'Fase de grupos', team1Id: 'A', team2Id: 'D', winnerTeamId: 'A', sets: [{ t1: 6, t2: 0 }] },
    { round: 'Fase de grupos', team1Id: 'A', team2Id: 'E', winnerTeamId: 'A', sets: [{ t1: 6, t2: 0 }] },
    { round: 'Fase de grupos', team1Id: 'B', team2Id: 'C', winnerTeamId: 'B', sets: [{ t1: 6, t2: 0 }] },
    { round: 'Fase de grupos', team1Id: 'B', team2Id: 'D', winnerTeamId: 'B', sets: [{ t1: 6, t2: 0 }] },
    { round: 'Fase de grupos', team1Id: 'B', team2Id: 'E', winnerTeamId: 'B', sets: [{ t1: 6, t2: 0 }] },
    { round: 'Fase de grupos', team1Id: 'C', team2Id: 'D', winnerTeamId: 'C', sets: [{ t1: 6, t2: 0 }] },
    { round: 'Fase de grupos', team1Id: 'C', team2Id: 'E', winnerTeamId: 'C', sets: [{ t1: 6, t2: 0 }] },
    { round: 'Fase de grupos', team1Id: 'D', team2Id: 'E', winnerTeamId: 'D', sets: [{ t1: 6, t2: 0 }] },
  ];
  const out = PC.awardCategoryPoints(matches, 2025, 'BRONZE', 1, lookupPoints);
  assert.equal(out.get('A').classId, 1);  // 1st group → 375
  assert.equal(out.get('A').points, 375);
  assert.equal(out.get('B').classId, 2);  // 2nd → 250
  assert.equal(out.get('C').classId, 3);  // 3rd → 167
  assert.equal(out.get('D').classId, 4);  // penultimate → 111
  assert.equal(out.get('E').classId, 6);  // last (0W) → 15
});
