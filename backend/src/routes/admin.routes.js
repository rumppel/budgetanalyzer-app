import express from 'express';
import AdminController from '../controllers/AdminController.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(authorize('admin'));

// ==================== USER MANAGEMENT ====================

// Get all users
router.get('/users', AdminController.getUsers);

// Get user by ID
router.get('/users/:id', AdminController.getUserById);

// Update user
router.put('/users/:id', AdminController.updateUser);

// Change user password
router.put('/users/:id/password', AdminController.changeUserPassword);

// Get user reports
router.get('/users/:id/reports', AdminController.getUserReports);

// Delete user reports
router.delete('/users/:id/reports', AdminController.deleteUserReports);

// Delete user
router.delete('/users/:id', AdminController.deleteUser);

// ==================== SYNC MANAGEMENT ====================

// Get sync results
router.get('/sync/results', AdminController.getSyncResults);

// Trigger sync
router.post('/sync/trigger', AdminController.triggerSync);

// ==================== BUDGET STRUCTURE MODERATION ====================

// Get budget structure records
router.get('/budget-structure', AdminController.getBudgetStructure);

// Get budget structure record by ID
router.get('/budget-structure/:id', AdminController.getBudgetStructureById);

// Create budget structure record
router.post('/budget-structure', AdminController.createBudgetStructure);

// Update budget structure record
router.put('/budget-structure/:id', AdminController.updateBudgetStructure);

// Delete budget structure record
router.delete('/budget-structure/:id', AdminController.deleteBudgetStructure);

export default router;

