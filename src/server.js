const app = require('./app');
const config = require('./config/env');
const { initDb } = require('./database/db');

async function startServer() {
  await initDb();

  app.listen(config.port, () => {
    console.log(`User & Access Management module running on http://localhost:${config.port}`);
    console.log('Demo accounts are listed in README.md.');
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
