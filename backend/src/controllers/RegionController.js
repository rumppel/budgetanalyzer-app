// src/controllers/RegionController.js
import pool from '../db.js';

class RegionController {
  static async list(req, res) {
    try {
      const { rows } = await pool.query(
        'SELECT id, name, code, center_lat, center_lng FROM region ORDER BY name',
      );
      res.json(rows);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: 'Server error' });
    }
  }
}

export default RegionController;
