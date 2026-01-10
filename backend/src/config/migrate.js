const sql = require('mssql');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Build config - same approach as database.js
const config = {
  server: process.env.DB_SERVER || 'localhost',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: false,
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
    enableArithAbort: true
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

console.log('Migration DB Config:', {
  server: config.server,
  user: config.user,
  port: config.port,
  instanceName: config.options.instanceName
});

async function migrate() {
  let pool;

  try {
    // Connect without database first to create it
    pool = await sql.connect(config);
    const dbName = process.env.DB_NAME || 'bt4500';

    // Drop database if exists and recreate from scratch
    console.log(`Dropping database '${dbName}' if exists...`);
    await pool.request().query(`
      IF EXISTS (SELECT name FROM sys.databases WHERE name = '${dbName}')
      BEGIN
        ALTER DATABASE [${dbName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
        DROP DATABASE [${dbName}];
      END
    `);

    // Create fresh database
    console.log(`Creating database '${dbName}'...`);
    await pool.request().query(`CREATE DATABASE [${dbName}]`);
    console.log(`Database '${dbName}' created fresh`);

    // Close and reconnect to the specific database
    await pool.close();

    config.database = dbName;
    pool = await sql.connect(config);

    // Users table
    await pool.request().query(`
      CREATE TABLE users (
        id INT IDENTITY(1,1) PRIMARY KEY,
        uuid UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        email NVARCHAR(255) NOT NULL UNIQUE,
        password_hash NVARCHAR(255) NOT NULL,
        role NVARCHAR(20) DEFAULT 'player' CHECK (role IN ('admin', 'player', 'organizer')),
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE()
      )
    `);
    console.log('Table: users created');

    // Players table
    await pool.request().query(`
      CREATE TABLE players (
        id INT IDENTITY(1,1) PRIMARY KEY,
        uuid UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        user_id INT NULL,
        first_name NVARCHAR(100) NOT NULL,
        last_name NVARCHAR(100) NOT NULL,
        gender NVARCHAR(2) NOT NULL CHECK (gender IN ('M', 'F')),
        birth_date DATE NULL,
        city NVARCHAR(100) NULL,
        country NVARCHAR(100) DEFAULT 'Portugal',
        photo_url NVARCHAR(500) NULL,
        level INT DEFAULT 2,
        total_points INT DEFAULT 0,
        ranking INT NULL,
        active BIT DEFAULT 1,
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE(),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    console.log('Table: players created');

    // Add computed column for full_name
    await pool.request().query(`
      ALTER TABLE players ADD full_name AS (first_name + ' ' + last_name)
    `);

    // Create index on players
    await pool.request().query(`
      CREATE INDEX idx_players_ranking ON players(ranking)
    `);

    // Tournaments table
    await pool.request().query(`
      CREATE TABLE tournaments (
        id INT IDENTITY(1,1) PRIMARY KEY,
        uuid UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        name NVARCHAR(200) NOT NULL,
        code NVARCHAR(50) NOT NULL,
        tier NVARCHAR(10) NOT NULL CHECK (tier IN ('OURO', 'PRATA', 'BRONZE')),
        location NVARCHAR(200) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        year INT NOT NULL,
        status NVARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
        description NVARCHAR(MAX) NULL,
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE()
      )
    `);
    console.log('Table: tournaments created');

    // Categories table
    await pool.request().query(`
      CREATE TABLE categories (
        id INT IDENTITY(1,1) PRIMARY KEY,
        code NVARCHAR(10) NOT NULL UNIQUE,
        name NVARCHAR(100) NOT NULL,
        gender NVARCHAR(2) NOT NULL CHECK (gender IN ('M', 'F', 'MX')),
        level INT NOT NULL,
        description NVARCHAR(255) NULL
      )
    `);
    console.log('Table: categories created');

    // Tournament Categories
    await pool.request().query(`
      CREATE TABLE tournament_categories (
        id INT IDENTITY(1,1) PRIMARY KEY,
        tournament_id INT NOT NULL,
        category_id INT NOT NULL,
        draw_size INT DEFAULT 16,
        format NVARCHAR(20) DEFAULT 'mixed' CHECK (format IN ('elimination', 'group_stage', 'mixed')),
        FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
        CONSTRAINT unique_tournament_category UNIQUE (tournament_id, category_id)
      )
    `);
    console.log('Table: tournament_categories created');

    // Teams table
    await pool.request().query(`
      CREATE TABLE teams (
        id INT IDENTITY(1,1) PRIMARY KEY,
        uuid UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        player1_id INT NOT NULL,
        player2_id INT NOT NULL,
        category_id INT NOT NULL,
        active BIT DEFAULT 1,
        created_at DATETIME2 DEFAULT GETDATE(),
        FOREIGN KEY (player1_id) REFERENCES players(id) ON DELETE NO ACTION,
        FOREIGN KEY (player2_id) REFERENCES players(id) ON DELETE NO ACTION,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE NO ACTION
      )
    `);
    console.log('Table: teams created');

    // Tournament Registrations
    await pool.request().query(`
      CREATE TABLE tournament_registrations (
        id INT IDENTITY(1,1) PRIMARY KEY,
        tournament_id INT NOT NULL,
        tournament_category_id INT NOT NULL,
        team_id INT NOT NULL,
        seed INT NULL,
        group_name NVARCHAR(10) NULL,
        status NVARCHAR(20) DEFAULT 'registered' CHECK (status IN ('registered', 'confirmed', 'withdrawn', 'eliminated', 'winner')),
        final_position INT NULL,
        points_earned INT DEFAULT 0,
        created_at DATETIME2 DEFAULT GETDATE(),
        FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
        FOREIGN KEY (tournament_category_id) REFERENCES tournament_categories(id) ON DELETE NO ACTION,
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE NO ACTION
      )
    `);
    console.log('Table: tournament_registrations created');

    // Matches table
    await pool.request().query(`
      CREATE TABLE matches (
        id INT IDENTITY(1,1) PRIMARY KEY,
        uuid UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        tournament_id INT NOT NULL,
        tournament_category_id INT NOT NULL,
        match_number INT NOT NULL,
        round NVARCHAR(50) NOT NULL,
        round_order INT NOT NULL,
        court NVARCHAR(50) NULL,
        scheduled_date DATE NOT NULL,
        scheduled_time TIME NOT NULL,
        team1_id INT NULL,
        team2_id INT NULL,
        team1_registration_id INT NULL,
        team2_registration_id INT NULL,
        winner_team_id INT NULL,
        status NVARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'walkover', 'cancelled')),
        result NVARCHAR(50) NULL,
        set1_team1 INT NULL,
        set1_team2 INT NULL,
        set2_team1 INT NULL,
        set2_team2 INT NULL,
        set3_team1 INT NULL,
        set3_team2 INT NULL,
        notes NVARCHAR(255) NULL,
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE(),
        FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
        FOREIGN KEY (tournament_category_id) REFERENCES tournament_categories(id) ON DELETE NO ACTION,
        FOREIGN KEY (team1_id) REFERENCES teams(id) ON DELETE NO ACTION,
        FOREIGN KEY (team2_id) REFERENCES teams(id) ON DELETE NO ACTION,
        FOREIGN KEY (team1_registration_id) REFERENCES tournament_registrations(id) ON DELETE NO ACTION,
        FOREIGN KEY (team2_registration_id) REFERENCES tournament_registrations(id) ON DELETE NO ACTION,
        FOREIGN KEY (winner_team_id) REFERENCES teams(id) ON DELETE NO ACTION
      )
    `);
    console.log('Table: matches created');

    // Points table - supports tier (OURO/PRATA/BRONZE) and level (1/2)
    await pool.request().query(`
      CREATE TABLE points_table (
        id INT IDENTITY(1,1) PRIMARY KEY,
        tier NVARCHAR(10) NOT NULL CHECK (tier IN ('OURO', 'PRATA', 'BRONZE')),
        level INT NOT NULL DEFAULT 1 CHECK (level IN (1, 2)),
        round_name NVARCHAR(50) NOT NULL,
        round_order INT NOT NULL,
        points INT NOT NULL,
        description NVARCHAR(100) NULL,
        CONSTRAINT unique_tier_level_round UNIQUE (tier, level, round_name)
      )
    `);
    console.log('Table: points_table created');

    // Player Rankings History
    await pool.request().query(`
      CREATE TABLE player_rankings (
        id INT IDENTITY(1,1) PRIMARY KEY,
        player_id INT NOT NULL,
        category_id INT NOT NULL,
        ranking INT NOT NULL,
        total_points INT NOT NULL,
        tournaments_played INT DEFAULT 0,
        wins INT DEFAULT 0,
        losses INT DEFAULT 0,
        ranking_date DATE NOT NULL,
        created_at DATETIME2 DEFAULT GETDATE(),
        FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
      )
    `);
    console.log('Table: player_rankings created');

    // Player Tournament Results
    await pool.request().query(`
      CREATE TABLE player_tournament_results (
        id INT IDENTITY(1,1) PRIMARY KEY,
        player_id INT NOT NULL,
        tournament_id INT NOT NULL,
        category_id INT NOT NULL,
        team_id INT NOT NULL,
        partner_id INT NOT NULL,
        final_round NVARCHAR(50) NOT NULL,
        final_position INT NULL,
        points_earned INT NOT NULL,
        matches_won INT DEFAULT 0,
        matches_lost INT DEFAULT 0,
        created_at DATETIME2 DEFAULT GETDATE(),
        FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE NO ACTION,
        FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE NO ACTION,
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE NO ACTION,
        FOREIGN KEY (partner_id) REFERENCES players(id) ON DELETE NO ACTION,
        CONSTRAINT unique_player_tournament_category UNIQUE (player_id, tournament_id, category_id)
      )
    `);
    console.log('Table: player_tournament_results created');

    // Create indexes
    await pool.request().query(`
      CREATE INDEX idx_tournaments_year ON tournaments(year)
    `);

    await pool.request().query(`
      CREATE INDEX idx_matches_scheduled ON matches(scheduled_date, scheduled_time)
    `);

    console.log('\n========================================');
    console.log('All tables created successfully!');
    console.log('========================================');
    console.log('\nNext step: Run "npm run db:seed" to populate initial data');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

migrate()
  .then(() => {
    console.log('Migration completed');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Migration error:', err);
    process.exit(1);
  });
