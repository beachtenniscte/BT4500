const sql = require('mssql');
require('dotenv').config();

const config = {
  server: process.env.DB_SERVER || 'localhost',
  port: parseInt(process.env.DB_PORT) || 1433,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: 'master', // Connect to master to drop the database
  options: {
    encrypt: false,
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
    enableArithAbort: true
  }
};

async function reset() {
  let pool;
  const dbName = process.env.DB_NAME || 'bt4500';

  try {
    pool = await sql.connect(config);

    console.log(`Dropping database '${dbName}'...`);

    // Close all connections to the database first
    await pool.request().query(`
      IF EXISTS (SELECT name FROM sys.databases WHERE name = '${dbName}')
      BEGIN
        ALTER DATABASE [${dbName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
        DROP DATABASE [${dbName}];
      END
    `);

    console.log('Database dropped successfully');
    console.log('\nRun "npm run db:migrate" to recreate the database');
    console.log('Run "npm run db:seed" to seed initial data');
  } catch (error) {
    console.error('Reset failed:', error);
    throw error;
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

reset()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
