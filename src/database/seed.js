const { initDb, getDb } = require('./db');
const bcrypt = require('bcryptjs');

async function seed() {
  await initDb();
  const db = await getDb();

  const demoUser = await db.get('SELECT id FROM users WHERE email = ?', ['customer@example.com']);
  if (!demoUser) {
    const passwordHash = await bcrypt.hash('Customer@12345', 12);
    await db.run(
      `INSERT INTO users (full_name, email, password_hash, role, status)
       VALUES (?, ?, ?, ?, ?)`,
      ['Demo Customer', 'customer@example.com', passwordHash, 'CUSTOMER', 'ACTIVE']
    );
  }

  console.log('Database seeded.');
  console.log('Demo account credentials are listed in README.md.');
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
