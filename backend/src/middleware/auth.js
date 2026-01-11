const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'bt4500-dev-secret';

// Auth0 configuration
const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;
const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE;
// Custom namespace for Auth0 roles (must match the namespace in your Auth0 Action)
const AUTH0_ROLES_NAMESPACE = process.env.AUTH0_ROLES_NAMESPACE || 'https://bt4500.com/roles';

// Check if Auth0 is configured
const isAuth0Enabled = () => !!(AUTH0_DOMAIN && AUTH0_AUDIENCE);

/**
 * Extract role from Auth0 token
 * Auth0 roles are added via Actions/Rules with a custom namespace
 * Returns 'admin' if user has ADMIN role, otherwise 'player'
 */
function extractAuth0Role(decoded) {
  // Try to get roles from custom namespace claim
  const roles = decoded[AUTH0_ROLES_NAMESPACE] ||
                decoded['roles'] ||
                decoded['https://bt4500.com/roles'] ||
                [];

  // Check if user has ADMIN role (case-insensitive)
  const hasAdminRole = roles.some(role =>
    role.toUpperCase() === 'ADMIN'
  );

  return hasAdminRole ? 'admin' : 'player';
}

// JWKS client for Auth0 token verification (lazy-loaded)
let jwksClientInstance = null;
const getJwksClient = () => {
  if (!jwksClientInstance && isAuth0Enabled()) {
    jwksClientInstance = jwksClient({
      jwksUri: `https://${AUTH0_DOMAIN}/.well-known/jwks.json`,
      cache: true,
      rateLimit: true,
      cacheMaxAge: 600000 // 10 minutes
    });
  }
  return jwksClientInstance;
};

/**
 * Generate JWT token (for local auth)
 */
function generateToken(user) {
  return jwt.sign(
    { id: user.id, uuid: user.uuid, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

/**
 * Verify Auth0 token
 */
async function verifyAuth0Token(token) {
  const client = getJwksClient();

  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      (header, callback) => {
        client.getSigningKey(header.kid, (err, key) => {
          if (err) return callback(err);
          callback(null, key.publicKey || key.rsaPublicKey);
        });
      },
      {
        audience: AUTH0_AUDIENCE,
        issuer: `https://${AUTH0_DOMAIN}/`,
        algorithms: ['RS256']
      },
      (err, decoded) => {
        if (err) return reject(err);
        resolve(decoded);
      }
    );
  });
}

/**
 * Verify JWT token middleware
 * Supports both local JWT and Auth0 tokens
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.substring(7);
    let decoded;
    let isAuth0Token = false;

    // Try to decode without verification to check the issuer
    try {
      const unverified = jwt.decode(token, { complete: true });
      if (unverified?.payload?.iss?.includes(AUTH0_DOMAIN)) {
        isAuth0Token = true;
      }
    } catch (e) {
      // Not a valid JWT format
    }

    if (isAuth0Token && isAuth0Enabled()) {
      // Verify Auth0 token
      try {
        decoded = await verifyAuth0Token(token);

        // Extract role from Auth0 token
        const auth0Role = extractAuth0Role(decoded);

        // Find or create user from Auth0 token
        const email = decoded.email || decoded.sub;
        let user = await User.findByEmail(email);

        if (!user) {
          // Auto-create user from Auth0 with role from token
          user = await User.create({
            email: email,
            password: null, // No password for Auth0 users
            role: auth0Role,
            auth0Id: decoded.sub
          });
        } else {
          // Sync role from Auth0 if it changed
          const needsUpdate = (!user.auth0_id && decoded.sub) || (user.role !== auth0Role);
          if (needsUpdate) {
            await User.update(user.id, {
              auth0Id: decoded.sub,
              role: auth0Role
            });
            user.role = auth0Role; // Update in-memory user object
          }
        }

        req.user = user;
        req.auth0Token = decoded;
        return next();
      } catch (auth0Error) {
        console.error('Auth0 token verification failed:', auth0Error.message);
        return res.status(401).json({ error: 'Invalid Auth0 token' });
      }
    } else {
      // Verify local JWT
      try {
        decoded = jwt.verify(token, JWT_SECRET);

        const user = await User.findById(decoded.id);
        if (!user) {
          return res.status(401).json({ error: 'User not found' });
        }

        req.user = user;
        return next();
      } catch (jwtError) {
        if (jwtError.name === 'TokenExpiredError') {
          return res.status(401).json({ error: 'Token expired' });
        }
        if (jwtError.name === 'JsonWebTokenError') {
          return res.status(401).json({ error: 'Invalid token' });
        }
        throw jwtError;
      }
    }
  } catch (error) {
    console.error('Authentication error:', error);
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

      // Check if Auth0 token
      let isAuth0Token = false;
      try {
        const unverified = jwt.decode(token, { complete: true });
        if (unverified?.payload?.iss?.includes(AUTH0_DOMAIN)) {
          isAuth0Token = true;
        }
      } catch (e) {
        // Not valid JWT
      }

      if (isAuth0Token && isAuth0Enabled()) {
        const decoded = await verifyAuth0Token(token);
        const email = decoded.email || decoded.sub;
        const user = await User.findByEmail(email);
        if (user) {
          req.user = user;
          req.auth0Token = decoded;
        }
      } else {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.id);
        if (user) {
          req.user = user;
        }
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
  organizerOrAdmin,
  isAuth0Enabled
};
