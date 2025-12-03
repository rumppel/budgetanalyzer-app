// src/controllers/CommunityController.js
import pool from '../db.js';

class CommunityController {
  static async list(req, res) {
    try {
      const { rows } = await pool.query(`
        SELECT
          c.*,
          r.name AS region_name
        FROM community c
        LEFT JOIN region r ON r.id = c.region_id
        ORDER BY r.name, c.name
      `);
      res.json(rows);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: 'Server error' });
    }
  }
}

export default CommunityController;
