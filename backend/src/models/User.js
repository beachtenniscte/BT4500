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

  static async findByEmail(email) {
    const [rows] = await pool.query(
      `SELECT * FROM users WHERE email = ?`,
      [email]
    );
    return rows[0] || null;
  }

  static async findByEmailWithPassword(email) {
    const [rows] = await pool.query(
      `SELECT * FROM users WHERE email = ?`,
      [email]
    );
    return rows[0] || null;
  }

  static async create(data) {
    const uuid = uuidv4();
    const { email, password, role = 'player' } = data;

    const passwordHash = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      `INSERT INTO users (uuid, email, password_hash, role)
       OUTPUT INSERTED.id
       VALUES (?, ?, ?, ?)`,
      [uuid, email, passwordHash, role]
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

    if (fields.length === 0) return this.findById(id);

    values.push(id);
    await pool.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    return this.findById(id);
  }

  static async verifyPassword(user, password) {
    return bcrypt.compare(password, user.password_hash);
  }

  static async delete(id) {
    await pool.query(`DELETE FROM users WHERE id = ?`, [id]);
    return true;
  }

  static async getLinkedPlayer(userId) {
    const [rows] = await pool.query(
      `SELECT * FROM players WHERE user_id = ? AND active = 1`,
      [userId]
    );
    return rows[0] || null;
  }
}

module.exports = User;
