import { Router } from 'express';
import AuthController from '../controllers/AuthController.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

// Public routes
router.post('/register', AuthController.register.bind(AuthController));
router.post('/login', AuthController.login.bind(AuthController));

// Protected routes
router.post('/logout', authenticate, AuthController.logout.bind(AuthController));
router.get('/me', authenticate, AuthController.getMe.bind(AuthController));
router.put('/profile', authenticate, AuthController.updateProfile.bind(AuthController));
router.put('/password', authenticate, AuthController.changePassword.bind(AuthController));

export default router;

