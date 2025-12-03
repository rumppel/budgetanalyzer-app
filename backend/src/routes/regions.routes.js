// src/routes/regions.routes.js
import { Router } from 'express';
import RegionController from '../controllers/RegionController.js';

const router = Router();

// GET /api/regions
router.get('/', RegionController.list);

export default router;
