/**
 * Pure points-calculation logic, extracted from PointsService for testability.
 * No DB calls, no caches with TTL — points lookup is injected.
 *
 * Conventions (confirmed with user):
 * - Tiebreakers: wins → H2H (skip if circular among ≥3 teams) → setDiff → gameDiff → gamesWon
 * - 0 wins → ULTIMO (classId 6), regardless of format
 * - Unified group classification: 2ºG=4 only for 2nd in a 4-team group not advancing,
 *   PEN=5 for all other non-advancing teams with ≥1 win, ULT=6 for 0-win teams
 * - For BRONZE tier with 6+ teams, format follows N2 spec (group + playoff) regardless of
 *   category.level. Points lookup uses (season, tier, category.level, classId).
 */

const ELIMINATION_ROUND_TO_CLASSID = {
  final: 1,                   // winner
  'final loser': 2,           // loser of the final
  semifinal: 3,
  sf: 3,
  'quartas de final': 4,
  qf: 4,
  r16: 5,
  r32: 6,
};

function detectFormat(matches) {
  let hasGroupStage = false;
  let hasFinal = false;
  let hasElimination = false;
  const groupNames = new Set();

  for (const m of matches) {
    if (!m.round) continue;
    const r = m.round.toLowerCase();
    if (r.includes('fase de grupos') || r.includes('grupo')) {
      hasGroupStage = true;
      const g = m.round.match(/G(\d+)/i);
      if (g) groupNames.add(g[1]);
    }
    if (r === 'final' || (r.includes('final') && !r.includes('semi') && !r.includes('quartas'))) {
      hasFinal = true;
    }
    if (r.includes('r16') || r.includes('r32') || r.includes('quartas')) hasElimination = true;
  }

  if (hasGroupStage && (hasFinal || hasElimination)) {
    return { kind: 'groups_with_playoff', groupCount: groupNames.size };
  }
  if (hasGroupStage) {
    return { kind: 'single_group', groupCount: groupNames.size };
  }
  if (hasElimination || hasFinal) {
    return { kind: 'elimination', groupCount: 0 };
  }
  return { kind: 'unknown', groupCount: 0 };
}

function isFinalRound(round) {
  if (!round) return false;
  const r = round.toLowerCase();
  return r === 'final' || (r.includes('final') && !r.includes('semi') && !r.includes('quartas'));
}

function isSemifinalRound(round) {
  if (!round) return false;
  const r = round.toLowerCase();
  return r.includes('semifinal') || r === 'sf';
}

function isGroupRound(round) {
  if (!round) return false;
  const r = round.toLowerCase();
  return r.includes('fase de grupos') || (r.includes('grupo') && !r.includes('quartas'));
}

function extractGroupName(round) {
  if (!round) return null;
  const m = round.match(/G(\d+)/i);
  return m ? `G${m[1]}` : null;
}

/**
 * Build per-team stats from a list of matches (already restricted to one group / one category).
 * Walkovers: counted as a 1-set 6-0 win for the winner if no scores present (so set/game diffs aren't zero).
 */
function buildTeamStats(matches) {
  const stats = new Map();

  function ensure(teamId) {
    if (!stats.has(teamId)) {
      stats.set(teamId, {
        teamId,
        wins: 0, losses: 0,
        setsWon: 0, setsLost: 0,
        gamesWon: 0, gamesLost: 0,
        h2h: new Map(),
      });
    }
    return stats.get(teamId);
  }

  for (const m of matches) {
    if (!m.team1Id || !m.team2Id || !m.winnerTeamId) continue;
    const t1 = ensure(m.team1Id);
    const t2 = ensure(m.team2Id);
    const winnerStats = m.winnerTeamId === m.team1Id ? t1 : t2;
    const loserStats = m.winnerTeamId === m.team1Id ? t2 : t1;

    winnerStats.wins++;
    loserStats.losses++;
    winnerStats.h2h.set(loserStats.teamId, 1);
    loserStats.h2h.set(winnerStats.teamId, -1);

    const sets = m.sets || [];
    if (sets.length === 0) {
      // Walkover with no recorded sets: give winner a notional 6-0 set so diffs aren't zero.
      // This is uncommon in fixtures we test, but matches the existing PointsService behaviour.
      winnerStats.setsWon++;
      loserStats.setsLost++;
      winnerStats.gamesWon += 6;
      loserStats.gamesLost += 6;
      continue;
    }
    for (const s of sets) {
      const a = s.t1 ?? 0;
      const b = s.t2 ?? 0;
      t1.gamesWon += a; t1.gamesLost += b;
      t2.gamesWon += b; t2.gamesLost += a;
      if (a > b) { t1.setsWon++; t2.setsLost++; }
      else if (b > a) { t2.setsWon++; t1.setsLost++; }
    }
  }

  return stats;
}

/**
 * Sort group standings using the spec tiebreakers.
 * If H2H among the tied teams is circular (≥3 teams, no team beat all the others in the tied set),
 * H2H is skipped and we fall through to setDiff/gameDiff/gamesWon.
 */
function rankStandings(teamStatsArray) {
  const all = [...teamStatsArray];

  // Group by wins (descending)
  all.sort((a, b) => b.wins - a.wins);

  const result = [];
  let i = 0;
  while (i < all.length) {
    let j = i;
    while (j < all.length && all[j].wins === all[i].wins) j++;
    const tieGroup = all.slice(i, j);
    const ordered = orderTieGroup(tieGroup);
    result.push(...ordered);
    i = j;
  }

  result.forEach((t, idx) => { t.position = idx + 1; });
  return result;
}

function orderTieGroup(group) {
  if (group.length === 1) return group;

  if (group.length === 2) {
    // 2-way tie: H2H decides if available, otherwise fall through
    const [a, b] = group;
    const h2hA = a.h2h.get(b.teamId);
    if (h2hA === 1) return [a, b];
    if (h2hA === -1) return [b, a];
    return secondaryTiebreak(group);
  }

  // ≥3-way tie: check for a transitive H2H ordering among the tied teams only.
  // For each team, count wins against the OTHER tied teams.
  const ids = new Set(group.map(t => t.teamId));
  const internalWins = new Map();
  for (const t of group) {
    let w = 0;
    for (const id of ids) {
      if (id === t.teamId) continue;
      if (t.h2h.get(id) === 1) w++;
    }
    internalWins.set(t.teamId, w);
  }

  // If exactly one team has more internal wins than all others, peel it off and recurse.
  // If the internalWins are all equal (circular), skip H2H and resolve by setDiff/gameDiff.
  const uniqueWinCounts = new Set(internalWins.values());
  if (uniqueWinCounts.size === 1) {
    // Circular — skip H2H entirely
    return secondaryTiebreak(group);
  }

  // Otherwise, partial H2H ordering: sort by internalWins desc, but break ties at each level
  // recursively (still using secondary if needed).
  const buckets = new Map();
  for (const t of group) {
    const w = internalWins.get(t.teamId);
    if (!buckets.has(w)) buckets.set(w, []);
    buckets.get(w).push(t);
  }
  const sortedKeys = [...buckets.keys()].sort((a, b) => b - a);
  const out = [];
  for (const k of sortedKeys) {
    const sub = buckets.get(k);
    out.push(...(sub.length > 1 ? orderTieGroup(sub) : sub));
  }
  return out;
}

function secondaryTiebreak(group) {
  const arr = [...group];
  arr.sort((a, b) => {
    const aSet = a.setsWon - a.setsLost;
    const bSet = b.setsWon - b.setsLost;
    if (bSet !== aSet) return bSet - aSet;
    const aGame = a.gamesWon - a.gamesLost;
    const bGame = b.gamesWon - b.gamesLost;
    if (bGame !== aGame) return bGame - aGame;
    return b.gamesWon - a.gamesWon;
  });
  return arr;
}

/**
 * Process elimination-format matches.
 * Returns Map<teamId, { classId, wins, losses, result }>
 */
function processElimination(matches) {
  const teamData = new Map();
  function ensure(teamId) {
    if (!teamData.has(teamId)) {
      teamData.set(teamId, { wins: 0, losses: 0, eliminationRound: null, isFinalWinner: false });
    }
    return teamData.get(teamId);
  }

  for (const m of matches) {
    if (!m.winnerTeamId) continue;
    const winner = ensure(m.winnerTeamId);
    const loserId = m.team1Id === m.winnerTeamId ? m.team2Id : m.team1Id;
    const loser = ensure(loserId);
    winner.wins++;
    loser.losses++;
    if (!loser.eliminationRound) loser.eliminationRound = m.round;
    if (isFinalRound(m.round)) {
      winner.isFinalWinner = true;
      loser.eliminationRound = 'Final';
    }
  }

  const out = new Map();
  for (const [teamId, d] of teamData) {
    let classId, result;
    if (d.isFinalWinner) {
      classId = 1; result = 'Campeão';
    } else if (d.wins === 0) {
      classId = 6; result = d.eliminationRound || '0 wins';
    } else {
      classId = classifyEliminationRound(d.eliminationRound);
      result = d.eliminationRound;
    }
    out.set(teamId, { classId, wins: d.wins, losses: d.losses, result });
  }
  return out;
}

function classifyEliminationRound(round) {
  if (!round) return 6;
  const r = round.toLowerCase();
  if (r === 'final' || (r.includes('final') && !r.includes('semi') && !r.includes('quartas'))) return 2;
  if (r.includes('semifinal') || r === 'sf') return 3;
  if (r.includes('quartas') || r === 'qf') return 4;
  if (r === 'r16') return 5;
  if (r === 'r32') return 6;
  return 6;
}

/**
 * Process groups + playoff format.
 * - matches: all matches for this category
 * - groupAssignments: optional Map<teamId, groupName> from registrations (used as fallback if not all
 *   teams played); if a team appears in matches its group is inferred from match.round.
 *
 * Returns Map<teamId, { classId, wins, losses, result, position, groupName }>.
 */
function processGroupsWithPlayoff(matches, groupAssignments = new Map()) {
  // Split matches into group / SF / final
  const groupMatches = matches.filter(m => isGroupRound(m.round));
  const sfMatches = matches.filter(m => isSemifinalRound(m.round));
  const finalMatches = matches.filter(m => isFinalRound(m.round));

  // Bucket group matches by group name
  const matchesByGroup = new Map();
  for (const m of groupMatches) {
    const g = extractGroupName(m.round) || 'G?';
    if (!matchesByGroup.has(g)) matchesByGroup.set(g, []);
    matchesByGroup.get(g).push(m);
  }

  // Compute standings per group
  const standingsByGroup = new Map();   // group -> ordered standings (with position)
  const teamGroup = new Map();          // teamId -> groupName
  for (const [g, ms] of matchesByGroup) {
    const stats = [...buildTeamStats(ms).values()];
    const ordered = rankStandings(stats);
    standingsByGroup.set(g, ordered);
    for (const t of ordered) teamGroup.set(t.teamId, g);
  }

  // Best 2nd (only when more than 2 groups, i.e., the format has SFs that absorb a wildcard)
  const numGroups = standingsByGroup.size;
  let best2ndTeamId = null;
  if (numGroups >= 3 && sfMatches.length > 0) {
    const seconds = [];
    for (const ordered of standingsByGroup.values()) {
      const second = ordered.find(t => t.position === 2);
      if (second) seconds.push(second);
    }
    if (seconds.length >= 2) {
      seconds.sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        const aSet = a.setsWon - a.setsLost;
        const bSet = b.setsWon - b.setsLost;
        if (bSet !== aSet) return bSet - aSet;
        const aGame = a.gamesWon - a.gamesLost;
        const bGame = b.gamesWon - b.gamesLost;
        if (bGame !== aGame) return bGame - aGame;
        return b.gamesWon - a.gamesWon;
      });
      best2ndTeamId = seconds[0].teamId;
    }
  }

  // Initial classification from group position (before playoff overrides)
  const result = new Map();
  // hasPlayoff is always true here — this function only runs when there's an SF or a Final.
  // The no-playoff branch in classifyGroupPosition is reserved for processSingleGroup.
  for (const [g, ordered] of standingsByGroup) {
    const groupSize = ordered.length;
    for (const t of ordered) {
      const isBest2nd = t.teamId === best2ndTeamId;
      const cls = classifyGroupPosition(t.position, groupSize, t.wins, isBest2nd, true);
      result.set(t.teamId, {
        classId: cls.classId,
        wins: t.wins, losses: t.losses,
        result: cls.result,
        position: t.position,
        groupName: g,
      });
    }
  }

  // Apply SF overrides: SF losers → classId 3
  for (const m of sfMatches) {
    if (!m.winnerTeamId) continue;
    const loserId = m.team1Id === m.winnerTeamId ? m.team2Id : m.team1Id;
    if (result.has(loserId)) {
      const r = result.get(loserId);
      r.classId = 3;
      r.result = 'Semifinal';
    }
    if (result.has(m.winnerTeamId)) {
      const r = result.get(m.winnerTeamId);
      // SF winners go to Final — temp classId 2 (Finalist), updated by Final result below
      r.classId = 2;
      r.result = 'Finalista';
    }
  }

  // Apply Final overrides: winner → 1, loser → 2
  for (const m of finalMatches) {
    if (!m.winnerTeamId) continue;
    const loserId = m.team1Id === m.winnerTeamId ? m.team2Id : m.team1Id;
    if (result.has(m.winnerTeamId)) {
      const r = result.get(m.winnerTeamId);
      r.classId = 1; r.result = 'Campeão';
    }
    if (result.has(loserId)) {
      const r = result.get(loserId);
      r.classId = 2; r.result = 'Final';
    }
  }

  return result;
}

/**
 * Classify a team's group-stage position.
 * Position 1 always advances (initial classId is 2 = Finalist; final classId set by playoff results).
 * Position 2 + isBest2nd advances (initial classId is 2; final set by SF/Final results).
 *
 * Otherwise, the unified rule:
 *   wins === 0 → ULTIMO (6)
 *   position === 2 && groupSize === 4 → 2ºG (4)
 *   else → PEN (5)
 *
 * If the format has NO playoff (no SFs, no Final), e.g. single 1G3/1G4/1G5: 1st = 1, 2nd = 2, etc.
 * That branch is handled separately by the caller.
 */
function classifyGroupPosition(position, groupSize, wins, isBest2nd, hasPlayoff) {
  // Rule observed in user's expected data:
  //   • 0 wins → ULT (6) regardless of group size
  //   • Last position in a 4+ team group → ULT (6) even with 1+ wins
  //     (e.g. Daniel Mallmann/Juan Vasconcellos, 4th in Maio M2 N2 G3 with 1 win → 15)
  //   • Last position in a 3-team group with 1+ wins → PEN (5)
  //     (e.g. João Santos/Miguel Pena, 3rd in Junho M1 N1 G2 with 1 win → 74)
  //   • Position 2 in a 4-team group not advancing → 2ºG (4)
  //   • Other non-advancing positions with ≥ 1 win → PEN (5)

  if (!hasPlayoff) {
    // Single-group format (1G3, 1G4, 1G5): position maps directly to classId
    if (position === 1) return { classId: 1, result: '1º Grupo' };
    if (wins === 0) return { classId: 6, result: 'Último' };
    if (position === groupSize && groupSize >= 4) return { classId: 6, result: 'Último' };
    if (position === 2) return { classId: 2, result: '2º Grupo' };
    if (position === 3) return { classId: 3, result: '3º Grupo' };
    if (position === groupSize - 1) return { classId: 4, result: 'Penúltimo' };
    return { classId: 5, result: 'Penúltimo' };
  }

  // Group + playoff format
  if (position === 1) return { classId: 2, result: 'Finalista (group winner)' };
  if (position === 2 && isBest2nd) return { classId: 2, result: 'Finalista (best 2nd)' };

  if (wins === 0) return { classId: 6, result: 'Último' };
  if (position === groupSize && groupSize >= 4) return { classId: 6, result: 'Último (last in 4+ group)' };
  if (position === 2 && groupSize === 4) return { classId: 4, result: '2º Grupo' };
  return { classId: 5, result: 'Penúltimo' };
}

/**
 * Top-level: award points for a single category.
 * Returns Map<teamId, { classId, wins, losses, result, points }>
 *
 * Args:
 *   matches             - array of { team1Id, team2Id, winnerTeamId, round, sets: [{t1,t2}] }
 *   season              - integer
 *   tier                - 'OURO' | 'PRATA' | 'BRONZE'
 *   level               - 1 | 2  (category level)
 *   lookupPoints        - (season, tier, level, classId) => number
 *   groupAssignments    - optional Map<teamId, groupName>
 */
function awardCategoryPoints(matches, season, tier, level, lookupPoints, groupAssignments = new Map()) {
  if (!matches || matches.length === 0) return new Map();
  const fmt = detectFormat(matches);

  let perTeam;
  if (fmt.kind === 'elimination') {
    perTeam = processElimination(matches);
  } else if (fmt.kind === 'groups_with_playoff') {
    perTeam = processGroupsWithPlayoff(matches, groupAssignments);
  } else if (fmt.kind === 'single_group') {
    perTeam = processSingleGroup(matches);
  } else {
    return new Map();
  }

  const out = new Map();
  for (const [teamId, r] of perTeam) {
    const points = lookupPoints(season, tier, level, r.classId) ?? 0;
    out.set(teamId, { ...r, points });
  }
  return out;
}

function processSingleGroup(matches) {
  const stats = [...buildTeamStats(matches).values()];
  const ordered = rankStandings(stats);
  const groupSize = ordered.length;
  const out = new Map();
  for (const t of ordered) {
    const cls = classifyGroupPosition(t.position, groupSize, t.wins, false, false);
    out.set(t.teamId, {
      classId: cls.classId, wins: t.wins, losses: t.losses,
      result: cls.result, position: t.position, groupName: 'single',
    });
  }
  return out;
}

module.exports = {
  detectFormat,
  buildTeamStats,
  rankStandings,
  orderTieGroup,
  processElimination,
  processGroupsWithPlayoff,
  processSingleGroup,
  classifyGroupPosition,
  classifyEliminationRound,
  awardCategoryPoints,
  isFinalRound, isSemifinalRound, isGroupRound, extractGroupName,
};
