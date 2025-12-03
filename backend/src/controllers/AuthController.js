import UserService from '../services/UserService.js';
import AuthService from '../services/AuthService.js';

class AuthController {
  /**
   * Register a new user
   * POST /api/auth/register
   */
  async register(req, res) {
    try {
      const { email, password, full_name, role } = req.body;

      // Validate input
      if (!email || !password || !full_name) {
        return res.status(400).json({
          error: 'Email, password, and full_name are required'
        });
      }

      // Check if user already exists
      const existingUser = await UserService.findByEmail(email);
      if (existingUser) {
        return res.status(409).json({
          error: 'User with this email already exists'
        });
      }

      // Validate password strength
      if (password.length < 6) {
        return res.status(400).json({
          error: 'Password must be at least 6 characters long'
        });
      }

      // Create user
      const user = await UserService.createUser(email, password, full_name, role || 'user');

      // Generate token
      const token = AuthService.generateToken(user.id, user.email, user.role);

      // Create session
      await AuthService.createSession(user.id, token);

      // Return user data (without password_hash) and token
      res.status(201).json({
        message: 'User registered successfully',
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          role: user.role,
          created_at: user.created_at
        },
        token
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Login user
   * POST /api/auth/login
   */
  async login(req, res) {
    try {
      const { email, password } = req.body;

      // Validate input
      if (!email || !password) {
        return res.status(400).json({
          error: 'Email and password are required'
        });
      }

      // Find user
      const user = await UserService.findByEmail(email);
      if (!user) {
        return res.status(401).json({
          error: 'Invalid email or password'
        });
      }

      // Verify password
      const isPasswordValid = await UserService.verifyPassword(password, user.password_hash);
      if (!isPasswordValid) {
        return res.status(401).json({
          error: 'Invalid email or password'
        });
      }

      // Generate token
      const token = AuthService.generateToken(user.id, user.email, user.role);

      // Create session
      await AuthService.createSession(user.id, token);

      // Return user data (without password_hash) and token
      res.json({
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          role: user.role,
          created_at: user.created_at
        },
        token
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Logout user
   * POST /api/auth/logout
   */
  async logout(req, res) {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');

      if (token) {
        await AuthService.deleteSession(token);
      }

      res.json({ message: 'Logout successful' });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get current user profile
   * GET /api/auth/me
   */
  async getMe(req, res) {
    try {
      // User is attached to req by auth middleware
      const user = req.user;

      res.json({
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          role: user.role,
          created_at: user.created_at,
          updated_at: user.updated_at
        }
      });
    } catch (error) {
      console.error('Get me error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Update user profile
   * PUT /api/auth/profile
   */
  async updateProfile(req, res) {
    try {
      const userId = req.user.id;
      const { email, full_name, role } = req.body;

      const updates = {};
      if (email !== undefined) updates.email = email;
      if (full_name !== undefined) updates.full_name = full_name;
      if (role !== undefined && req.user.role === 'admin') {
        // Only admins can change roles
        updates.role = role;
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      // Check if email is being changed and if it's already taken
      if (updates.email && updates.email !== req.user.email) {
        const existingUser = await UserService.findByEmail(updates.email);
        if (existingUser && existingUser.id !== userId) {
          return res.status(409).json({ error: 'Email already in use' });
        }
      }

      const updatedUser = await UserService.updateUser(userId, updates);

      res.json({
        message: 'Profile updated successfully',
        user: updatedUser
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Change password
   * PUT /api/auth/password
   */
  async changePassword(req, res) {
    try {
      const userId = req.user.id;
      const { current_password, new_password } = req.body;

      if (!current_password || !new_password) {
        return res.status(400).json({
          error: 'Current password and new password are required'
        });
      }

      if (new_password.length < 6) {
        return res.status(400).json({
          error: 'New password must be at least 6 characters long'
        });
      }

      // Get user to verify current password
      const user = await UserService.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Verify current password
      const isPasswordValid = await UserService.verifyPassword(
        current_password,
        user.password_hash
      );
      if (!isPasswordValid) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      // Update password
      await UserService.changePassword(userId, new_password);

      res.json({ message: 'Password changed successfully' });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

export default new AuthController();

