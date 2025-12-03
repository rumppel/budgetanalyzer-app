import { Router } from 'express';
import ReportsController from '../controllers/ReportsController.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware.js';

const router = Router();

// Generate and download PDF (requires auth)
router.post('/generate', authenticate, ReportsController.generate.bind(ReportsController));

// Create report and return metadata (requires auth)
router.post('/create', authenticate, ReportsController.create.bind(ReportsController));

// Get user's reports (requires auth)
router.get('/my', authenticate, ReportsController.getMyReports.bind(ReportsController));

// Get public reports (optional auth)
router.get('/public', optionalAuthenticate, ReportsController.getPublicReports.bind(ReportsController));

// Get report by ID (optional auth - checks access in controller)
router.get('/:id', optionalAuthenticate, ReportsController.getById.bind(ReportsController));

// Download report PDF (optional auth - checks access in controller)
router.get('/:id/download', optionalAuthenticate, ReportsController.download.bind(ReportsController));

// Update report (requires auth)
router.put('/:id', authenticate, ReportsController.update.bind(ReportsController));

// Delete report (requires auth)
router.delete('/:id', authenticate, ReportsController.delete.bind(ReportsController));

export default router;

