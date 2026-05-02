const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const bcrypt = require('bcryptjs');
const config = require('../config/env');

let db;

async function getDb() {
  if (!db) {
    const dbDir = path.dirname(config.dbFile);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    db = await open({
      filename: config.dbFile,
      driver: sqlite3.Database
    });

    await db.exec('PRAGMA foreign_keys = ON;');
  }

  return db;
}

async function ensureColumn(database, tableName, columnName, definition) {
  const columns = await database.all(`PRAGMA table_info(${tableName})`);
  const hasColumn = columns.some((column) => column.name === columnName);

  if (!hasColumn) {
    await database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition};`);
  }
}

async function migrateLegacyUserRole(database) {
  const usersTable = await database.get(
    `SELECT sql
     FROM sqlite_master
     WHERE type = 'table' AND name = 'users'`
  );

  if (!usersTable || !usersTable.sql.includes("'CUSTOMER'")) {
    await database.run("UPDATE users SET role = 'USER' WHERE role = 'CUSTOMER'");
    return;
  }

  await database.exec('PRAGMA foreign_keys = OFF;');
  await database.exec('BEGIN;');

  try {
    await database.exec(`
      CREATE TABLE users_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'USER' CHECK (role IN ('ADMIN', 'USER')),
        status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
        token_version INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await database.exec(`
      INSERT INTO users_new (id, full_name, email, password_hash, role, status, token_version, created_at, updated_at)
      SELECT id,
             full_name,
             email,
             password_hash,
             CASE WHEN role = 'CUSTOMER' THEN 'USER' ELSE role END,
             status,
             token_version,
             created_at,
             updated_at
      FROM users;
    `);

    await database.exec('DROP TABLE users;');
    await database.exec('ALTER TABLE users_new RENAME TO users;');
    await database.exec('COMMIT;');
  } catch (error) {
    await database.exec('ROLLBACK;');
    throw error;
  } finally {
    await database.exec('PRAGMA foreign_keys = ON;');
  }
}

async function initDb() {
  const database = await getDb();

  await database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'USER' CHECK (role IN ('ADMIN', 'USER')),
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
      token_version INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      details TEXT,
      ip_address TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS revoked_tokens (
      jti TEXT PRIMARY KEY,
      user_id INTEGER,
      expires_at INTEGER NOT NULL,
      revoked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at INTEGER NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
  `);

  await ensureColumn(database, 'users', 'token_version', 'INTEGER NOT NULL DEFAULT 0');
  await migrateLegacyUserRole(database);
  await database.run('DELETE FROM revoked_tokens WHERE expires_at <= ?', [Math.floor(Date.now() / 1000)]);

  const admin = await database.get('SELECT id FROM users WHERE role = ?', ['ADMIN']);
  if (!admin) {
    const passwordHash = await bcrypt.hash('Admin@12345', 12);
    await database.run(
      `INSERT INTO users (full_name, email, password_hash, role, status)
       VALUES (?, ?, ?, ?, ?)`,
      ['System Admin', 'admin@esport.local', passwordHash, 'ADMIN', 'ACTIVE']
    );
  }

  return database;
}

async function closeDb() {
  if (db) {
    await db.close();
    db = null;
  }
}

module.exports = { getDb, initDb, closeDb };
