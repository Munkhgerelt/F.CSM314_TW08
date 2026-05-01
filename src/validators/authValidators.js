const { body } = require('express-validator');

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
  passwordValidator()
];

const loginValidator = [
  body('email')
    .trim()
    .isEmail().withMessage('Valid email is required.')
    .normalizeEmail(),
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
