const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const config = require('../config/env');
const { getDb } = require('../database/db');
const validateRequest = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const {
  registerValidator,
  loginValidator,
  forgotPasswordValidator,
  resetPasswordValidator
} = require('../validators/authValidators');
const sanitizeUser = require('../utils/sanitizeUser');
const logActivity = require('../utils/logActivity');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skip: () => config.nodeEnv === 'test',
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again later.' }
});

function createToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      tokenVersion: user.token_version,
      jti: crypto.randomUUID()
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}

function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

router.post('/register', registerValidator, validateRequest, async (req, res, next) => {
  try {
    const { fullName, email, password } = req.body;
    const db = await getDb();

    const existingUser = await db.get('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser) {
      return res.status(409).json({ message: 'Email is already registered.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await db.run(
      `INSERT INTO users (full_name, email, password_hash, role, status)
       VALUES (?, ?, ?, 'CUSTOMER', 'ACTIVE')`,
      [fullName, email, passwordHash]
    );

    const user = await db.get(
      `SELECT id, full_name, email, role, status, created_at, updated_at
       FROM users WHERE id = ?`,
      [result.lastID]
    );

    await logActivity({
      userId: user.id,
      action: 'REGISTER',
      details: 'New customer account registered.',
      ipAddress: req.ip
    });

    return res.status(201).json({
      message: 'Registration successful.',
      user: sanitizeUser(user)
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/login', loginLimiter, loginValidator, validateRequest, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const db = await getDb();

    const user = await db.get(
      `SELECT id, full_name, email, password_hash, role, status, token_version, created_at, updated_at
       FROM users
       WHERE email = ?`,
      [email]
    );

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      await logActivity({
        userId: user.id,
        action: 'FAILED_LOGIN',
        details: 'Invalid password entered.',
        ipAddress: req.ip
      });
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    if (user.status !== 'ACTIVE') {
      await logActivity({
        userId: user.id,
        action: 'BLOCKED_LOGIN_ATTEMPT',
        details: 'Inactive account attempted to log in.',
        ipAddress: req.ip
      });
      return res.status(403).json({ message: 'This account is inactive.' });
    }

    const token = createToken(user);

    await logActivity({
      userId: user.id,
      action: 'LOGIN',
      details: 'User logged in successfully.',
      ipAddress: req.ip
    });

    return res.json({
      message: 'Login successful.',
      token,
      user: sanitizeUser(user)
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/forgot-password', forgotPasswordValidator, validateRequest, async (req, res, next) => {
  try {
    const { email } = req.body;
    const db = await getDb();
    const user = await db.get('SELECT id, status FROM users WHERE email = ?', [email]);
    const response = {
      message: 'If the email belongs to an active account, a password reset token has been generated.'
    };

    if (!user || user.status !== 'ACTIVE') {
      return res.json(response);
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashResetToken(resetToken);
    const expiresAt = Date.now() + config.passwordResetExpiresMinutes * 60 * 1000;

    await db.run(
      `UPDATE password_reset_tokens
       SET used_at = CURRENT_TIMESTAMP
       WHERE user_id = ? AND used_at IS NULL`,
      [user.id]
    );

    await db.run(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES (?, ?, ?)`,
      [user.id, tokenHash, expiresAt]
    );

    await logActivity({
      userId: user.id,
      action: 'PASSWORD_RESET_REQUESTED',
      details: 'Password reset token generated.',
      ipAddress: req.ip
    });

    if (config.nodeEnv !== 'production') {
      response.resetToken = resetToken;
    }

    return res.json(response);
  } catch (error) {
    return next(error);
  }
});

router.post('/reset-password', resetPasswordValidator, validateRequest, async (req, res, next) => {
  const db = await getDb();

  try {
    const { token, password } = req.body;
    const tokenHash = hashResetToken(token);
    const resetToken = await db.get(
      `SELECT password_reset_tokens.id,
              password_reset_tokens.user_id AS userId,
              password_reset_tokens.expires_at AS expiresAt,
              password_reset_tokens.used_at AS usedAt,
              users.status AS userStatus
       FROM password_reset_tokens
       JOIN users ON users.id = password_reset_tokens.user_id
       WHERE password_reset_tokens.token_hash = ?`,
      [tokenHash]
    );

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= Date.now()) {
      return res.status(400).json({ message: 'Reset token is invalid or expired.' });
    }

    if (resetToken.userStatus !== 'ACTIVE') {
      return res.status(403).json({ message: 'This account is inactive.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await db.exec('BEGIN');
    await db.run(
      `UPDATE users
       SET password_hash = ?,
           token_version = token_version + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [passwordHash, resetToken.userId]
    );
    await db.run(
      `UPDATE password_reset_tokens
       SET used_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [resetToken.id]
    );
    await db.exec('COMMIT');

    await logActivity({
      userId: resetToken.userId,
      action: 'PASSWORD_RESET',
      details: 'User reset account password.',
      ipAddress: req.ip
    });

    return res.json({ message: 'Password has been reset successfully.' });
  } catch (error) {
    await db.exec('ROLLBACK').catch(() => {});
    return next(error);
  }
});

router.get('/me', authenticate, (req, res) => {
  return res.json({ user: sanitizeUser(req.user) });
});

router.post('/logout', authenticate, async (req, res, next) => {
  try {
    const db = await getDb();
    await db.run(
      `INSERT OR IGNORE INTO revoked_tokens (jti, user_id, expires_at)
       VALUES (?, ?, ?)`,
      [req.authPayload.jti, req.user.id, req.authPayload.exp]
    );

    await logActivity({
      userId: req.user.id,
      action: 'LOGOUT',
      details: 'User logged out and JWT was revoked.',
      ipAddress: req.ip
    });

    return res.json({ message: 'Logout successful.' });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
