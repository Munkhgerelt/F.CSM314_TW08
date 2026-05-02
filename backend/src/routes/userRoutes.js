const express = require('express');
const { getDb } = require('../database/db');
const { authenticate, authorize } = require('../middleware/auth');
const validateRequest = require('../middleware/validate');
const {
  updateProfileValidator,
  updateStatusValidator,
  updateRoleValidator,
  listUsersValidator,
  listActivityLogsValidator
} = require('../validators/userValidators');
const sanitizeUser = require('../utils/sanitizeUser');
const logActivity = require('../utils/logActivity');

const router = express.Router();

function getPagination(query) {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 20);
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

function buildUserFilters(query) {
  const clauses = [];
  const params = [];

  if (query.role) {
    clauses.push('role = ?');
    params.push(query.role);
  }

  if (query.status) {
    clauses.push('status = ?');
    params.push(query.status);
  }

  if (query.search) {
    clauses.push('(full_name LIKE ? OR email LIKE ? OR phone_number LIKE ?)');
    params.push(`%${query.search}%`, `%${query.search}%`, `%${query.search}%`);
  }

  return {
    whereSql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params
  };
}

function buildActivityLogFilters(query) {
  const clauses = [];
  const params = [];

  if (query.userId) {
    clauses.push('activity_logs.user_id = ?');
    params.push(Number(query.userId));
  }

  if (query.action) {
    clauses.push('activity_logs.action = ?');
    params.push(query.action);
  }

  return {
    whereSql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params
  };
}

router.patch('/me', authenticate, updateProfileValidator, validateRequest, async (req, res, next) => {
  try {
    const { fullName, email, phoneNumber } = req.body;
    const db = await getDb();

    if (!fullName && !email && !phoneNumber) {
      return res.status(400).json({ message: 'At least one profile field must be provided.' });
    }

    if (email) {
      const existingUser = await db.get(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [email, req.user.id]
      );

      if (existingUser) {
        return res.status(409).json({ message: 'Email is already used by another account.' });
      }
    }

    if (phoneNumber) {
      const existingPhone = await db.get(
        'SELECT id FROM users WHERE phone_number = ? AND id != ?',
        [phoneNumber, req.user.id]
      );

      if (existingPhone) {
        return res.status(409).json({ message: 'Phone number is already used by another account.' });
      }
    }

    const nextFullName = fullName || req.user.full_name;
    const nextEmail = email || req.user.email;
    const nextPhoneNumber = phoneNumber || req.user.phone_number;

    await db.run(
      `UPDATE users
       SET full_name = ?, email = ?, phone_number = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [nextFullName, nextEmail, nextPhoneNumber, req.user.id]
    );

    const updatedUser = await db.get(
      `SELECT id, full_name, email, phone_number, role, status, created_at, updated_at
       FROM users WHERE id = ?`,
      [req.user.id]
    );

    await logActivity({
      userId: req.user.id,
      action: 'PROFILE_UPDATE',
      details: 'User updated own profile.',
      ipAddress: req.ip
    });

    return res.json({
      message: 'Profile updated successfully.',
      user: sanitizeUser(updatedUser)
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/', authenticate, authorize('ADMIN'), listUsersValidator, validateRequest, async (req, res, next) => {
  try {
    const db = await getDb();
    const { page, limit, offset } = getPagination(req.query);
    const { whereSql, params } = buildUserFilters(req.query);
    const totalRow = await db.get(`SELECT COUNT(*) AS total FROM users ${whereSql}`, params);
    const users = await db.all(
      `SELECT id, full_name, email, phone_number, role, status, created_at, updated_at
       FROM users
       ${whereSql}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return res.json({
      users: users.map(sanitizeUser),
      pagination: {
        page,
        limit,
        total: totalRow.total,
        totalPages: Math.ceil(totalRow.total / limit)
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id/status', authenticate, authorize('ADMIN'), updateStatusValidator, validateRequest, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const db = await getDb();

    if (Number(id) === req.user.id && status === 'INACTIVE') {
      return res.status(400).json({ message: 'Admin cannot deactivate their own account.' });
    }

    const targetUser = await db.get('SELECT id, role, status FROM users WHERE id = ?', [id]);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (targetUser.role === 'ADMIN' && status === 'INACTIVE') {
      const remainingActiveAdmins = await db.get(
        `SELECT COUNT(*) AS total
         FROM users
         WHERE role = 'ADMIN' AND status = 'ACTIVE' AND id != ?`,
        [id]
      );

      if (remainingActiveAdmins.total === 0) {
        return res.status(400).json({ message: 'At least one active admin account is required.' });
      }
    }

    await db.run(
      `UPDATE users
       SET status = ?, token_version = token_version + 1, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [status, id]
    );

    const updatedUser = await db.get(
      `SELECT id, full_name, email, phone_number, role, status, created_at, updated_at
       FROM users WHERE id = ?`,
      [id]
    );

    await logActivity({
      userId: req.user.id,
      action: 'USER_STATUS_CHANGED',
      details: `Admin changed user ${id} status to ${status}.`,
      ipAddress: req.ip
    });

    return res.json({
      message: 'User status updated successfully.',
      user: sanitizeUser(updatedUser)
    });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id/role', authenticate, authorize('ADMIN'), updateRoleValidator, validateRequest, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const db = await getDb();

    if (Number(id) === req.user.id) {
      return res.status(400).json({ message: 'Admin cannot change their own role.' });
    }

    const targetUser = await db.get('SELECT id, role, status FROM users WHERE id = ?', [id]);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (targetUser.role === 'ADMIN' && role !== 'ADMIN') {
      const remainingActiveAdmins = await db.get(
        `SELECT COUNT(*) AS total
         FROM users
         WHERE role = 'ADMIN' AND status = 'ACTIVE' AND id != ?`,
        [id]
      );

      if (targetUser.status === 'ACTIVE' && remainingActiveAdmins.total === 0) {
        return res.status(400).json({ message: 'At least one active admin account is required.' });
      }
    }

    await db.run(
      `UPDATE users
       SET role = ?, token_version = token_version + 1, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [role, id]
    );

    const updatedUser = await db.get(
      `SELECT id, full_name, email, phone_number, role, status, created_at, updated_at
       FROM users WHERE id = ?`,
      [id]
    );

    await logActivity({
      userId: req.user.id,
      action: 'USER_ROLE_CHANGED',
      details: `Admin changed user ${id} role to ${role}.`,
      ipAddress: req.ip
    });

    return res.json({
      message: 'User role updated successfully.',
      user: sanitizeUser(updatedUser)
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/activity-logs', authenticate, authorize('ADMIN'), listActivityLogsValidator, validateRequest, async (req, res, next) => {
  try {
    const db = await getDb();
    const { page, limit, offset } = getPagination(req.query);
    const { whereSql, params } = buildActivityLogFilters(req.query);
    const totalRow = await db.get(
      `SELECT COUNT(*) AS total
       FROM activity_logs
       ${whereSql}`,
      params
    );
    const logs = await db.all(
      `SELECT activity_logs.id,
              activity_logs.action,
              activity_logs.details,
              activity_logs.ip_address AS ipAddress,
              activity_logs.created_at AS createdAt,
              users.email AS userEmail,
              users.full_name AS userFullName
       FROM activity_logs
       LEFT JOIN users ON users.id = activity_logs.user_id
       ${whereSql}
       ORDER BY activity_logs.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return res.json({
      logs,
      pagination: {
        page,
        limit,
        total: totalRow.total,
        totalPages: Math.ceil(totalRow.total / limit)
      }
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
