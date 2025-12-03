import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import pool from '../db.js';

class AuthService {
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';
  }

  /**
   * Generate a JWT token for a user
   */
  generateToken(userId, email, role) {
    return jwt.sign(
      { userId, email, role },
      this.jwtSecret,
      { expiresIn: this.jwtExpiresIn }
    );
  }

  /**
   * Hash a token for storage in database
   */
  hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Verify a JWT token
   */
  verifyToken(token) {
    try {
      return jwt.verify(token, this.jwtSecret);
    } catch (error) {
      return null;
    }
  }

  /**
   * Create a user session in the database
   */
  async createSession(userId, token) {
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

    const result = await pool.query(
      `INSERT INTO user_sessions (user_id, token_hash, created_at, expires_at)
       VALUES ($1, $2, NOW(), $3)
       RETURNING id`,
      [userId, tokenHash, expiresAt]
    );

    return result.rows[0];
  }

  /**
   * Find a session by token hash
   */
  async findSessionByToken(token) {
    const tokenHash = this.hashToken(token);
    const result = await pool.query(
      `SELECT us.*, u.id as user_id, u.email, u.full_name, u.role
       FROM user_sessions us
       JOIN users u ON us.user_id = u.id
       WHERE us.token_hash = $1 AND us.expires_at > NOW()`,
      [tokenHash]
    );

    return result.rows[0] || null;
  }

  /**
   * Delete a session by token
   */
  async deleteSession(token) {
    const tokenHash = this.hashToken(token);
    await pool.query(
      'DELETE FROM user_sessions WHERE token_hash = $1',
      [tokenHash]
    );
  }

  /**
   * Delete all expired sessions
   */
  async cleanupExpiredSessions() {
    await pool.query(
      'DELETE FROM user_sessions WHERE expires_at < NOW()'
    );
  }

  /**
   * Delete all sessions for a user
   */
  async deleteAllUserSessions(userId) {
    await pool.query(
      'DELETE FROM user_sessions WHERE user_id = $1',
      [userId]
    );
  }
}

export default new AuthService();

