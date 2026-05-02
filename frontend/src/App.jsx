import { useEffect, useMemo, useState } from 'react';

const defaultApiBase = import.meta.env.VITE_API_BASE || 'http://localhost:5000';
const emptyLogin = { login: 'admin@esport.local', password: 'Admin@12345' };
const emptyRegister = { fullName: '', email: '', phoneNumber: '', password: '' };
const emptyProfile = { fullName: '', email: '', phoneNumber: '' };
const emptyUserFilters = { search: '', role: '', status: '' };
const emptyLogFilters = { action: '', userId: '' };

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function readAuthMode() {
  return localStorage.getItem('authMode') === 'register' ? 'register' : 'login';
}

export default function App() {
  const apiBase = defaultApiBase;
  const [token, setToken] = useState(localStorage.getItem('authToken') || '');
  const [user, setUser] = useState(readJson('currentUser', null));
  const [authMode, setAuthMode] = useState(readAuthMode);
  const [activeView, setActiveView] = useState('profile');
  const [toast, setToast] = useState(null);
  const [loginForm, setLoginForm] = useState(emptyLogin);
  const [registerForm, setRegisterForm] = useState(emptyRegister);
  const [profileForm, setProfileForm] = useState(emptyProfile);
  const [userFilters, setUserFilters] = useState(emptyUserFilters);
  const [users, setUsers] = useState([]);
  const [usersPage, setUsersPage] = useState(1);
  const [usersPagination, setUsersPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [logFilters, setLogFilters] = useState(emptyLogFilters);
  const [logs, setLogs] = useState([]);
  const [logsPage, setLogsPage] = useState(1);
  const [logsPagination, setLogsPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [resetEmail, setResetEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const isLoggedIn = Boolean(token && user);
  const isAdmin = user?.role === 'ADMIN';

  const api = useMemo(() => {
    async function request(path, options = {}) {
      const response = await fetch(`${apiBase}${path}`, {
        method: options.method || 'GET',
        headers: {
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: options.body ? JSON.stringify(options.body) : undefined
      });
      const text = await response.text();
      const data = text ? JSON.parse(text) : {};

      if (!response.ok) {
        throw new Error(data.message || 'Request failed');
      }

      return data;
    }

    return { request };
  }, [apiBase, token]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    localStorage.setItem('authMode', authMode);
  }, [authMode]);

  useEffect(() => {
    if (user) {
      setProfileForm({
        fullName: user.fullName || '',
        email: user.email || '',
        phoneNumber: user.phoneNumber || ''
      });
    }
  }, [user]);

  useEffect(() => {
    if (!token) return;
    refreshProfile({ silent: true }).catch(() => clearSession());
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadUsers().catch(showError);
      loadLogs().catch(showError);
    }
  }, [isAdmin, usersPage, logsPage]);

  function notify(message, type = 'success') {
    setToast({ message, type });
  }

  function showError(error) {
    notify(error.message, 'error');
  }

  function saveSession(nextToken, nextUser) {
    setToken(nextToken);
    setUser(nextUser);
    localStorage.setItem('authToken', nextToken);
    localStorage.setItem('currentUser', JSON.stringify(nextUser));
  }

  function clearSession() {
    setToken('');
    setUser(null);
    setActiveView('profile');
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
  }

  async function login(event) {
    event.preventDefault();
    try {
      const data = await api.request('/api/auth/login', {
        method: 'POST',
        body: loginForm
      });
      saveSession(data.token, data.user);
      notify('Signed in successfully');
    } catch (error) {
      showError(error);
    }
  }

  async function register(event) {
    event.preventDefault();
    try {
      await api.request('/api/auth/register', {
        method: 'POST',
        body: registerForm
      });
      setRegisterForm(emptyRegister);
      setAuthMode('login');
      notify('Account created');
    } catch (error) {
      showError(error);
    }
  }

  async function logout() {
    try {
      await api.request('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      showError(error);
    } finally {
      clearSession();
    }
  }

  async function refreshProfile(options = {}) {
    const data = await api.request('/api/auth/me');
    setUser(data.user);
    localStorage.setItem('currentUser', JSON.stringify(data.user));

    if (!options.silent) {
      notify('Profile refreshed');
    }
  }

  async function updateProfile(event) {
    event.preventDefault();
    try {
      const data = await api.request('/api/users/me', {
        method: 'PATCH',
        body: compact(profileForm)
      });
      setUser(data.user);
      localStorage.setItem('currentUser', JSON.stringify(data.user));
      notify('Profile saved');
    } catch (error) {
      showError(error);
    }
  }

  async function loadUsers() {
    const query = queryString({ ...userFilters, page: usersPage, limit: 20 });
    const data = await api.request(`/api/users${query}`);
    setUsers(data.users);
    setUsersPagination(data.pagination);
  }

  async function saveUser(nextUser) {
    try {
      await api.request(`/api/users/${nextUser.id}/role`, {
        method: 'PATCH',
        body: { role: nextUser.role }
      });
      await api.request(`/api/users/${nextUser.id}/status`, {
        method: 'PATCH',
        body: { status: nextUser.status }
      });
      await loadUsers();
      notify('User updated');
    } catch (error) {
      showError(error);
    }
  }

  async function loadLogs() {
    const query = queryString({ ...logFilters, page: logsPage, limit: 20 });
    const data = await api.request(`/api/users/activity-logs${query}`);
    setLogs(data.logs);
    setLogsPagination(data.pagination);
  }

  async function requestPasswordReset(event) {
    event.preventDefault();
    try {
      const data = await api.request('/api/auth/forgot-password', {
        method: 'POST',
        body: { email: resetEmail }
      });
      setResetToken(data.resetToken || '');
      notify('Reset token created');
    } catch (error) {
      showError(error);
    }
  }

  async function resetPassword(event) {
    event.preventDefault();
    try {
      await api.request('/api/auth/reset-password', {
        method: 'POST',
        body: { token: resetToken, password: newPassword }
      });
      setResetToken('');
      setNewPassword('');
      notify('Password updated');
    } catch (error) {
      showError(error);
    }
  }

  function updateUserRow(id, patch) {
    setUsers((currentUsers) => currentUsers.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Internet cafe management</p>
          <h1>User & Access Management</h1>
        </div>
      </header>

      {!isLoggedIn ? (
        <section className="auth-layout">
          <div className="auth-switch" aria-label="Authentication mode">
            <button
              type="button"
              className={authMode === 'login' ? 'active' : ''}
              onClick={() => setAuthMode('login')}
            >
              Sign in
            </button>
            <button
              type="button"
              className={authMode === 'register' ? 'active' : ''}
              onClick={() => setAuthMode('register')}
            >
              Register
            </button>
          </div>

          {authMode === 'login' ? (
            <form className="panel" onSubmit={login}>
              <div className="panel-head">
                <h2>Sign in</h2>
                <span className="tag">Login</span>
              </div>
              <Field label="Email or phone number" value={loginForm.login} onChange={(value) => setLoginForm({ ...loginForm, login: value })} />
              <Field label="Password" type="password" value={loginForm.password} onChange={(value) => setLoginForm({ ...loginForm, password: value })} />
              <button type="submit" className="primary">Sign in</button>
            </form>
          ) : (
            <form className="panel" onSubmit={register}>
              <div className="panel-head">
                <h2>Create account</h2>
                <span className="tag muted">Register</span>
              </div>
              <Field label="Full name" value={registerForm.fullName} placeholder="New User" onChange={(value) => setRegisterForm({ ...registerForm, fullName: value })} />
              <Field label="Email" type="email" value={registerForm.email} placeholder="newuser@example.com" onChange={(value) => setRegisterForm({ ...registerForm, email: value })} />
              <Field label="Phone number" type="tel" value={registerForm.phoneNumber} placeholder="+97699001122" onChange={(value) => setRegisterForm({ ...registerForm, phoneNumber: value })} />
              <Field label="Password" type="password" value={registerForm.password} placeholder="Password123" onChange={(value) => setRegisterForm({ ...registerForm, password: value })} />
              <button type="submit" className="primary">Register</button>
            </form>
          )}
        </section>
      ) : (
        <section className="workspace">
          <aside className="sidebar">
            <div className="user-box">
              <strong>{user.fullName || user.email}</strong>
              <span>{user.role} / {user.status}</span>
            </div>
            <NavButton active={activeView === 'profile'} onClick={() => setActiveView('profile')}>Profile</NavButton>
            {isAdmin && <NavButton active={activeView === 'users'} onClick={() => setActiveView('users')}>Users</NavButton>}
            {isAdmin && <NavButton active={activeView === 'logs'} onClick={() => setActiveView('logs')}>Activity log</NavButton>}
            <NavButton active={activeView === 'password'} onClick={() => setActiveView('password')}>Password reset</NavButton>
            <button className="nav-button danger" type="button" onClick={logout}>Sign out</button>
          </aside>

          <section className="content">
            {activeView === 'profile' && (
              <section className="view-panel">
                <div className="panel-head">
                  <h2>Profile</h2>
                  <button type="button" onClick={() => refreshProfile().catch(showError)}>Refresh</button>
                </div>
                <dl className="profile-list">
                  <ProfileItem label="Name" value={user.fullName} />
                  <ProfileItem label="Email" value={user.email} />
                  <ProfileItem label="Phone" value={user.phoneNumber} />
                  <ProfileItem label="Role" value={user.role} />
                  <ProfileItem label="Status" value={user.status} />
                </dl>
                <form className="inline-form" onSubmit={updateProfile}>
                  <Field label="Name" value={profileForm.fullName} onChange={(value) => setProfileForm({ ...profileForm, fullName: value })} />
                  <Field label="Email" type="email" value={profileForm.email} onChange={(value) => setProfileForm({ ...profileForm, email: value })} />
                  <Field label="Phone" type="tel" value={profileForm.phoneNumber} required={false} onChange={(value) => setProfileForm({ ...profileForm, phoneNumber: value })} />
                  <button type="submit" className="primary">Save</button>
                </form>
              </section>
            )}

            {activeView === 'users' && isAdmin && (
              <section className="view-panel">
                <div className="panel-head">
                  <h2>Users</h2>
                  <button type="button" onClick={() => loadUsers().catch(showError)}>Refresh</button>
                </div>
                <form className="filter-row" onSubmit={(event) => {
                  event.preventDefault();
                  setUsersPage(1);
                  loadUsers().catch(showError);
                }}>
                  <input type="search" placeholder="Search by name, email, or phone" value={userFilters.search} onChange={(event) => setUserFilters({ ...userFilters, search: event.target.value })} />
                  <Select value={userFilters.role} onChange={(value) => setUserFilters({ ...userFilters, role: value })} options={['', 'ADMIN', 'USER']} emptyLabel="All roles" />
                  <Select value={userFilters.status} onChange={(value) => setUserFilters({ ...userFilters, status: value })} options={['', 'ACTIVE', 'INACTIVE']} emptyLabel="All statuses" />
                  <button type="submit">Filter</button>
                </form>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Phone</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.length === 0 ? (
                        <tr><td colSpan="7">No users found.</td></tr>
                      ) : users.map((item) => (
                        <tr key={item.id}>
                          <td>{item.id}</td>
                          <td>{item.fullName}</td>
                          <td>{item.email}</td>
                          <td>{item.phoneNumber || '-'}</td>
                          <td>
                            <Select value={item.role} onChange={(value) => updateUserRow(item.id, { role: value })} options={['ADMIN', 'USER']} />
                          </td>
                          <td>
                            <Select value={item.status} onChange={(value) => updateUserRow(item.id, { status: value })} options={['ACTIVE', 'INACTIVE']} />
                          </td>
                          <td className="actions">
                            <button type="button" onClick={() => saveUser(item)}>Save</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pager
                  page={usersPagination.page}
                  totalPages={usersPagination.totalPages || 1}
                  onPrev={() => setUsersPage((page) => Math.max(1, page - 1))}
                  onNext={() => setUsersPage((page) => Math.min(usersPagination.totalPages || 1, page + 1))}
                />
              </section>
            )}

            {activeView === 'logs' && isAdmin && (
              <section className="view-panel">
                <div className="panel-head">
                  <h2>Activity log</h2>
                  <button type="button" onClick={() => loadLogs().catch(showError)}>Refresh</button>
                </div>
                <form className="filter-row logs" onSubmit={(event) => {
                  event.preventDefault();
                  setLogsPage(1);
                  loadLogs().catch(showError);
                }}>
                  <input type="search" placeholder="LOGIN, LOGOUT..." value={logFilters.action} onChange={(event) => setLogFilters({ ...logFilters, action: event.target.value })} />
                  <input type="number" min="1" placeholder="User ID" value={logFilters.userId} onChange={(event) => setLogFilters({ ...logFilters, userId: event.target.value })} />
                  <button type="submit">Filter</button>
                </form>
                <div className="log-list">
                  {logs.length === 0 ? (
                    <article className="log-item">No logs found.</article>
                  ) : logs.map((log) => (
                    <article className="log-item" key={log.id}>
                      <strong>{log.action}</strong>
                      <div className="log-meta">
                        <span>{log.createdAt}</span>
                        <span>{log.userEmail || 'unknown user'}</span>
                        <span>{log.ipAddress || '-'}</span>
                      </div>
                      <p>{log.details || ''}</p>
                    </article>
                  ))}
                </div>
                <Pager
                  page={logsPagination.page}
                  totalPages={logsPagination.totalPages || 1}
                  onPrev={() => setLogsPage((page) => Math.max(1, page - 1))}
                  onNext={() => setLogsPage((page) => Math.min(logsPagination.totalPages || 1, page + 1))}
                />
              </section>
            )}

            {activeView === 'password' && (
              <section className="view-panel">
                <div className="password-grid">
                  <form className="panel flat" onSubmit={requestPasswordReset}>
                    <div className="panel-head">
                      <h2>Reset token</h2>
                    </div>
                    <Field label="Email" type="email" value={resetEmail} placeholder="user@example.com" onChange={setResetEmail} />
                    <button type="submit">Create token</button>
                    <Field label="Token" value={resetToken} onChange={setResetToken} readOnly />
                  </form>

                  <form className="panel flat" onSubmit={resetPassword}>
                    <div className="panel-head">
                      <h2>Change password</h2>
                    </div>
                    <Field label="Token" value={resetToken} onChange={setResetToken} />
                    <Field label="New password" type="password" value={newPassword} placeholder="NewPassword123" onChange={setNewPassword} />
                    <button type="submit" className="primary">Change</button>
                  </form>
                </div>
              </section>
            )}
          </section>
        </section>
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.message}</div>}
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder = '', readOnly = false, required = true }) {
  return (
    <label>
      {label}
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        readOnly={readOnly}
        required={required && !readOnly}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function NavButton({ active, onClick, children }) {
  return (
    <button className={`nav-button ${active ? 'active' : ''}`} type="button" onClick={onClick}>
      {children}
    </button>
  );
}

function ProfileItem({ label, value }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value || '-'}</dd>
    </div>
  );
}

function Select({ value, onChange, options, emptyLabel }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => (
        <option value={option} key={option}>
          {option || emptyLabel}
        </option>
      ))}
    </select>
  );
}

function Pager({ page, totalPages, onPrev, onNext }) {
  return (
    <div className="pager">
      <button type="button" onClick={onPrev} disabled={page <= 1}>Previous</button>
      <span>{page || 1} / {totalPages || 1}</span>
      <button type="button" onClick={onNext} disabled={page >= totalPages}>Next</button>
    </div>
  );
}

function compact(payload) {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== ''));
}

function queryString(payload) {
  const params = new URLSearchParams(compact(payload));
  const query = params.toString();
  return query ? `?${query}` : '';
}
