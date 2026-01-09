const sql = require('mssql');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const config = {
  server: process.env.DB_SERVER || 'localhost',
  port: parseInt(process.env.DB_PORT) || 1433,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'bt4500',
  options: {
    encrypt: false,
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
    enableArithAbort: true
  }
};

async function seed() {
  let pool;

  try {
    pool = await sql.connect(config);
    console.log('Starting seed process...\n');

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
      // Check if exists first (MS SQL doesn't have INSERT IGNORE)
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
    const pointsTiers = ['OURO', 'PRATA', 'BRONZE'];
    const pointsMultiplier = { 'OURO': 1.5, 'PRATA': 1.0, 'BRONZE': 0.75 };

    const basePoints = [
      { round: 'Campeao', order: 7, points: 400 },
      { round: 'Final', order: 6, points: 280 },
      { round: 'Semifinal', order: 5, points: 180 },
      { round: 'Quartas de Final', order: 4, points: 100 },
      { round: 'R16', order: 3, points: 50 },
      { round: 'R32', order: 2, points: 25 },
      { round: 'Fase de grupos', order: 1, points: 10 }
    ];

    for (const tier of pointsTiers) {
      for (const bp of basePoints) {
        const points = Math.round(bp.points * pointsMultiplier[tier]);

        // Check if exists
        const existing = await pool.request()
          .input('tier', sql.NVarChar, tier)
          .input('round_name', sql.NVarChar, bp.round)
          .query('SELECT id FROM points_table WHERE tier = @tier AND round_name = @round_name');

        if (existing.recordset.length === 0) {
          await pool.request()
            .input('tier', sql.NVarChar, tier)
            .input('round_name', sql.NVarChar, bp.round)
            .input('round_order', sql.Int, bp.order)
            .input('points', sql.Int, points)
            .input('description', sql.NVarChar, `${tier} - ${bp.round}`)
            .query('INSERT INTO points_table (tier, round_name, round_order, points, description) VALUES (@tier, @round_name, @round_order, @points, @description)');
        }
      }
    }
    console.log('Points table seeded');

    // 3. Create admin user
    const adminPassword = await bcrypt.hash('admin123', 10);

    // Check if admin exists
    const existingAdmin = await pool.request()
      .input('email', sql.NVarChar, 'admin@bt4500.pt')
      .query('SELECT id FROM users WHERE email = @email');

    if (existingAdmin.recordset.length === 0) {
      await pool.request()
        .input('email', sql.NVarChar, 'admin@bt4500.pt')
        .input('password_hash', sql.NVarChar, adminPassword)
        .input('role', sql.NVarChar, 'admin')
        .query('INSERT INTO users (email, password_hash, role) VALUES (@email, @password_hash, @role)');
      console.log('Admin user created (admin@bt4500.pt / admin123)');
    } else {
      console.log('Admin user already exists');
    }

    console.log('\nSeed completed successfully!');
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
