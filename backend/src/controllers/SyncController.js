// src/controllers/SyncController.js
import { SyncService } from '../services/SyncService.js';

export class SyncController {
  static async runOpenBudgetSync(req, res) {
    try {
      const {
        year,
        types = ['program'],
        period = 'MONTH',
        limit = null
      } = req.body;

      if (!year) {
        return res.status(400).json({ error: 'year is required' });
      }

      const validTypes = ['program', 'functional', 'economic', 'all'];
      const badTypes = types.filter(t => !validTypes.includes(t));

      if (badTypes.length) {
        return res.status(400).json({
          error: `Invalid types: ${badTypes.join(', ')}`,
          valid: validTypes
        });
      }

      const validPeriods = ['MONTH', 'QUARTER'];
      if (!validPeriods.includes(period)) {
        return res.status(400).json({
          error: 'Invalid period',
          valid: validPeriods
        });
      }

      const result = await SyncService.runOpenBudgetSync({
        year,
        types,
        period,
        limit
      });

      return res.json(result);

    } catch (err) {
      console.error('❌ SyncController error:', err);
      return res.status(500).json({ error: err.message });
    }
  }
}
