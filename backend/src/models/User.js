const { pool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

class User {
  static async findAll(options = {}) {
    const { role, limit = 100, offset = 0 } = options;

    let query = `SELECT id, uuid, email, role, created_at, updated_at FROM users WHERE 1=1`;
    const params = [];

    if (role) {
      query += ` AND role = ?`;
      params.push(role);
    }

    query += ` ORDER BY created_at DESC OFFSET ? ROWS FETCH NEXT ? ROWS ONLY`;
    params.push(parseInt(offset), parseInt(limit));

    const [rows] = await pool.query(query, params);
    return rows;
  }

  static async findById(id) {
    const [rows] = await pool.query(
      `SELECT id, uuid, email, role, created_at, updated_at FROM users WHERE id = ?`,
      [id]
    );
    return rows[0] || null;
  }

  static async findByUuid(uuid) {
    const [rows] = await pool.query(
      `SELECT id, uuid, email, role, created_at, updated_at FROM users WHERE uuid = ?`,
      [uuid]
    );
    return rows[0] || null;
  }

  static async findByEmail(email, includeInactive = false) {
    const query = includeInactive
      ? `SELECT * FROM users WHERE email = ?`
      : `SELECT * FROM users WHERE email = ? AND (active = 1 OR active IS NULL)`;
    const [rows] = await pool.query(query, [email]);
    return rows[0] || null;
  }

  static async findByEmailIncludingInactive(email) {
    const [rows] = await pool.query(
      `SELECT * FROM users WHERE email = ?`,
      [email]
    );
    return rows[0] || null;
  }

  static async findByEmailWithPassword(email, includeInactive = false) {
    const query = includeInactive
      ? `SELECT * FROM users WHERE email = ?`
      : `SELECT * FROM users WHERE email = ? AND (active = 1 OR active IS NULL)`;
    const [rows] = await pool.query(query, [email]);
    return rows[0] || null;
  }

  static async create(data) {
    const uuid = uuidv4();
    const { email, password, role = 'player', auth0Id = null, whatsapp = null, emailVerified = false } = data;

    // Password can be null for Auth0-only users
    const passwordHash = password ? await bcrypt.hash(password, 10) : null;

    const [result] = await pool.query(
      `INSERT INTO users (uuid, email, password_hash, role, auth0_id, whatsapp, email_verified)
       OUTPUT INSERTED.id
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [uuid, email, passwordHash, role, auth0Id, whatsapp, emailVerified ? 1 : 0]
    );

    const insertedId = result[0]?.id;
    return this.findById(insertedId);
  }

  static async update(id, data) {
    const fields = [];
    const values = [];

    if (data.email) {
      fields.push('email = ?');
      values.push(data.email);
    }

    if (data.password) {
      const passwordHash = await bcrypt.hash(data.password, 10);
      fields.push('password_hash = ?');
      values.push(passwordHash);
    }

    if (data.role) {
      fields.push('role = ?');
      values.push(data.role);
    }

    if (data.auth0Id) {
      fields.push('auth0_id = ?');
      values.push(data.auth0Id);
    }

    if (data.whatsapp !== undefined) {
      fields.push('whatsapp = ?');
      values.push(data.whatsapp);
    }

    if (data.emailVerified !== undefined) {
      fields.push('email_verified = ?');
      values.push(data.emailVerified ? 1 : 0);
    }

    if (fields.length === 0) return this.findById(id);

    values.push(id);
    await pool.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    return this.findById(id);
  }

  static async verifyPassword(user, password) {
    // Auth0 users don't have local passwords
    if (!user.password_hash) {
      return false;
    }
    return bcrypt.compare(password, user.password_hash);
  }

  static async findByAuth0Id(auth0Id) {
    const [rows] = await pool.query(
      `SELECT id, uuid, email, role, auth0_id, created_at, updated_at FROM users WHERE auth0_id = ?`,
      [auth0Id]
    );
    return rows[0] || null;
  }

  static async delete(id) {
    await pool.query(`DELETE FROM users WHERE id = ?`, [id]);
    return true;
  }

  /**
   * Deactivate a user (soft delete)
   * @param {number} id - User ID
   * @param {string} reason - Reason for deactivation
   */
  static async deactivate(id, reason = 'auth0_deleted') {
    await pool.query(
      `UPDATE users SET active = 0, deactivated_at = GETDATE(), deactivation_reason = ? WHERE id = ?`,
      [reason, id]
    );
    return this.findById(id);
  }

  /**
   * Reactivate a deactivated user
   * @param {number} id - User ID
   * @param {object} updates - Optional fields to update (e.g., new auth0Id)
   */
  static async reactivate(id, updates = {}) {
    const fields = ['active = 1', 'deactivated_at = NULL', 'deactivation_reason = NULL'];
    const values = [];

    if (updates.auth0Id) {
      fields.push('auth0_id = ?');
      values.push(updates.auth0Id);
    }

    if (updates.emailVerified !== undefined) {
      fields.push('email_verified = ?');
      values.push(updates.emailVerified ? 1 : 0);
    }

    values.push(id);
    await pool.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    return this.findById(id);
  }

  /**
   * Find user by Auth0 ID
   */
  static async findByAuth0IdIncludingInactive(auth0Id) {
    const [rows] = await pool.query(
      `SELECT * FROM users WHERE auth0_id = ?`,
      [auth0Id]
    );
    return rows[0] || null;
  }

  static async getLinkedPlayer(userId) {
    const [rows] = await pool.query(
      `SELECT * FROM players WHERE user_id = ? AND active = 1`,
      [userId]
    );
    return rows[0] || null;
  }

  /**
   * Try to link a user to an existing player by matching email
   * @param {number} userId - The user's internal ID
   * @param {string} email - The email to match against players
   * @returns {Promise<Object|null>} The linked player if found, null otherwise
   */
  static async linkToPlayerByEmail(userId, email) {
    if (!email) return null;

    // First check if user already has a linked player
    const existingPlayer = await this.getLinkedPlayer(userId);
    if (existingPlayer) {
      return existingPlayer;
    }

    // Find unlinked player with matching email
    const [rows] = await pool.query(
      `SELECT * FROM players WHERE email = ? AND user_id IS NULL AND active = 1`,
      [email.toLowerCase().trim()]
    );

    const player = rows[0];
    if (player) {
      // Link the player to this user
      await pool.query(
        `UPDATE players SET user_id = ? WHERE id = ?`,
        [userId, player.id]
      );
      return { ...player, user_id: userId };
    }

    return null;
  }
}

module.exports = User;
