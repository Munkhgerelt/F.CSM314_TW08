const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { getDb } = require('../database/db');

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication token is required.' });
    }

    const token = authHeader.split(' ')[1];
    const payload = jwt.verify(token, config.jwtSecret);

    if (!payload.jti || typeof payload.tokenVersion !== 'number') {
      return res.status(401).json({ message: 'Invalid or expired authentication token.' });
    }

    const db = await getDb();
    const revokedToken = await db.get('SELECT jti FROM revoked_tokens WHERE jti = ?', [payload.jti]);
    if (revokedToken) {
      return res.status(401).json({ message: 'Invalid or expired authentication token.' });
    }

    const user = await db.get(
      `SELECT id, full_name, email, role, status, token_version, created_at, updated_at
       FROM users
       WHERE id = ?`,
      [payload.sub]
    );

    if (!user) {
      return res.status(401).json({ message: 'Invalid authentication token.' });
    }

    if (payload.tokenVersion !== user.token_version) {
      return res.status(401).json({ message: 'Invalid or expired authentication token.' });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ message: 'This account is inactive.' });
    }

    req.user = user;
    req.authToken = token;
    req.authPayload = payload;
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired authentication token.' });
  }
}

function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to access this resource.' });
    }

    return next();
  };
}

module.exports = { authenticate, authorize };
