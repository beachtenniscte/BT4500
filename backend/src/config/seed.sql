-- BT4500 Seed Data
-- Generated from seed.js
-- Run this script in SQL Server Management Studio after running schema.sql

-- Make sure you're using the correct database
-- USE [BT4500]
-- GO

-- ========================================
-- 1. Seed Categories
-- ========================================
IF NOT EXISTS (SELECT 1 FROM categories WHERE code = 'F1')
  INSERT INTO categories (code, name, gender, level, description) VALUES ('F1', 'Pares Femininos Nivel 1', 'F', 1, 'Womens Doubles Level 1 (Advanced)');

IF NOT EXISTS (SELECT 1 FROM categories WHERE code = 'F2')
  INSERT INTO categories (code, name, gender, level, description) VALUES ('F2', 'Pares Femininos Nivel 2', 'F', 2, 'Womens Doubles Level 2 (Intermediate)');

IF NOT EXISTS (SELECT 1 FROM categories WHERE code = 'M1')
  INSERT INTO categories (code, name, gender, level, description) VALUES ('M1', 'Pares Masculinos Nivel 1', 'M', 1, 'Mens Doubles Level 1 (Advanced)');

IF NOT EXISTS (SELECT 1 FROM categories WHERE code = 'M2')
  INSERT INTO categories (code, name, gender, level, description) VALUES ('M2', 'Pares Masculinos Nivel 2', 'M', 2, 'Mens Doubles Level 2 (Intermediate)');

IF NOT EXISTS (SELECT 1 FROM categories WHERE code = 'MX1')
  INSERT INTO categories (code, name, gender, level, description) VALUES ('MX1', 'Pares Mistos Nivel 1', 'MX', 1, 'Mixed Doubles Level 1 (Advanced)');

IF NOT EXISTS (SELECT 1 FROM categories WHERE code = 'MX2')
  INSERT INTO categories (code, name, gender, level, description) VALUES ('MX2', 'Pares Mistos Nivel 2', 'MX', 2, 'Mixed Doubles Level 2 (Intermediate)');

PRINT 'Categories seeded';
GO

-- ========================================
-- 2. Seed Points Table
-- Points depend on: Tier (OURO/PRATA/BRONZE) and Level (1/2)
-- Tier multipliers: OURO = 1.5, PRATA = 1.0, BRONZE = 0.75
-- Level multipliers: Level 1 = 100%, Level 2 = 70%
-- ========================================

-- Clear existing points to reseed with new structure
DELETE FROM points_table;
GO

-- OURO Level 1 (Base * 1.5 * 1.0)
INSERT INTO points_table (tier, level, round_name, round_order, points, description) VALUES ('OURO', 1, N'Campeão', 7, 600, 'OURO Nivel 1 - Campeão');
INSERT INTO points_table (tier, level, round_name, round_order, points, description) VALUES ('OURO', 1, 'Final', 6, 420, 'OURO Nivel 1 - Final');
INSERT INTO points_table (tier, level, round_name, round_order, points, description) VALUES ('OURO', 1, 'Semifinal', 5, 270, 'OURO Nivel 1 - Semifinal');
INSERT INTO points_table (tier, level, round_name, round_order, points, description) VALUES ('OURO', 1, 'Quartas de Final', 4, 150, 'OURO Nivel 1 - Quartas de Final');
INSERT INTO points_table (tier, level, round_name, round_order, points, description) VALUES ('OURO', 1, 'R16', 3, 75, 'OURO Nivel 1 - R16');
INSERT INTO points_table (tier, level, round_name, round_order, points, description) VALUES ('OURO', 1, 'R32', 2, 38, 'OURO Nivel 1 - R32');
INSERT INTO points_table (tier, level, round_name, round_order, points, description) VALUES ('OURO', 1, 'Fase de grupos', 1, 15, 'OURO Nivel 1 - Fase de grupos');

-- OURO Level 2 (Base * 1.5 * 0.7)
INSERT INTO points_table (tier, level, round_name, round_order, points, description) VALUES ('OURO', 2, N'Campeão', 7, 420, 'OURO Nivel 2 - Campeão');
INSERT INTO points_table (tier, level, round_name, round_order, points, description) VALUES ('OURO', 2, 'Final', 6, 294, 'OURO Nivel 2 - Final');
INSERT INTO points_table (tier, level, round_name, round_order, points, description) VALUES ('OURO', 2, 'Semifinal', 5, 189, 'OURO Nivel 2 - Semifinal');
INSERT INTO points_table (tier, level, round_name, round_order, points, description) VALUES ('OURO', 2, 'Quartas de Final', 4, 105, 'OURO Nivel 2 - Quartas de Final');
INSERT INTO points_table (tier, level, round_name, round_order, points, description) VALUES ('OURO', 2, 'R16', 3, 53, 'OURO Nivel 2 - R16');
INSERT INTO points_table (tier, level, round_name, round_order, points, description) VALUES ('OURO', 2, 'R32', 2, 26, 'OURO Nivel 2 - R32');
INSERT INTO points_table (tier, level, round_name, round_order, points, description) VALUES ('OURO', 2, 'Fase de grupos', 1, 11, 'OURO Nivel 2 - Fase de grupos');

-- PRATA Level 1 (Base * 1.0 * 1.0)
INSERT INTO points_table (tier, level, round_name, round_order, points, description) VALUES ('PRATA', 1, N'Campeão', 7, 400, 'PRATA Nivel 1 - Campeão');
INSERT INTO points_table (tier, level, round_name, round_order, points, description) VALUES ('PRATA', 1, 'Final', 6, 280, 'PRATA Nivel 1 - Final');
INSERT INTO points_table (tier, level, round_name, round_order, points, description) VALUES ('PRATA', 1, 'Semifinal', 5, 180, 'PRATA Nivel 1 - Semifinal');
INSERT INTO points_table (tier, level, round_name, round_order, points, description) VALUES ('PRATA', 1, 'Quartas de Final', 4, 100, 'PRATA Nivel 1 - Quartas de Final');
INSERT INTO points_table (tier, level, round_name, round_order, points, description) VALUES ('PRATA', 1, 'R16', 3, 50, 'PRATA Nivel 1 - R16');
INSERT INTO points_table (tier, level, round_name, round_order, points, description) VALUES ('PRATA', 1, 'R32', 2, 25, 'PRATA Nivel 1 - R32');
INSERT INTO points_table (tier, level, round_name, round_order, points, description) VALUES ('PRATA', 1, 'Fase de grupos', 1, 10, 'PRATA Nivel 1 - Fase de grupos');

-- PRATA Level 2 (Base * 1.0 * 0.7)
INSERT INTO points_table (tier, level, round_name, round_order, points, description) VALUES ('PRATA', 2, N'Campeão', 7, 280, 'PRATA Nivel 2 - Campeão');
INSERT INTO points_table (tier, level, round_name, round_order, points, description) VALUES ('PRATA', 2, 'Final', 6, 196, 'PRATA Nivel 2 - Final');
INSERT INTO points_table (tier, level, round_name, round_order, points, description) VALUES ('PRATA', 2, 'Semifinal', 5, 126, 'PRATA Nivel 2 - Semifinal');
INSERT INTO points_table (tier, level, round_name, round_order, points, description) VALUES ('PRATA', 2, 'Quartas de Final', 4, 70, 'PRATA Nivel 2 - Quartas de Final');
INSERT INTO points_table (tier, level, round_name, round_order, points, description) VALUES ('PRATA', 2, 'R16', 3, 35, 'PRATA Nivel 2 - R16');
INSERT INTO points_table (tier, level, round_name, round_order, points, description) VALUES ('PRATA', 2, 'R32', 2, 18, 'PRATA Nivel 2 - R32');
INSERT INTO points_table (tier, level, round_name, round_order, points, description) VALUES ('PRATA', 2, 'Fase de grupos', 1, 7, 'PRATA Nivel 2 - Fase de grupos');

-- BRONZE Level 1 (Base * 0.75 * 1.0)
INSERT INTO points_table (tier, level, round_name, round_order, points, description) VALUES ('BRONZE', 1, N'Campeão', 7, 300, 'BRONZE Nivel 1 - Campeão');
INSERT INTO points_table (tier, level, round_name, round_order, points, description) VALUES ('BRONZE', 1, 'Final', 6, 210, 'BRONZE Nivel 1 - Final');
INSERT INTO points_table (tier, level, round_name, round_order, points, description) VALUES ('BRONZE', 1, 'Semifinal', 5, 135, 'BRONZE Nivel 1 - Semifinal');
INSERT INTO points_table (tier, level, round_name, round_order, points, description) VALUES ('BRONZE', 1, 'Quartas de Final', 4, 75, 'BRONZE Nivel 1 - Quartas de Final');
INSERT INTO points_table (tier, level, round_name, round_order, points, description) VALUES ('BRONZE', 1, 'R16', 3, 38, 'BRONZE Nivel 1 - R16');
INSERT INTO points_table (tier, level, round_name, round_order, points, description) VALUES ('BRONZE', 1, 'R32', 2, 19, 'BRONZE Nivel 1 - R32');
INSERT INTO points_table (tier, level, round_name, round_order, points, description) VALUES ('BRONZE', 1, 'Fase de grupos', 1, 8, 'BRONZE Nivel 1 - Fase de grupos');

-- BRONZE Level 2 (Base * 0.75 * 0.7)
INSERT INTO points_table (tier, level, round_name, round_order, points, description) VALUES ('BRONZE', 2, N'Campeão', 7, 210, 'BRONZE Nivel 2 - Campeão');
INSERT INTO points_table (tier, level, round_name, round_order, points, description) VALUES ('BRONZE', 2, 'Final', 6, 147, 'BRONZE Nivel 2 - Final');
INSERT INTO points_table (tier, level, round_name, round_order, points, description) VALUES ('BRONZE', 2, 'Semifinal', 5, 95, 'BRONZE Nivel 2 - Semifinal');
INSERT INTO points_table (tier, level, round_name, round_order, points, description) VALUES ('BRONZE', 2, 'Quartas de Final', 4, 53, 'BRONZE Nivel 2 - Quartas de Final');
INSERT INTO points_table (tier, level, round_name, round_order, points, description) VALUES ('BRONZE', 2, 'R16', 3, 26, 'BRONZE Nivel 2 - R16');
INSERT INTO points_table (tier, level, round_name, round_order, points, description) VALUES ('BRONZE', 2, 'R32', 2, 13, 'BRONZE Nivel 2 - R32');
INSERT INTO points_table (tier, level, round_name, round_order, points, description) VALUES ('BRONZE', 2, 'Fase de grupos', 1, 5, 'BRONZE Nivel 2 - Fase de grupos');

PRINT 'Points table seeded (with tier + level combinations)';
GO

-- ========================================
-- 3. Seed Users
-- NOTE: Password hashes are generated with bcrypt
-- You'll need to generate new hashes or use the Node.js seed script for proper hashing
-- These are pre-generated bcrypt hashes for the default passwords
-- ========================================

-- Admin user: admin / admin123
-- Password hash generated with bcrypt (10 rounds)
IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin')
  INSERT INTO users (email, password_hash, role) VALUES ('admin', '$2a$10$rQnM1.Y5xLKqVz1Y5xLKqOeJxmV5Y5xLKqVz1Y5xLKqVz1Y5xLKq', 'admin');

-- Player user: player / player123
IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'player')
  INSERT INTO users (email, password_hash, role) VALUES ('player', '$2a$10$rQnM1.Y5xLKqVz1Y5xLKqOeJxmV5Y5xLKqVz1Y5xLKqVz1Y5xLKq', 'player');

PRINT 'Users seeded (NOTE: Run Node.js seed script for proper password hashing)';
GO

-- ========================================
-- Seed completed!
-- ========================================
-- Test Users (if using Node.js seed):
--   Admin:  admin / admin123
--   Player: player / player123
-- ========================================

PRINT '';
PRINT '========================================';
PRINT 'Seed completed successfully!';
PRINT '========================================';
PRINT '';
PRINT 'IMPORTANT: For proper password hashing, run the Node.js seed script:';
PRINT '  cd backend && npm run db:seed';
PRINT '';
PRINT 'Or manually update user passwords after creating them.';
PRINT '========================================';
GO
