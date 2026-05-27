/**
 * 2025 season points table, mirrored from backend/migrations/update_points_2025.sql.
 * Used by the verification harness to look up points without a DB.
 */

const ROWS_2025 = [
  // OURO N1
  ['OURO', 1, 1, 1500], ['OURO', 1, 2, 1000], ['OURO', 1, 3, 667],
  ['OURO', 1, 4, 444],  ['OURO', 1, 5, 296],  ['OURO', 1, 6, 15],
  // PRATA N1
  ['PRATA', 1, 1, 750], ['PRATA', 1, 2, 500], ['PRATA', 1, 3, 333],
  ['PRATA', 1, 4, 222], ['PRATA', 1, 5, 148], ['PRATA', 1, 6, 15],
  // BRONZE N1
  ['BRONZE', 1, 1, 375], ['BRONZE', 1, 2, 250], ['BRONZE', 1, 3, 167],
  ['BRONZE', 1, 4, 111], ['BRONZE', 1, 5, 74],  ['BRONZE', 1, 6, 15],
  // OURO N2
  ['OURO', 2, 1, 444], ['OURO', 2, 2, 296], ['OURO', 2, 3, 198],
  ['OURO', 2, 4, 132], ['OURO', 2, 5, 88],  ['OURO', 2, 6, 15],
  // PRATA N2
  ['PRATA', 2, 1, 222], ['PRATA', 2, 2, 148], ['PRATA', 2, 3, 99],
  ['PRATA', 2, 4, 66],  ['PRATA', 2, 5, 44],  ['PRATA', 2, 6, 15],
  // BRONZE N2
  ['BRONZE', 2, 1, 111], ['BRONZE', 2, 2, 74], ['BRONZE', 2, 3, 49],
  ['BRONZE', 2, 4, 33],  ['BRONZE', 2, 5, 22], ['BRONZE', 2, 6, 15],
];

const TABLE = new Map();
for (const [tier, level, classId, points] of ROWS_2025) {
  TABLE.set(`2025_${tier}_${level}_${classId}`, points);
}

function lookupPoints(season, tier, level, classId) {
  return TABLE.get(`${season}_${tier}_${level}_${classId}`) ?? 0;
}

module.exports = { lookupPoints, TABLE };
