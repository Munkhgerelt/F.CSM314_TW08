const { body, param, query } = require('express-validator');

const allowedRoles = ['ADMIN', 'CUSTOMER'];
const allowedStatuses = ['ACTIVE', 'INACTIVE'];

const updateProfileValidator = [
  body('fullName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 80 }).withMessage('Full name must be between 2 and 80 characters.'),
  body('email')
    .optional()
    .trim()
    .isEmail().withMessage('Valid email is required.')
    .normalizeEmail()
];

const updateStatusValidator = [
  param('id')
    .isInt({ min: 1 }).withMessage('User id must be a valid number.'),
  body('status')
    .isIn(allowedStatuses).withMessage('Status must be ACTIVE or INACTIVE.')
];

const updateRoleValidator = [
  param('id')
    .isInt({ min: 1 }).withMessage('User id must be a valid number.'),
  body('role')
    .isIn(allowedRoles).withMessage('Role must be ADMIN or CUSTOMER.')
];

const listUsersValidator = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive number.'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100.'),
  query('role')
    .optional()
    .isIn(allowedRoles).withMessage('Role must be ADMIN or CUSTOMER.'),
  query('status')
    .optional()
    .isIn(allowedStatuses).withMessage('Status must be ACTIVE or INACTIVE.'),
  query('search')
    .optional()
    .trim()
    .isLength({ min: 1, max: 80 }).withMessage('Search must be between 1 and 80 characters.')
];

const listActivityLogsValidator = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive number.'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100.'),
  query('userId')
    .optional()
    .isInt({ min: 1 }).withMessage('User id must be a valid number.'),
  query('action')
    .optional()
    .trim()
    .isLength({ min: 1, max: 80 }).withMessage('Action must be between 1 and 80 characters.')
];

module.exports = {
  updateProfileValidator,
  updateStatusValidator,
  updateRoleValidator,
  listUsersValidator,
  listActivityLogsValidator
};
