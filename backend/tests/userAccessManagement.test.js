const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const dbFile = path.join(os.tmpdir(), `user-access-management-${process.pid}.db`);

process.env.NODE_ENV = 'test';
process.env.DB_FILE = dbFile;
process.env.JWT_SECRET = 'test_secret_for_user_access_management_module';
process.env.JWT_EXPIRES_IN = '1h';
process.env.PASSWORD_RESET_EXPIRES_MINUTES = '15';

const app = require('../src/app');
const { closeDb, initDb } = require('../src/database/db');

let server;
let baseUrl;

async function api(pathname, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();

  return {
    status: response.status,
    body: text ? JSON.parse(text) : null
  };
}

before(async () => {
  await initDb();
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await closeDb();
  fs.rmSync(dbFile, { force: true });
});

test('user access management security flows', async () => {
  const regularUser = {
    fullName: 'Integration User',
    email: 'integration.user@example.com',
    password: 'User12345'
  };

  const register = await api('/api/auth/register', {
    method: 'POST',
    body: regularUser
  });
  assert.equal(register.status, 201);
  assert.equal(register.body.user.email, regularUser.email);

  const adminLogin = await api('/api/auth/login', {
    method: 'POST',
    body: {
      email: 'admin@esport.local',
      password: 'Admin@12345'
    }
  });
  assert.equal(adminLogin.status, 200);
  const adminToken = adminLogin.body.token;

  const userList = await api('/api/users?limit=1&role=USER', { token: adminToken });
  assert.equal(userList.status, 200);
  assert.equal(userList.body.pagination.limit, 1);
  assert.ok(userList.body.pagination.total >= 1);

  const userLogin = await api('/api/auth/login', {
    method: 'POST',
    body: {
      email: regularUser.email,
      password: regularUser.password
    }
  });
  assert.equal(userLogin.status, 200);
  const firstUserToken = userLogin.body.token;

  const logout = await api('/api/auth/logout', {
    method: 'POST',
    token: firstUserToken
  });
  assert.equal(logout.status, 200);

  const revokedTokenCheck = await api('/api/auth/me', { token: firstUserToken });
  assert.equal(revokedTokenCheck.status, 401);

  const secondUserLogin = await api('/api/auth/login', {
    method: 'POST',
    body: {
      email: regularUser.email,
      password: regularUser.password
    }
  });
  assert.equal(secondUserLogin.status, 200);
  const secondUserToken = secondUserLogin.body.token;
  const userId = secondUserLogin.body.user.id;

  const deactivate = await api(`/api/users/${userId}/status`, {
    method: 'PATCH',
    token: adminToken,
    body: { status: 'INACTIVE' }
  });
  assert.equal(deactivate.status, 200);

  const wrongPasswordWhileInactive = await api('/api/auth/login', {
    method: 'POST',
    body: {
      email: regularUser.email,
      password: 'WrongPassword123'
    }
  });
  assert.equal(wrongPasswordWhileInactive.status, 401);

  const correctPasswordWhileInactive = await api('/api/auth/login', {
    method: 'POST',
    body: {
      email: regularUser.email,
      password: regularUser.password
    }
  });
  assert.equal(correctPasswordWhileInactive.status, 403);

  const invalidatedByStatusChange = await api('/api/auth/me', { token: secondUserToken });
  assert.equal(invalidatedByStatusChange.status, 401);

  const reactivate = await api(`/api/users/${userId}/status`, {
    method: 'PATCH',
    token: adminToken,
    body: { status: 'ACTIVE' }
  });
  assert.equal(reactivate.status, 200);

  const forgotPassword = await api('/api/auth/forgot-password', {
    method: 'POST',
    body: { email: regularUser.email }
  });
  assert.equal(forgotPassword.status, 200);
  assert.ok(forgotPassword.body.resetToken);

  const resetPassword = await api('/api/auth/reset-password', {
    method: 'POST',
    body: {
      token: forgotPassword.body.resetToken,
      password: 'NewUser123'
    }
  });
  assert.equal(resetPassword.status, 200);

  const oldPasswordLogin = await api('/api/auth/login', {
    method: 'POST',
    body: {
      email: regularUser.email,
      password: regularUser.password
    }
  });
  assert.equal(oldPasswordLogin.status, 401);

  const newPasswordLogin = await api('/api/auth/login', {
    method: 'POST',
    body: {
      email: regularUser.email,
      password: 'NewUser123'
    }
  });
  assert.equal(newPasswordLogin.status, 200);

  const promote = await api(`/api/users/${userId}/role`, {
    method: 'PATCH',
    token: adminToken,
    body: { role: 'ADMIN' }
  });
  assert.equal(promote.status, 200);
  assert.equal(promote.body.user.role, 'ADMIN');

  const promotedLogin = await api('/api/auth/login', {
    method: 'POST',
    body: {
      email: regularUser.email,
      password: 'NewUser123'
    }
  });
  assert.equal(promotedLogin.status, 200);
  assert.equal(promotedLogin.body.user.role, 'ADMIN');

  const promotedAdminAccess = await api('/api/users?limit=2', {
    token: promotedLogin.body.token
  });
  assert.equal(promotedAdminAccess.status, 200);

  const activityLogs = await api('/api/users/activity-logs?limit=5', { token: adminToken });
  assert.equal(activityLogs.status, 200);
  assert.equal(activityLogs.body.pagination.limit, 5);
});
