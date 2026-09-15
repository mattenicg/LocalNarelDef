// ============================================================
// AuthGuard - Protección de rutas en HTML (client side)
// La fuente de verdad es el backend /api/auth/me
// Soporta cookies de sesión e inclusión de Bearer token + X-Session-Id
// para compatibilidad total dentro de iframes y navegadores modernos.
// ============================================================

function getStoredToken() {
  try {
    return localStorage.getItem('nl_token') || null;
  } catch (_e) {
    return null;
  }
}

function getStoredSessionId() {
  try {
    return localStorage.getItem('nl_session_id') || null;
  } catch (_e) {
    return null;
  }
}

function storeAuth(token, sessionId) {
  try {
    if (token) localStorage.setItem('nl_token', token);
    if (sessionId) localStorage.setItem('nl_session_id', sessionId);
  } catch (_e) {}
}

function clearStoredAuth() {
  try {
    localStorage.removeItem('nl_token');
    localStorage.removeItem('nl_session_id');
  } catch (_e) {}
}

async function getCurrentUser() {
  try {
    const headers = {};
    const token = getStoredToken();
    const sessionId = getStoredSessionId();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (sessionId) headers['X-Session-Id'] = sessionId;

    const r = await fetch('/api/auth/me', { credentials: 'include', headers });
    if (r.status === 401 || r.status === 403) {
      clearStoredAuth();
      return null;
    }
    if (!r.ok) return null;
    const json = await r.json();
    if (!json || !json.ok) {
      clearStoredAuth();
      return null;
    }
    return json.user || null;
  } catch (e) {
    return null;
  }
}

async function requireAuth(opts = {}) {
  // opts.redirectTo = url a redirigir si no está autenticado (default /login.html)
  // opts.requireAdmin = true -> si role != admin redirige a /dashboard.html
  const user = await getCurrentUser();
  if (!user) {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.replace(`${opts.redirectTo || '/login.html'}?next=${next}`);
    return null;
  }
  if (opts.requireAdmin && user.role !== 'admin') {
    window.location.replace('/dashboard.html?err=forbidden');
    return null;
  }
  return user;
}

async function redirectIfAlreadyLoggedIn() {
  const user = await getCurrentUser();
  if (!user) return false;
  const nextUrl = new URLSearchParams(window.location.search).get('next');
  if (nextUrl && /^\/[A-Za-z0-9\-_\.\/\?=&]*$/.test(nextUrl)) {
    window.location.replace(nextUrl);
  } else {
    window.location.replace(user.role === 'admin' ? '/admin/dashboard.html' : '/dashboard.html');
  }
  return true;
}

// Utilidades comunes en formularios

function setMessage(containerId, msg, type = 'info') {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.textContent = msg || '';
  el.className = `form-message form-message-${type}`;
  if (!msg) el.className = '';
  el.style.display = msg ? 'block' : 'none';
}

function setButtonLoading(btnId, loading, textLoading = 'Cargando...') {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  if (loading) {
    btn.dataset.prevText = btn.textContent;
    btn.textContent = textLoading;
    btn.disabled = true;
  } else {
    if (btn.dataset.prevText) btn.textContent = btn.dataset.prevText;
    btn.disabled = false;
  }
}

async function apiFetch(url, options = {}) {
  const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
  const token = getStoredToken();
  const sessionId = getStoredSessionId();
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (sessionId && !headers['X-Session-Id']) {
    headers['X-Session-Id'] = sessionId;
  }

  const opts = Object.assign(
    {
      credentials: 'include',
      headers
    },
    options || {}
  );
  opts.headers = headers;

  if (opts.body && typeof opts.body !== 'string' && !(opts.body instanceof FormData)) {
    opts.body = JSON.stringify(opts.body);
  }
  if (opts.body instanceof FormData) delete opts.headers['Content-Type'];
  try {
    const r = await fetch(url, opts);
    let json = { ok: false, message: 'Error de red' };
    try { json = await r.json(); } catch (_e) {}
    json.__status = r.status;
    if (json.user && json.user.token) {
      storeAuth(json.user.token, json.user.session_id);
    }
    return json;
  } catch (err) {
    return { ok: false, message: err.message || 'Error de conexión' };
  }
}

async function logout() {
  try {
    const headers = {};
    const token = getStoredToken();
    const sessionId = getStoredSessionId();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (sessionId) headers['X-Session-Id'] = sessionId;
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include', headers });
  } catch (_e) { /* no importa el error, igualmente el user queda sin sesión */ }
  clearStoredAuth();
  return true;
}

window.auth = {
  getCurrentUser,
  requireAuth,
  redirectIfAlreadyLoggedIn,
  setMessage,
  setButtonLoading,
  apiFetch,
  logout,
  storeAuth,
  clearStoredAuth,
  getStoredToken,
  getStoredSessionId
};
