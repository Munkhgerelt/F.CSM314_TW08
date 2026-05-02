const { initDb, getDb } = require('./db');
const bcrypt = require('bcryptjs');

async function seed() {
  await initDb();
  const db = await getDb();

  const demoUser = await db.get('SELECT id FROM users WHERE email = ?', ['user@example.com']);
  const passwordHash = await bcrypt.hash('User@12345', 12);

  if (demoUser) {
    await db.run(
      `UPDATE users
       SET full_name = ?, password_hash = ?, role = ?, status = ?, token_version = token_version + 1, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      ['Demo User', passwordHash, 'USER', 'ACTIVE', demoUser.id]
    );
  } else {
    const legacyDemoUser = await db.get('SELECT id FROM users WHERE email = ?', ['customer@example.com']);

    if (legacyDemoUser) {
      await db.run(
        `UPDATE users
         SET full_name = ?, email = ?, password_hash = ?, role = ?, status = ?, token_version = token_version + 1, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        ['Demo User', 'user@example.com', passwordHash, 'USER', 'ACTIVE', legacyDemoUser.id]
      );
    } else {
      await db.run(
        `INSERT INTO users (full_name, email, password_hash, role, status)
         VALUES (?, ?, ?, ?, ?)`,
        ['Demo User', 'user@example.com', passwordHash, 'USER', 'ACTIVE']
      );
    }
  }

  console.log('Database seeded.');
  console.log('Demo account credentials are listed in README.md.');
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
