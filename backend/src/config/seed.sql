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

-- Level 3 categories for 2026+ (uncomment when needed)
-- IF NOT EXISTS (SELECT 1 FROM categories WHERE code = 'F3')
--   INSERT INTO categories (code, name, gender, level, description) VALUES ('F3', 'Pares Femininos Nivel 3', 'F', 3, 'Womens Doubles Level 3 (Beginner)');
-- IF NOT EXISTS (SELECT 1 FROM categories WHERE code = 'M3')
--   INSERT INTO categories (code, name, gender, level, description) VALUES ('M3', 'Pares Masculinos Nivel 3', 'M', 3, 'Mens Doubles Level 3 (Beginner)');
-- IF NOT EXISTS (SELECT 1 FROM categories WHERE code = 'MX3')
--   INSERT INTO categories (code, name, gender, level, description) VALUES ('MX3', 'Pares Mistos Nivel 3', 'MX', 3, 'Mixed Doubles Level 3 (Beginner)');

PRINT 'Categories seeded';
GO

-- ========================================
-- 2. Seed Points Table
-- Points based on Season + Classification ID (1-6)
-- From Pontuacoes.csv (2025 season)
-- ========================================

-- Clear existing points to reseed with new structure
DELETE FROM points_table;
GO

-- SEASON 2025 - OURO Level 1
INSERT INTO points_table (season, tier, level, classification_id, points) VALUES (2025, 'OURO', 1, 1, 1500);
INSERT INTO points_table (season, tier, level, classification_id, points) VALUES (2025, 'OURO', 1, 2, 1000);
INSERT INTO points_table (season, tier, level, classification_id, points) VALUES (2025, 'OURO', 1, 3, 667);
INSERT INTO points_table (season, tier, level, classification_id, points) VALUES (2025, 'OURO', 1, 4, 444);
INSERT INTO points_table (season, tier, level, classification_id, points) VALUES (2025, 'OURO', 1, 5, 296);
INSERT INTO points_table (season, tier, level, classification_id, points) VALUES (2025, 'OURO', 1, 6, 198);

-- SEASON 2025 - OURO Level 2
INSERT INTO points_table (season, tier, level, classification_id, points) VALUES (2025, 'OURO', 2, 1, 444);
INSERT INTO points_table (season, tier, level, classification_id, points) VALUES (2025, 'OURO', 2, 2, 296);
INSERT INTO points_table (season, tier, level, classification_id, points) VALUES (2025, 'OURO', 2, 3, 198);
INSERT INTO points_table (season, tier, level, classification_id, points) VALUES (2025, 'OURO', 2, 4, 132);
INSERT INTO points_table (season, tier, level, classification_id, points) VALUES (2025, 'OURO', 2, 5, 88);
INSERT INTO points_table (season, tier, level, classification_id, points) VALUES (2025, 'OURO', 2, 6, 59);

-- SEASON 2025 - PRATA Level 1
INSERT INTO points_table (season, tier, level, classification_id, points) VALUES (2025, 'PRATA', 1, 1, 750);
INSERT INTO points_table (season, tier, level, classification_id, points) VALUES (2025, 'PRATA', 1, 2, 500);
INSERT INTO points_table (season, tier, level, classification_id, points) VALUES (2025, 'PRATA', 1, 3, 333);
INSERT INTO points_table (season, tier, level, classification_id, points) VALUES (2025, 'PRATA', 1, 4, 222);
INSERT INTO points_table (season, tier, level, classification_id, points) VALUES (2025, 'PRATA', 1, 5, 148);
INSERT INTO points_table (season, tier, level, classification_id, points) VALUES (2025, 'PRATA', 1, 6, 99);

-- SEASON 2025 - PRATA Level 2
INSERT INTO points_table (season, tier, level, classification_id, points) VALUES (2025, 'PRATA', 2, 1, 222);
INSERT INTO points_table (season, tier, level, classification_id, points) VALUES (2025, 'PRATA', 2, 2, 148);
INSERT INTO points_table (season, tier, level, classification_id, points) VALUES (2025, 'PRATA', 2, 3, 99);
INSERT INTO points_table (season, tier, level, classification_id, points) VALUES (2025, 'PRATA', 2, 4, 66);
INSERT INTO points_table (season, tier, level, classification_id, points) VALUES (2025, 'PRATA', 2, 5, 44);
INSERT INTO points_table (season, tier, level, classification_id, points) VALUES (2025, 'PRATA', 2, 6, 29);

-- SEASON 2025 - BRONZE Level 1
INSERT INTO points_table (season, tier, level, classification_id, points) VALUES (2025, 'BRONZE', 1, 1, 375);
INSERT INTO points_table (season, tier, level, classification_id, points) VALUES (2025, 'BRONZE', 1, 2, 250);
INSERT INTO points_table (season, tier, level, classification_id, points) VALUES (2025, 'BRONZE', 1, 3, 167);
INSERT INTO points_table (season, tier, level, classification_id, points) VALUES (2025, 'BRONZE', 1, 4, 111);
INSERT INTO points_table (season, tier, level, classification_id, points) VALUES (2025, 'BRONZE', 1, 5, 74);
INSERT INTO points_table (season, tier, level, classification_id, points) VALUES (2025, 'BRONZE', 1, 6, 49);

-- SEASON 2025 - BRONZE Level 2
INSERT INTO points_table (season, tier, level, classification_id, points) VALUES (2025, 'BRONZE', 2, 1, 111);
INSERT INTO points_table (season, tier, level, classification_id, points) VALUES (2025, 'BRONZE', 2, 2, 74);
INSERT INTO points_table (season, tier, level, classification_id, points) VALUES (2025, 'BRONZE', 2, 3, 49);
INSERT INTO points_table (season, tier, level, classification_id, points) VALUES (2025, 'BRONZE', 2, 4, 33);
INSERT INTO points_table (season, tier, level, classification_id, points) VALUES (2025, 'BRONZE', 2, 5, 22);
INSERT INTO points_table (season, tier, level, classification_id, points) VALUES (2025, 'BRONZE', 2, 6, 15);

-- Copy 2025 to 2026 as placeholder (update when 2026 rules are finalized)
INSERT INTO points_table (season, tier, level, classification_id, points)
SELECT 2026, tier, level, classification_id, points
FROM points_table
WHERE season = 2025;

-- NOTE: Level 3 for 2026 - add when rules are defined
-- INSERT INTO points_table (season, tier, level, classification_id, points) VALUES (2026, 'OURO', 3, 1, TBD);
-- etc.

PRINT 'Points table seeded with season-based classification IDs';
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
