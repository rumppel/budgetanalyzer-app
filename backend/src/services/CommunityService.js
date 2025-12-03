// src/services/CommunityService.js
import pool from '../db.js';

class CommunityService {
  /**
   * Повертає список громад разом з назвою регіону
   */
  static async list() {
    const { rows } = await pool.query(`
      SELECT
        c.*,
        r.name AS region_name
      FROM community c
      LEFT JOIN region r ON r.id = c.region_id
      ORDER BY r.name, c.name
    `);
    return rows;
  }

  /**
   * Повертає громаду за ID
   */
  static async getById(id) {
    const { rows } = await pool.query(
      `
      SELECT
        c.*,
        r.name AS region_name
      FROM community c
      LEFT JOIN region r ON r.id = c.region_id
      WHERE c.id = $1
      `,
      [id]
    );
    return rows[0] || null;
  }
}

export default CommunityService;
