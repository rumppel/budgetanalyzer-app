import bcrypt from 'bcrypt';
import pool from '../db.js';

class UserService {
  /**
   * Create a new user
   */
  async createUser(email, password, fullName, role = 'user') {
    // Hash the password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Insert user into database
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING id, email, full_name, role, created_at, updated_at`,
      [email, passwordHash, fullName, role]
    );

    return result.rows[0];
  }

  /**
   * Find user by email
   */
  async findByEmail(email) {
    const result = await pool.query(
      'SELECT id, email, password_hash, full_name, role, created_at, updated_at FROM users WHERE email = $1',
      [email]
    );

    return result.rows[0] || null;
  }

  /**
   * Find user by ID
   */
  async findById(userId) {
    const result = await pool.query(
      'SELECT id, email, password_hash, full_name, role, created_at, updated_at FROM users WHERE id = $1',
      [userId]
    );

    return result.rows[0] || null;
  }

  /**
   * Verify password
   */
  async verifyPassword(password, passwordHash) {
    return await bcrypt.compare(password, passwordHash);
  }

  /**
   * Update user information
   */
  async updateUser(userId, updates) {
    const allowedFields = ['email', 'full_name', 'role'];
    const fields = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key) && value !== undefined) {
        fields.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    fields.push(`updated_at = NOW()`);
    values.push(userId);

    const result = await pool.query(
      `UPDATE users 
       SET ${fields.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, email, full_name, role, created_at, updated_at`,
      values
    );

    return result.rows[0] || null;
  }

  /**
   * Change user password
   */
  async changePassword(userId, newPassword) {
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    const result = await pool.query(
      `UPDATE users 
       SET password_hash = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, email, full_name, role`,
      [passwordHash, userId]
    );

    return result.rows[0] || null;
  }

  /**
   * Delete user
   */
  async deleteUser(userId) {
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
  }
}

export default new UserService();

