// Compatibilidad de carga para el frontend existente. La autenticación y los
// datos pasan exclusivamente por el backend propio.

(function () {
  async function fetchPublicConfig() {
    try {
      const r = await fetch('/api/config/public', { cache: 'no-cache' });
      if (!r.ok) return null;
      return await r.json();
    } catch (e) {
      return null;
    }
  }

  async function initSupabaseBrowser() {
    if (window.__SUPABASE_CLIENT_INITIALIZED__) return window.supabaseClient || null;

    window.__POSTGRES_BACKEND__ = true;
    window.supabaseClient = null;
    window.__SUPABASE_CLIENT_INITIALIZED__ = true;
    return window.supabaseClient;
  }

  window.initSupabaseBrowser = initSupabaseBrowser;
})();
