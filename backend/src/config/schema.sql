-- BT4500 Database Schema
-- Generated from migrate.js
-- Updated with IF NOT EXISTS checks for safety

-- Create database (run this part first, then connect to the database and run the rest)
-- IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'bt4500')
-- BEGIN
--     CREATE DATABASE [bt4500]
-- END
-- GO
-- USE [bt4500]
-- GO

-- Users table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[users]') AND type in (N'U'))
BEGIN
    CREATE TABLE users (
      id INT IDENTITY(1,1) PRIMARY KEY,
      uuid UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
      email NVARCHAR(255) NOT NULL UNIQUE,
      password_hash NVARCHAR(255) NOT NULL,
      role NVARCHAR(20) DEFAULT 'player' CHECK (role IN ('admin', 'player', 'organizer')),
      created_at DATETIME2 DEFAULT GETDATE(),
      updated_at DATETIME2 DEFAULT GETDATE()
    );
END
GO

-- Players table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[players]') AND type in (N'U'))
BEGIN
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
    );
END
GO

-- Add computed column for full_name
IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = N'full_name' AND Object_ID = Object_ID(N'players'))
BEGIN
    ALTER TABLE players ADD full_name AS (first_name + ' ' + last_name);
END
GO

-- Create index on players
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_players_ranking' AND object_id = OBJECT_ID(N'[dbo].[players]'))
BEGIN
    CREATE INDEX idx_players_ranking ON players(ranking);
END
GO

-- Tournaments table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tournaments]') AND type in (N'U'))
BEGIN
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
    );
END
GO

-- Categories table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[categories]') AND type in (N'U'))
BEGIN
    CREATE TABLE categories (
      id INT IDENTITY(1,1) PRIMARY KEY,
      code NVARCHAR(10) NOT NULL UNIQUE,
      name NVARCHAR(100) NOT NULL,
      gender NVARCHAR(2) NOT NULL CHECK (gender IN ('M', 'F', 'MX')),
      level INT NOT NULL,
      description NVARCHAR(255) NULL
    );
END
GO

-- Tournament Categories
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tournament_categories]') AND type in (N'U'))
BEGIN
    CREATE TABLE tournament_categories (
      id INT IDENTITY(1,1) PRIMARY KEY,
      tournament_id INT NOT NULL,
      category_id INT NOT NULL,
      draw_size INT DEFAULT 16,
      format NVARCHAR(20) DEFAULT 'mixed' CHECK (format IN ('elimination', 'group_stage', 'mixed')),
      FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
      CONSTRAINT unique_tournament_category UNIQUE (tournament_id, category_id)
    );
END
GO

-- Teams table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[teams]') AND type in (N'U'))
BEGIN
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
    );
END
GO

-- Tournament Registrations
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tournament_registrations]') AND type in (N'U'))
BEGIN
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
    );
END
GO

-- Matches table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[matches]') AND type in (N'U'))
BEGIN
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
    );
END
GO

-- Points table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[points_table]') AND type in (N'U'))
BEGIN
    CREATE TABLE points_table (
      id INT IDENTITY(1,1) PRIMARY KEY,
      tier NVARCHAR(10) NOT NULL CHECK (tier IN ('OURO', 'PRATA', 'BRONZE')),
      level INT NOT NULL DEFAULT 1 CHECK (level IN (1, 2)),
      round_name NVARCHAR(50) NOT NULL,
      round_order INT NOT NULL,
      points INT NOT NULL,
      description NVARCHAR(100) NULL,
      CONSTRAINT unique_tier_level_round UNIQUE (tier, level, round_name)
    );
END
GO

-- Player Rankings History
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[player_rankings]') AND type in (N'U'))
BEGIN
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
    );
END
GO

-- Player Tournament Results
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[player_tournament_results]') AND type in (N'U'))
BEGIN
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
    );
END
GO

-- Create indexes (Checking for existence first)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_tournaments_year' AND object_id = OBJECT_ID(N'[dbo].[tournaments]'))
BEGIN
    CREATE INDEX idx_tournaments_year ON tournaments(year);
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_matches_scheduled' AND object_id = OBJECT_ID(N'[dbo].[matches]'))
BEGIN
    CREATE INDEX idx_matches_scheduled ON matches(scheduled_date, scheduled_time);
END
GO

-- ========================================
-- Schema Check Complete
-- ========================================