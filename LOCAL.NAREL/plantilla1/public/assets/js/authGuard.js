// ============================================================
// AuthGuard - Protección de rutas en HTML (client side)
// La fuente de verdad es el backend /api/auth/me (no el browser JWT)
// ya que el backend valida la sesión única en user_sessions.
// ============================================================

async function getCurrentUser() {
  try {
    const r = await fetch('/api/auth/me', { credentials: 'same-origin' });
    if (r.status === 401 || r.status === 403) return null;
    if (!r.ok) return null;
    const json = await r.json();
    if (!json || !json.ok) return null;
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
  const opts = Object.assign(
    {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
    },
    options || {}
  );
  if (opts.body && typeof opts.body !== 'string' && !(opts.body instanceof FormData)) {
    opts.body = JSON.stringify(opts.body);
  }
  if (opts.body instanceof FormData) delete opts.headers['Content-Type'];
  try {
    const r = await fetch(url, opts);
    let json = { ok: false, message: 'Error de red' };
    try { json = await r.json(); } catch (_e) {}
    json.__status = r.status;
    return json;
  } catch (err) {
    return { ok: false, message: err.message || 'Error de conexión' };
  }
}

async function logout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
  } catch (_e) { /* no importa el error, igualmente el user queda sin sesión */ }
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
};
