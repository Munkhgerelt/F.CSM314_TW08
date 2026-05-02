const path = require('path');
require('dotenv').config();

const rootDir = path.resolve(__dirname, '..', '..');
const nodeEnv = process.env.NODE_ENV || 'development';
const jwtSecret = process.env.JWT_SECRET || (nodeEnv === 'production' ? null : 'development_secret_change_me');
const passwordResetExpiresMinutes = Number(process.env.PASSWORD_RESET_EXPIRES_MINUTES || 15);

if (!jwtSecret) {
  throw new Error('JWT_SECRET must be configured in production.');
}

if (!Number.isInteger(passwordResetExpiresMinutes) || passwordResetExpiresMinutes < 1) {
  throw new Error('PASSWORD_RESET_EXPIRES_MINUTES must be a positive integer.');
}

module.exports = {
  nodeEnv,
  port: process.env.PORT || 5000,
  dbFile: process.env.DB_FILE || path.join(rootDir, 'data', 'esport_auth.db'),
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  passwordResetExpiresMinutes,
  corsOrigin: process.env.CORS_ORIGIN || '*'
};
