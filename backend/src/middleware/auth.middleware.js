import AuthService from '../services/AuthService.js';
import UserService from '../services/UserService.js';

/**
 * Authentication middleware
 * Verifies JWT token and attaches user to request
 */
export const authenticate = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.replace('Bearer ', '');

    // Verify token
    const decoded = AuthService.verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Check if session exists in database
    const session = await AuthService.findSessionByToken(token);
    if (!session) {
      return res.status(401).json({ error: 'Session not found or expired' });
    }

    // Get user data
    const user = await UserService.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      created_at: user.created_at,
      updated_at: user.updated_at
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
};

/**
 * Optional authentication middleware
 * Attaches user if token is valid, but doesn't require it
 */
export const optionalAuthenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const decoded = AuthService.verifyToken(token);
      
      if (decoded) {
        const session = await AuthService.findSessionByToken(token);
        if (session) {
          const user = await UserService.findById(decoded.userId);
          if (user) {
            req.user = {
              id: user.id,
              email: user.email,
              full_name: user.full_name,
              role: user.role,
              created_at: user.created_at,
              updated_at: user.updated_at
            };
          }
        }
      }
    }

    next();
  } catch (error) {
    // Continue without authentication if there's an error
    next();
  }
};

/**
 * Role-based authorization middleware
 * Use after authenticate middleware
 */
export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

