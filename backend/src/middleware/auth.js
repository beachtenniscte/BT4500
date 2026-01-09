const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'bt4500-dev-secret';

/**
 * Generate JWT token
 */
function generateToken(user) {
  return jwt.sign(
    { id: user.id, uuid: user.uuid, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

/**
 * Verify JWT token middleware
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    return res.status(500).json({ error: 'Authentication error' });
  }
}

/**
 * Optional authentication - doesn't fail if no token
 */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(decoded.id);
      if (user) {
        req.user = user;
      }
    }
    next();
  } catch (error) {
    // Silently ignore auth errors for optional auth
    next();
  }
}

/**
 * Require specific role(s)
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}

/**
 * Admin only middleware
 */
const adminOnly = requireRole('admin');

/**
 * Admin or organizer middleware
 */
const organizerOrAdmin = requireRole('admin', 'organizer');

module.exports = {
  generateToken,
  authenticate,
  optionalAuth,
  requireRole,
  adminOnly,
  organizerOrAdmin
};
