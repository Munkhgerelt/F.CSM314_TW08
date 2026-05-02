const { body } = require('express-validator');
const normalizePhone = require('../utils/normalizePhone');

function isValidPhone(value) {
  return /^\+?[0-9]{7,15}$/.test(normalizePhone(value));
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
}

function passwordValidator(field = 'password') {
  return body(field)
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long.')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter.')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter.')
    .matches(/[0-9]/).withMessage('Password must contain at least one number.');
}

const registerValidator = [
  body('fullName')
    .trim()
    .notEmpty().withMessage('Full name is required.')
    .isLength({ min: 2, max: 80 }).withMessage('Full name must be between 2 and 80 characters.'),
  body('email')
    .trim()
    .isEmail().withMessage('Valid email is required.')
    .normalizeEmail(),
  body('phoneNumber')
    .trim()
    .customSanitizer(normalizePhone)
    .matches(/^\+?[0-9]{7,15}$/).withMessage('Valid phone number is required.'),
  passwordValidator()
];

const loginValidator = [
  body('login')
    .optional()
    .trim()
    .isLength({ min: 1, max: 120 }).withMessage('Email or phone number must be between 1 and 120 characters.')
    .custom((value) => {
      if (isValidEmail(value) || isValidPhone(value)) return true;
      throw new Error('Valid email or phone number is required.');
    }),
  body('email')
    .optional()
    .trim()
    .isEmail().withMessage('Valid email is required.')
    .normalizeEmail(),
  body()
    .custom((value) => {
      if (value.login || value.email) return true;
      throw new Error('Email or phone number is required.');
    }),
  body('password')
    .notEmpty().withMessage('Password is required.')
];

const forgotPasswordValidator = [
  body('email')
    .trim()
    .isEmail().withMessage('Valid email is required.')
    .normalizeEmail()
];

const resetPasswordValidator = [
  body('token')
    .trim()
    .notEmpty().withMessage('Reset token is required.'),
  passwordValidator()
];

module.exports = {
  registerValidator,
  loginValidator,
  forgotPasswordValidator,
  resetPasswordValidator
};
