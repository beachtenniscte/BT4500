const sql = require('mssql');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Determine if this is a local or remote connection
const isLocalServer = (process.env.DB_SERVER || 'localhost').includes('localhost') ||
                      (process.env.DB_SERVER || '').includes('DESKTOP') ||
                      (process.env.DB_SERVER || '').includes('127.0.0.1');

// Build config - handle both local and remote servers
const config = {
  server: process.env.DB_SERVER || 'localhost',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'bt4500',
  options: {
    // Remote servers typically need encryption, local servers don't
    encrypt: process.env.DB_ENCRYPT === 'true' || !isLocalServer,
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
    enableArithAbort: true
  },
  connectionTimeout: 30000,
  requestTimeout: 30000
};

// If a specific port is provided, use it directly (bypasses SQL Server Browser)
if (process.env.DB_PORT) {
  config.port = parseInt(process.env.DB_PORT);
}

// Only use instance name for local servers when no port is specified
if (isLocalServer && process.env.DB_INSTANCE && !process.env.DB_PORT) {
  config.options.instanceName = process.env.DB_INSTANCE;
}

console.log('Seed DB Config:', {
  server: config.server,
  database: config.database,
  user: config.user,
  port: config.port,
  instanceName: config.options.instanceName,
  encrypt: config.options.encrypt,
  isLocal: isLocalServer
});

async function seed() {
  let pool;

  try {
    console.log('Connecting to database...');
    pool = await sql.connect(config);
    console.log('Connected! Starting seed process...\n');

    // 1. Seed Categories
    const categories = [
      { code: 'F1', name: 'Pares Femininos Nivel 1', gender: 'F', level: 1, description: 'Womens Doubles Level 1 (Advanced)' },
      { code: 'F2', name: 'Pares Femininos Nivel 2', gender: 'F', level: 2, description: 'Womens Doubles Level 2 (Intermediate)' },
      { code: 'M1', name: 'Pares Masculinos Nivel 1', gender: 'M', level: 1, description: 'Mens Doubles Level 1 (Advanced)' },
      { code: 'M2', name: 'Pares Masculinos Nivel 2', gender: 'M', level: 2, description: 'Mens Doubles Level 2 (Intermediate)' },
      { code: 'MX1', name: 'Pares Mistos Nivel 1', gender: 'MX', level: 1, description: 'Mixed Doubles Level 1 (Advanced)' },
      { code: 'MX2', name: 'Pares Mistos Nivel 2', gender: 'MX', level: 2, description: 'Mixed Doubles Level 2 (Intermediate)' }
    ];

    for (const cat of categories) {
      const existing = await pool.request()
        .input('code', sql.NVarChar, cat.code)
        .query('SELECT id FROM categories WHERE code = @code');

      if (existing.recordset.length === 0) {
        await pool.request()
          .input('code', sql.NVarChar, cat.code)
          .input('name', sql.NVarChar, cat.name)
          .input('gender', sql.NVarChar, cat.gender)
          .input('level', sql.Int, cat.level)
          .input('description', sql.NVarChar, cat.description)
          .query('INSERT INTO categories (code, name, gender, level, description) VALUES (@code, @name, @gender, @level, @description)');
      }
    }
    console.log('Categories seeded');

    // 2. Seed Points Table
    // Points depend on: Tier (OURO/PRATA/BRONZE) and Level (1/2)
    // Level 1 gets more points than Level 2
    const pointsTiers = ['OURO', 'PRATA', 'BRONZE'];
    const levels = [1, 2];

    // Tier multipliers
    const tierMultiplier = { 'OURO': 1.5, 'PRATA': 1.0, 'BRONZE': 0.75 };
    // Level multipliers (Level 1 = 100%, Level 2 = 70%)
    const levelMultiplier = { 1: 1.0, 2: 0.7 };

    const basePoints = [
      { round: 'Campeão', order: 7, points: 400 },
      { round: 'Final', order: 6, points: 280 },
      { round: 'Semifinal', order: 5, points: 180 },
      { round: 'Quartas de Final', order: 4, points: 100 },
      { round: 'R16', order: 3, points: 50 },
      { round: 'R32', order: 2, points: 25 },
      { round: 'Fase de grupos', order: 1, points: 10 }
    ];

    // Clear existing points to reseed with new structure
    await pool.request().query('DELETE FROM points_table');

    for (const tier of pointsTiers) {
      for (const level of levels) {
        for (const bp of basePoints) {
          const points = Math.round(bp.points * tierMultiplier[tier] * levelMultiplier[level]);

          await pool.request()
            .input('tier', sql.NVarChar, tier)
            .input('level', sql.Int, level)
            .input('round_name', sql.NVarChar, bp.round)
            .input('round_order', sql.Int, bp.order)
            .input('points', sql.Int, points)
            .input('description', sql.NVarChar, `${tier} Nivel ${level} - ${bp.round}`)
            .query('INSERT INTO points_table (tier, level, round_name, round_order, points, description) VALUES (@tier, @level, @round_name, @round_order, @points, @description)');
        }
      }
    }
    console.log('Points table seeded (with tier + level combinations)');

    // 3. Create users
    const users = [
      { username: 'admin', password: 'admin123', role: 'admin' },
      { username: 'player', password: 'player123', role: 'player' }
    ];

    for (const user of users) {
      const passwordHash = await bcrypt.hash(user.password, 10);

      // Check if user exists
      const existing = await pool.request()
        .input('email', sql.NVarChar, user.username)
        .query('SELECT id FROM users WHERE email = @email');

      if (existing.recordset.length === 0) {
        await pool.request()
          .input('email', sql.NVarChar, user.username)
          .input('password_hash', sql.NVarChar, passwordHash)
          .input('role', sql.NVarChar, user.role)
          .query('INSERT INTO users (email, password_hash, role) VALUES (@email, @password_hash, @role)');
        console.log(`User created: ${user.username} / ${user.password} (${user.role})`);
      } else {
        console.log(`User already exists: ${user.username}`);
      }
    }

    console.log('\n========================================');
    console.log('Seed completed successfully!');
    console.log('========================================');
    console.log('\nTest Users:');
    console.log('  Admin:  admin / admin123');
    console.log('  Player: player / player123');
    console.log('========================================\n');

  } catch (error) {
    console.error('Seed failed:', error);
    throw error;
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

seed()
  .then(() => {
    console.log('Seed process finished');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Seed error:', err);
    process.exit(1);
  });
