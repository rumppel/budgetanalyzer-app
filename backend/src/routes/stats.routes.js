import { Router } from 'express';
import StatsController from '../controllers/stats.controller.js';

const router = Router();

// GET /api/stats/:budget/:type/:year
router.get('/:budget/:type/:year', StatsController.getStats);

export default router;
