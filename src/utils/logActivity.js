const { getDb } = require('../database/db');

async function logActivity({ userId = null, action, details = null, ipAddress = null }) {
  const db = await getDb();
  await db.run(
    `INSERT INTO activity_logs (user_id, action, details, ip_address)
     VALUES (?, ?, ?, ?)`,
    [userId, action, details, ipAddress]
  );
}

module.exports = logActivity;
