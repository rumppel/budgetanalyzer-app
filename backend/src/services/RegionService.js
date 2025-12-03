// src/services/RegionService.js
import pool from '../db.js';

class RegionService {
  /**
   * Повертає всі області
   */
  static async list() {
    const { rows } = await pool.query(
      `
      SELECT id, name, code, center_lat, center_lng
      FROM region
      ORDER BY name
      `
    );
    return rows;
  }

  /**
   * Повертає одну область за ID
   */
  static async getById(id) {
    const { rows } = await pool.query(
      `
      SELECT id, name, code, center_lat, center_lng
      FROM region
      WHERE id = $1
      `,
      [id]
    );
    return rows[0] || null;
  }
}

export default RegionService;
