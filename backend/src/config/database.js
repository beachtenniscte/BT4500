const sql = require('mssql');
require('dotenv').config();

// Build config - handle instance name properly
const config = {
  server: process.env.DB_SERVER || 'localhost',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'BT4500',
  options: {
    encrypt: false,
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
    enableArithAbort: true
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  },
  connectionTimeout: 30000,
  requestTimeout: 30000
};

// If a specific port is provided, use it directly (bypasses SQL Server Browser)
if (process.env.DB_PORT) {
  config.port = parseInt(process.env.DB_PORT);
} else if (process.env.DB_INSTANCE) {
  // Only use instance name if no port specified (requires SQL Server Browser)
  config.options.instanceName = process.env.DB_INSTANCE;
}

// Debug: log config (without password)
console.log('DB Config:', {
  server: config.server,
  database: config.database,
  user: config.user,
  instanceName: config.options.instanceName,
  port: config.port
});

// Global pool
let pool = null;

async function getPool() {
  if (!pool) {
    pool = await sql.connect(config);
  }
  return pool;
}

/**
 * Execute a query with parameters
 * Supports both ? placeholder style and returns recordset
 */
async function query(queryString, params = []) {
  const poolConn = await getPool();
  const request = poolConn.request();

  // Add parameters
  params.forEach((param, index) => {
    request.input(`p${index}`, param);
  });

  // Replace ? placeholders with @p0, @p1, etc.
  let paramIndex = 0;
  const formattedQuery = queryString.replace(/\?/g, () => `@p${paramIndex++}`);

  const result = await request.query(formattedQuery);
  return result;
}

/**
 * Execute query and return rows (MySQL-compatible interface)
 */
async function execute(queryString, params = []) {
  const result = await query(queryString, params);
  return [result.recordset || [], result];
}

async function testConnection() {
  try {
    const poolConn = await getPool();
    const result = await poolConn.request().query('SELECT 1 as test');
    console.log('Database connected successfully');
    return true;
  } catch (error) {
    console.error('Database connection failed:', error.message);
    return false;
  }
}

async function closePool() {
  if (pool) {
    await pool.close();
    pool = null;
  }
}

// Create a pool-like interface for compatibility
const poolInterface = {
  query: execute,
  request: async () => {
    const poolConn = await getPool();
    return poolConn.request();
  },
  getConnection: async () => {
    const poolConn = await getPool();
    return {
      query: async (q, p) => execute(q, p),
      request: () => poolConn.request(),
      release: () => {}, // No-op for mssql pool
      beginTransaction: async () => {
        const transaction = new sql.Transaction(poolConn);
        await transaction.begin();
        return transaction;
      }
    };
  }
};

module.exports = {
  sql,
  config,
  pool: poolInterface,
  getPool,
  query: execute,
  testConnection,
  closePool
};
