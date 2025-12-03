// src/routes/communities.routes.js
import { Router } from 'express';
import CommunityController from '../controllers/CommunityController.js';

const router = Router();

// GET /api/communities
router.get('/', CommunityController.list);

export default router;
