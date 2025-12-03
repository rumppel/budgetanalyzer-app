// src/routes/sync.routes.js
import { Router } from 'express';
import { SyncController } from '../controllers/SyncController.js';

const router = Router();

/**
 * POST /api/sync/openbudget
 * {
 *   "year": 2024,
 *   "types": ["program", "functional", "economic"],
 *   "period": "MONTH",
 *   "limit": 500
 * }
 */
router.post('/openbudget', SyncController.runOpenBudgetSync);

export default router;
