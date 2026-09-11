(function () {
  'use strict';

  const ICONS = {
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    services: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
    image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    enter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
    brain: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-2.54z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-2.54z"/></svg>',
    sparkles: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/><path d="M19 14l.75 2.25L22 17l-2.25.75L19 20l-.75-2.25L16 17l2.25-.75L19 14z"/><path d="M5 15l.75 2.25L8 18l-2.25.75L5 21l-.75-2.25L2 18l2.25-.75L5 15z"/></svg>',
    clipboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>'
  };

  const DAYS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
  const DAYS_LABELS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  const State = {
    token: null,
    admin: null,
    lastTenantId: null,
    tenants: [],
    cache: {}
  };

  const el = (id) => document.getElementById(id);
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    return String(v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  };

  const App = {
    requireAuth() {
      const token = localStorage.getItem('admin_token');
      if (!token) {
        window.location.replace('login.html');
        return false;
      }
      State.token = token;
      try {
        const last = localStorage.getItem('admin_last_tenant');
        if (last) State.lastTenantId = Number(last) || null;
      } catch (e) {}
      return true;
    },

    logout() {
      try {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_name');
        localStorage.removeItem('admin_email');
      } catch (e) {}
      State.token = null;
      State.admin = null;
      window.location.replace('login.html');
    },

    async api(url, opts) {
      opts = opts || {};
      const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
      if (State.token) headers['Authorization'] = 'Bearer ' + State.token;

      const options = {
        method: opts.method || 'GET',
        headers: headers
      };
      if (opts.body !== undefined && options.method !== 'GET') {
        options.body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
      }

      let res;
      try {
        res = await fetch(url, options);
      } catch (err) {
        App.showToast('Error de conexión: revisá tu conexión a internet.', 'error');
        throw err;
      }

      if (res.status === 401) {
        try { localStorage.removeItem('admin_token'); } catch (e) {}
        State.token = null;
        App.showToast('Sesión expirada. Redirigiendo a login...', 'warning');
        setTimeout(() => App.logout(), 900);
        throw new Error('Unauthorized');
      }

      let data = null;
      try {
        const txt = await res.text();
        data = txt ? JSON.parse(txt) : null;
      } catch (err) {
        data = null;
      }

      if (!res.ok) {
        const msg = (data && (data.error || data.message)) || ('Error ' + res.status);
        App.showToast(msg, 'error');
        const error = new Error(msg);
        error.status = res.status;
        error.data = data;
        throw error;
      }
      return data;
    },

    showToast(mensaje, tipo) {
      tipo = tipo || 'info';
      const container = el('toastContainer');
      if (!container) return;
      const toast = document.createElement('div');
      toast.className = 'toast ' + tipo;
      const iconMap = { success: ICONS.check, error: ICONS.x, warning: ICONS.warning, info: ICONS.info };
      toast.innerHTML =
        '<div class="toast-icon">' + (iconMap[tipo] || ICONS.info) + '</div>' +
        '<div class="toast-body">' +
          '<div class="toast-title">' + (tipo === 'success' ? 'Éxito' : tipo === 'error' ? 'Error' : tipo === 'warning' ? 'Atención' : 'Información') + '</div>' +
          '<div class="toast-message">' + esc(mensaje) + '</div>' +
        '</div>';
      container.appendChild(toast);
      requestAnimationFrame(() => toast.classList.add('show'));
      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 320);
      }, 3500);
    },

    showModal(titulo, htmlCuerpo, onConfirm, textoOk) {
      textoOk = textoOk || 'Guardar';
      el('modalTitle').textContent = titulo || '';
      el('modalBody').innerHTML = htmlCuerpo || '';
      el('modalFooter').innerHTML =
        '<button class="btn btn-outline" id="modalBtnCancel">Cancelar</button>' +
        '<button class="btn btn-primary" id="modalBtnOk"><span class="btn-text">' + esc(textoOk) + '</span><span class="spinner spinner-sm"></span></button>';

      const backdrop = el('modalBackdrop');
      backdrop.classList.add('open');
      backdrop.setAttribute('aria-hidden', 'false');

      const closeModal = () => {
        backdrop.classList.remove('open');
        backdrop.setAttribute('aria-hidden', 'true');
        el('modalBody').innerHTML = '';
        el('modalFooter').innerHTML = '';
      };

      const okBtn = el('modalBtnOk');
      const cancelBtn = el('modalBtnCancel');
      const closeBtn = el('modalClose');

      const cleanup = () => {
        closeBtn.removeEventListener('click', onClose);
        cancelBtn.removeEventListener('click', onClose);
        backdrop.removeEventListener('click', onBackdrop);
        document.removeEventListener('keydown', onEsc);
      };
      const onClose = () => { cleanup(); closeModal(); };
      const onBackdrop = (e) => { if (e.target === backdrop) onClose(); };
      const onEsc = (e) => { if (e.key === 'Escape') onClose(); };

      closeBtn.addEventListener('click', onClose);
      cancelBtn.addEventListener('click', onClose);
      backdrop.addEventListener('click', onBackdrop);
      document.addEventListener('keydown', onEsc);

      okBtn.addEventListener('click', async () => {
        if (typeof onConfirm === 'function') {
          okBtn.classList.add('loading');
          okBtn.disabled = true;
          try {
            const result = await onConfirm(closeModal);
            if (result !== false) { cleanup(); closeModal(); }
          } catch (e) {
            /* handled inside */
          } finally {
            okBtn.classList.remove('loading');
            okBtn.disabled = false;
          }
        } else {
          cleanup(); closeModal();
        }
      });
    },

    showConfirm(titulo, mensaje, danger) {
      return new Promise((resolve) => {
        const dlg = el('confirmDialog');
        el('confirmTitle').textContent = titulo || '¿Estás seguro?';
        el('confirmMessage').textContent = mensaje || 'Esta acción no se puede deshacer.';
        const btn = el('confirmBtn');
        btn.className = danger ? 'btn btn-danger' : 'btn btn-primary';
        const onClose = () => {
          dlg.removeEventListener('close', onClose);
          resolve(dlg.returnValue === 'confirm');
        };
        dlg.addEventListener('close', onClose);
        dlg.showModal();
      });
    },

    showLoader() { el('globalLoader').classList.add('active'); },
    hideLoader() { el('globalLoader').classList.remove('active'); },

    formatDate(tsISO) {
      if (!tsISO) return '-';
      const d = (tsISO instanceof Date) ? tsISO : new Date(tsISO);
      if (!isNaN(Number(tsISO)) && String(tsISO).length >= 10 && String(tsISO).length <= 13) {
        const n = Number(tsISO);
        if (!isNaN(n)) return new Date(n).toLocaleString('es-AR', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
        });
      }
      if (isNaN(d.getTime())) return String(tsISO);
      return d.toLocaleString('es-AR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    },

    formatCurrency(n) {
      const num = Number(n) || 0;
      return '$' + num.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    setLastTenant(id) {
      if (!id) return;
      State.lastTenantId = Number(id) || null;
      try { localStorage.setItem('admin_last_tenant', String(State.lastTenantId)); } catch (e) {}
    },

    setHeaderTitle(txt) { el('headerTitle').textContent = txt || ''; },

    setActiveNav(routeName) {
      document.querySelectorAll('.nav-item[data-route]').forEach(n => {
        n.classList.toggle('active', n.dataset.route === routeName);
      });
    },

    closeSidebarMobile() {
      el('sidebar').classList.remove('open');
      el('sidebarBackdrop').classList.remove('open');
    },

    setUserInfo() {
      let nombre = '';
      try { nombre = localStorage.getItem('admin_name') || localStorage.getItem('admin_email') || ''; } catch (e) {}
      if (!nombre) nombre = 'Administrador';
      el('headerUserName').textContent = nombre;
      const inicial = (nombre.charAt(0) || 'A').toUpperCase();
      el('headerAvatar').textContent = inicial;
    },

    async loadMe() {
      try {
        const res = await App.api('/api/admin/me');
        if (res && res.admin) {
          State.admin = res.admin;
          if (res.admin.nombre) try { localStorage.setItem('admin_name', res.admin.nombre); } catch (e) {}
          if (res.admin.email) try { localStorage.setItem('admin_email', res.admin.email); } catch (e) {}
          App.setUserInfo();
        }
      } catch (e) { /* ignore */ }
    },

    parseRoute() {
      const raw = location.hash.replace(/^#/, '') || '/dashboard';
      const parts = raw.split('/').filter(Boolean);
      const route = parts[0] || 'dashboard';
      const params = parts.slice(1);
      return { route, params, raw };
    },

    router() {
      const { route, params } = App.parseRoute();
      const view = el('view');
      App.closeSidebarMobile();
      window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });

      const mapRoute = (r) => r; // simplificación
      App.setActiveNav(mapRoute(route));

      const render = async () => {
        switch (route) {
          case 'dashboard':
            App.setHeaderTitle('Dashboard');
            await Views.renderDashboard(view);
            break;
          case 'clientes':
            App.setHeaderTitle('Clientes (Tenants)');
            await Views.renderClientes(view);
            break;
          case 'cliente': {
            const id = params[0];
            App.setHeaderTitle('Editar cliente');
            if (!id) { location.hash = '#/clientes'; return; }
            App.setLastTenant(id);
            await Views.renderCliente(view, id);
            break;
          }
          case 'servicios': {
            let tid = params[0] || State.lastTenantId;
            if (!tid) {
              App.showToast('Seleccioná primero un cliente.', 'warning');
              location.hash = '#/clientes';
              return;
            }
            App.setLastTenant(tid);
            App.setHeaderTitle('Servicios');
            await Views.renderServicios(view, tid);
            break;
          }
          case 'galeria': {
            let tid = params[0] || State.lastTenantId;
            if (!tid) { App.showToast('Seleccioná primero un cliente.', 'warning'); location.hash = '#/clientes'; return; }
            App.setLastTenant(tid);
            App.setHeaderTitle('Galería');
            await Views.renderGaleria(view, tid);
            break;
          }
          case 'faq': {
            let tid = params[0] || State.lastTenantId;
            if (!tid) { App.showToast('Seleccioná primero un cliente.', 'warning'); location.hash = '#/clientes'; return; }
            App.setLastTenant(tid);
            App.setHeaderTitle('Preguntas Frecuentes');
            await Views.renderFAQ(view, tid);
            break;
          }
          case 'iak': {
            let tid = params[0] || State.lastTenantId;
            if (!tid) { App.showToast('Seleccioná primero un cliente.', 'warning'); location.hash = '#/clientes'; return; }
            App.setLastTenant(tid);
            App.setHeaderTitle('Base de Conocimiento IA');
            await Views.renderIAKnowledge(view, tid);
            break;
          }
          case 'forms': {
            let tid = params[0] || State.lastTenantId;
            if (!tid) { App.showToast('Seleccioná primero un cliente.', 'warning'); location.hash = '#/clientes'; return; }
            App.setLastTenant(tid);
            App.setHeaderTitle('Formularios recibidos');
            await Views.renderForms(view, tid);
            break;
          }
          default:
            location.hash = '#/dashboard';
        }
      };

      view.innerHTML = '<div style="display:flex;justify-content:center;padding:80px;"><div class="spinner"></div></div>';
      render().catch(err => {
        console.error('Router error:', err);
        view.innerHTML =
          '<div class="table-wrapper"><div class="table-empty">' +
            ICONS.warning +
            '<h3>Ocurrió un error</h3>' +
            '<p>' + esc(err.message || 'No se pudo cargar la vista.') + '</p>' +
            '<div class="mt-3"><a href="#/dashboard" class="btn btn-primary">Volver al dashboard</a></div>' +
          '</div></div>';
      });
    },

    tenantHeaderCard(tenant) {
      const initial = (tenant.nombre || tenant.slug || 'C').charAt(0).toUpperCase();
      return (
        '<div class="tenant-header-card">' +
          '<div class="tenant-info">' +
            '<div class="tenant-avatar">' + esc(initial) + '</div>' +
            '<div class="tenant-details min-w-0">' +
              '<div class="tenant-name">' + esc(tenant.nombre) + '</div>' +
              '<div class="tenant-meta">' +
                '<span>' + ICONS.clipboard.replace('<svg', '<svg style="width:14px;height:14px"') + ' slug: <strong>/' + esc(tenant.slug) + '</strong></span>' +
                (tenant.whatsapp ? '<span>📱 ' + esc(tenant.whatsapp) + '</span>' : '') +
                (tenant.email_contacto ? '<span>✉️ ' + esc(tenant.email_contacto) + '</span>' : '') +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="flex gap-2 flex-wrap">' +
            '<a href="#/servicios/' + tenant.id + '" class="btn btn-outline btn-sm">' + ICONS.services + ' Servicios</a>' +
            '<a href="#/galeria/' + tenant.id + '" class="btn btn-outline btn-sm">' + ICONS.image + ' Galería</a>' +
            '<a href="#/forms/' + tenant.id + '" class="btn btn-outline btn-sm">' + ICONS.chat + ' Formularios</a>' +
            '<a href="/' + esc(tenant.slug) + '/" target="_blank" rel="noopener" class="btn btn-primary btn-sm">' + ICONS.eye + ' Ver sitio</a>' +
          '</div>' +
        '</div>'
      );
    },

    breadcrumb(items) {
      const parts = items.map((it, i) => {
        const isLast = i === items.length - 1;
        if (isLast || !it.href) {
          return '<span class="breadcrumb-item current">' + esc(it.label) + '</span>';
        }
        return '<span class="breadcrumb-item"><a href="' + esc(it.href) + '">' + esc(it.label) + '</a></span>' +
               '<span class="breadcrumb-sep">/</span>';
      });
      return '<div class="breadcrumb">' + parts.join('') + '</div>';
    },

    initSidebar() {
      el('menuToggle').addEventListener('click', () => {
        el('sidebar').classList.add('open');
        el('sidebarBackdrop').classList.add('open');
      });
      el('sidebarClose').addEventListener('click', () => App.closeSidebarMobile());
      el('sidebarBackdrop').addEventListener('click', () => App.closeSidebarMobile());

      el('logoutBtn').addEventListener('click', async (e) => {
        e.preventDefault();
        const ok = await App.showConfirm('Cerrar sesión', '¿Seguro que querés cerrar sesión?', false);
        if (ok) App.logout();
      });
    },

    async init() {
      if (!App.requireAuth()) return;
      App.initSidebar();
      App.setUserInfo();
      window.addEventListener('hashchange', () => App.router());
      if (!location.hash) location.hash = '#/dashboard';
      App.loadMe().finally(() => {
        App.router();
      });
    }
  };

  /* =========================================================
     VIEWS
     ========================================================= */
  const Views = {

    async renderDashboard(root) {
      root.innerHTML =
        '<div class="section-header">' +
          '<div>' +
            '<h1>Dashboard</h1>' +
            '<div class="section-subtitle">Resumen general de la plataforma</div>' +
          '</div>' +
        '</div>' +
        '<div class="stats-grid" id="statsGrid">' +
          Array(4).fill(0).map(() => '<div class="stat-card"><div class="skeleton" style="width:100%;height:88px;"></div></div>').join('') +
        '</div>' +
        '<div class="form-row" style="margin-bottom:24px;">' +
          '<div class="quick-card" id="quickCreateCard">' +
            '<h3>' + ICONS.sparkles + ' Crear cliente rápido</h3>' +
            '<p>Generá un nuevo cliente con servicios y FAQs de ejemplo listos para usar.</p>' +
            '<button class="btn btn-primary btn-sm" id="btnQuickCreate">' + ICONS.plus + ' <span class="btn-text">Generar cliente demo</span><span class="spinner spinner-sm"></span></button>' +
          '</div>' +
          '<div class="quick-card" style="background:linear-gradient(135deg, var(--color-success-bg), rgba(20,184,166,0.1));border-color:rgba(34,197,94,0.3);">' +
            '<h3>' + ICONS.users + ' Acceso rápido</h3>' +
            '<p>Gestioná los clientes, sus servicios y formularios desde un solo lugar.</p>' +
            '<a href="#/clientes" class="btn btn-success btn-sm">' + ICONS.enter + ' Ver clientes</a>' +
          '</div>' +
        '</div>' +
        '<div class="table-wrapper">' +
          '<div class="table-toolbar">' +
            '<h3 style="font-size:15px;font-weight:700;">Últimos 5 formularios recibidos</h3>' +
          '</div>' +
          '<div class="table-scroll" id="ultimosForms"><div class="table-empty"><div class="spinner"></div></div></div>' +
        '</div>';

      const btnQuick = root.querySelector('#btnQuickCreate');
      btnQuick.addEventListener('click', async () => {
        App.showModal(
          'Generar nuevo cliente (demo completo)',
          '<form id="quickForm">' +
            '<div class="form-row">' +
              '<div class="form-group">' +
                '<label>Slug (URL) *</label>' +
                '<input type="text" name="slug" required placeholder="mi-negocio" pattern="[a-z0-9\\-]+" title="solo minúsculas, números y guiones">' +
                '<div class="text-xs text-muted mt-1">Quedará: /tu-slug/</div>' +
              '</div>' +
              '<div class="form-group">' +
                '<label>Nombre *</label>' +
                '<input type="text" name="nombre" required placeholder="Mi Negocio SRL">' +
              '</div>' +
            '</div>' +
            '<div class="form-row">' +
              '<div class="form-group"><label>WhatsApp</label><input type="tel" name="whatsapp" placeholder="+54 9 11 ..."></div>' +
              '<div class="form-group"><label>Email</label><input type="email" name="email" placeholder="contacto@negocio.com"></div>' +
            '</div>' +
            '<div class="form-group"><label>Dirección</label><input type="text" name="direccion" placeholder="Calle ..., Ciudad"></div>' +
          '</form>',
          async (close) => {
            const form = document.getElementById('quickForm');
            if (!form.reportValidity()) return false;
            const fd = new FormData(form);
            const payload = {
              slug: fd.get('slug').trim().toLowerCase(),
              nombre: fd.get('nombre').trim(),
              whatsapp: fd.get('whatsapp') || '',
              email: fd.get('email') || '',
              direccion: fd.get('direccion') || ''
            };
            try {
              const r = await App.api('/api/admin/generar-cliente', { method: 'POST', body: payload });
              App.showToast((r && r.mensaje) || 'Cliente generado con éxito', 'success');
              close();
              setTimeout(() => location.hash = '#/cliente/' + r.id, 350);
            } catch (e) { return false; }
          },
          'Generar cliente'
        );
      });

      try {
        let tenants = [];
        try {
          const rt = await App.api('/api/admin/tenants');
          tenants = (rt && rt.tenants) || [];
        } catch (e) { tenants = []; }

        const allForms = [];
        let totalServicios = 0;

        const promiseForms = tenants.slice(0, 30).map(async (t) => {
          try {
            const rf = await App.api('/api/admin/tenants/' + t.id + '/forms');
            const arr = (rf && rf.forms) || [];
            arr.forEach(f => { f._tenantId = t.id; f._tenantName = t.nombre; f._tenantSlug = t.slug; });
            allForms.push(...arr);
          } catch (e) {}
        });

        const promiseServ = tenants.slice(0, 30).map(async (t) => {
          try {
            const rs = await App.api('/api/admin/tenants/' + t.id + '/services');
            totalServicios += ((rs && rs.servicios) || []).length;
          } catch (e) {}
        });

        await Promise.all(promiseForms.concat(promiseServ));

        allForms.sort((a, b) => (Number(b.created_at || 0)) - (Number(a.created_at || 0)));
        const sinLeer = allForms.filter(f => !f.leido).length;
        const ultimos5 = allForms.slice(0, 5);

        el('statsGrid').innerHTML =
          '<div class="stat-card">' +
            '<div class="stat-icon primary">' + ICONS.users + '</div>' +
            '<div class="stat-info"><div class="stat-label">Total clientes</div><div class="stat-value">' + tenants.length + '</div></div>' +
          '</div>' +
          '<div class="stat-card">' +
            '<div class="stat-icon warning">' + ICONS.chat + '</div>' +
            '<div class="stat-info"><div class="stat-label">Formularios sin leer</div><div class="stat-value">' + sinLeer + '</div>' +
              '<div class="stat-change">Total: ' + allForms.length + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="stat-card">' +
            '<div class="stat-icon success">' + ICONS.services + '</div>' +
            '<div class="stat-info"><div class="stat-label">Total servicios</div><div class="stat-value">' + totalServicios + '</div></div>' +
          '</div>' +
          '<div class="stat-card">' +
            '<div class="stat-icon secondary">' + ICONS.sparkles + '</div>' +
            '<div class="stat-info"><div class="stat-label">Promedio servicios / cliente</div><div class="stat-value">' +
              (tenants.length ? (totalServicios / tenants.length).toFixed(1) : '0') +
            '</div></div>' +
          '</div>';

        const badge = el('badgeForms');
        if (badge) {
          if (sinLeer > 0) {
            badge.classList.remove('hidden');
            badge.textContent = sinLeer > 99 ? '99+' : String(sinLeer);
          } else {
            badge.classList.add('hidden');
          }
        }

        const container = root.querySelector('#ultimosForms');
        if (!ultimos5.length) {
          container.innerHTML =
            '<div class="table-empty">' +
              ICONS.chat +
              '<h3>No hay formularios todavía</h3>' +
              '<p>Aquí aparecerán las últimas consultas recibidas.</p>' +
            '</div>';
        } else {
          container.innerHTML =
            '<table class="data-table">' +
              '<thead><tr><th>Fecha</th><th>Cliente</th><th>Tipo</th><th>Nombre / Email</th><th>Estado</th><th style="width:90px;">Acciones</th></tr></thead>' +
              '<tbody>' +
                ultimos5.map(f => {
                  let data = {};
                  try { data = (typeof f.data === 'string') ? JSON.parse(f.data) : (f.data || {}); } catch (e) { data = {}; }
                  return (
                    '<tr class="' + (f.leido ? '' : 'unread') + '">' +
                      '<td>' + App.formatDate(f.created_at) + '</td>' +
                      '<td><a href="#/cliente/' + f._tenantId + '" class="text-primary text-bold">' + esc(f._tenantName) + '</a> <span class="text-xs text-muted">/' + esc(f._tenantSlug) + '</span></td>' +
                      '<td><span class="badge badge-info">' + esc(f.tipo || 'contacto') + '</span></td>' +
                      '<td>' +
                        (data.nombre ? '<div>' + esc(data.nombre) + '</div>' : '') +
                        (data.email ? '<div class="text-xs text-muted">' + esc(data.email) + '</div>' : '') +
                      '</td>' +
                      '<td>' + (f.leido
                        ? '<span class="badge badge-muted">Leído</span>'
                        : '<span class="badge badge-warning">Nuevo</span>') +
                      '</td>' +
                      '<td><a href="#/forms/' + f._tenantId + '" class="btn btn-ghost btn-sm">Ver</a></td>' +
                    '</tr>'
                  );
                }).join('') +
              '</tbody>' +
            '</table>';
        }
      } catch (e) {
        console.error(e);
      }
    },

    async renderClientes(root) {
      root.innerHTML =
        '<div class="section-header">' +
          '<div>' +
            '<h1>Clientes</h1>' +
            '<div class="section-subtitle">Gestiona los tenants y sitios web</div>' +
          '</div>' +
          '<div class="flex gap-2 flex-wrap">' +
            '<button class="btn btn-primary" id="btnNewTenant">' + ICONS.plus + ' <span class="btn-text">Nuevo cliente</span><span class="spinner spinner-sm"></span></button>' +
            '<button class="btn btn-outline" id="btnGenCliente">' + ICONS.sparkles + ' <span class="btn-text">Generar completo</span><span class="spinner spinner-sm"></span></button>' +
          '</div>' +
        '</div>' +
        '<div class="table-wrapper">' +
          '<div class="table-toolbar">' +
            '<div class="input-with-icon search-input w-full"><svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
              '<input type="search" id="searchInput" placeholder="Buscar por nombre, slug, email..." aria-label="Buscar clientes">' +
            '</div>' +
          '</div>' +
          '<div class="table-scroll" id="clientesTable"><div class="table-empty"><div class="spinner"></div></div></div>' +
        '</div>';

      let lista = [];

      const renderTabla = () => {
        const q = (root.querySelector('#searchInput').value || '').toLowerCase().trim();
        const filtrada = q ? lista.filter(t =>
          (t.nombre || '').toLowerCase().includes(q) ||
          (t.slug || '').toLowerCase().includes(q) ||
          (t.email_contacto || '').toLowerCase().includes(q) ||
          (t.whatsapp || '').includes(q)
        ) : lista;

        const t = root.querySelector('#clientesTable');
        if (!filtrada.length) {
          t.innerHTML =
            '<div class="table-empty">' +
              ICONS.users +
              '<h3>' + (q ? 'Sin resultados' : 'Todavía no hay clientes') + '</h3>' +
              '<p>' + (q ? 'Probá con otro término de búsqueda.' : 'Creá tu primer cliente para empezar.') + '</p>' +
            '</div>';
          return;
        }
        t.innerHTML =
          '<table class="data-table">' +
            '<thead><tr>' +
              '<th>ID</th><th>Slug</th><th>Nombre</th><th>WhatsApp</th><th>Email</th><th>Creado</th><th style="width:220px;">Acciones</th>' +
            '</tr></thead>' +
            '<tbody>' +
              filtrada.map(tn => (
                '<tr>' +
                  '<td class="text-bold">' + tn.id + '</td>' +
                  '<td><span class="badge badge-primary">/' + esc(tn.slug) + '</span></td>' +
                  '<td><strong>' + esc(tn.nombre) + '</strong></td>' +
                  '<td>' + (tn.whatsapp ? esc(tn.whatsapp) : '<span class="text-muted">-</span>') + '</td>' +
                  '<td>' + (tn.email_contacto ? esc(tn.email_contacto) : '<span class="text-muted">-</span>') + '</td>' +
                  '<td class="text-sm text-muted">' + App.formatDate(tn.created_at) + '</td>' +
                  '<td>' +
                    '<div class="table-actions">' +
                      '<a href="#/cliente/' + tn.id + '" class="btn-icon primary" title="Editar">' + ICONS.edit + '</a>' +
                      '<a href="#/servicios/' + tn.id + '" class="btn-icon" title="Servicios" style="color:var(--color-tertiary)">' + ICONS.services.replace('currentColor', '#14b8a6') + '</a>' +
                      '<a href="#/forms/' + tn.id + '" class="btn-icon" title="Formularios" style="color:var(--color-info)">' + ICONS.chat.replace('currentColor', '#3b82f6') + '</a>' +
                      '<button class="btn-icon danger del-tenant" data-id="' + tn.id + '" title="Eliminar">' + ICONS.trash + '</button>' +
                    '</div>' +
                  '</td>' +
                '</tr>'
              )).join('') +
            '</tbody>' +
          '</table>';
      };

      const cargar = async () => {
        try {
          const r = await App.api('/api/admin/tenants');
          lista = (r && r.tenants) || [];
        } catch (e) { lista = []; }
        renderTabla();
      };

      root.querySelector('#searchInput').addEventListener('input', renderTabla);

      const nuevoClienteModal = (modoCompleto) => {
        App.showModal(
          modoCompleto ? 'Generar cliente completo (demo)' : 'Nuevo cliente',
          '<form id="formNewTenant">' +
            '<div class="form-row">' +
              '<div class="form-group">' +
                '<label>Slug (URL) *</label>' +
                '<input type="text" name="slug" required placeholder="mi-negocio" pattern="[a-zA-Z0-9\\-]+" title="letras, números y guiones">' +
                '<div class="text-xs text-muted mt-1">Quedará: /mi-negocio/</div>' +
              '</div>' +
              '<div class="form-group"><label>Nombre *</label><input type="text" name="nombre" required placeholder="Mi Negocio"></div>' +
            '</div>' +
            '<div class="form-row">' +
              '<div class="form-group"><label>WhatsApp</label><input type="tel" name="whatsapp" placeholder="+54 9 11 ..."></div>' +
              '<div class="form-group"><label>Email</label><input type="email" name="email_contacto" placeholder="contacto@negocio.com"></div>' +
            '</div>' +
            '<div class="form-group"><label>Dirección</label><input type="text" name="direccion" placeholder="Calle, número, ciudad"></div>' +
            (modoCompleto ? '<div class="text-sm text-muted mt-2">' + ICONS.sparkles + ' Se crearán servicios y FAQs de ejemplo automáticamente.</div>' : '') +
          '</form>',
          async (close) => {
            const form = document.getElementById('formNewTenant');
            if (!form.reportValidity()) return false;
            const fd = new FormData(form);
            const body = {
              slug: (fd.get('slug') || '').trim().toLowerCase(),
              nombre: (fd.get('nombre') || '').trim(),
              whatsapp: fd.get('whatsapp') || '',
              email_contacto: fd.get('email_contacto') || '',
              direccion: fd.get('direccion') || ''
            };
            if (modoCompleto) {
              body.email = body.email_contacto;
            }
            try {
              const url = modoCompleto ? '/api/admin/generar-cliente' : '/api/admin/tenants';
              const r = await App.api(url, { method: 'POST', body });
              App.showToast((r && r.mensaje) || 'Cliente creado', 'success');
              close();
              await cargar();
              if (r && r.id) setTimeout(() => location.hash = '#/cliente/' + r.id, 350);
            } catch (e) { return false; }
          },
          modoCompleto ? 'Generar cliente' : 'Crear cliente'
        );
      };

      root.querySelector('#btnNewTenant').addEventListener('click', () => nuevoClienteModal(false));
      root.querySelector('#btnGenCliente').addEventListener('click', () => nuevoClienteModal(true));

      root.addEventListener('click', async (e) => {
        const delBtn = e.target.closest('.del-tenant');
        if (delBtn) {
          const id = delBtn.dataset.id;
          const t = lista.find(x => x.id == id);
          if (!t) return;
          const ok = await App.showConfirm('Eliminar cliente', '¿Estás seguro que querés eliminar a "' + t.nombre + '"? Se eliminarán TODOS sus servicios, galería, FAQ y formularios. Esta acción no tiene vuelta atrás.', true);
          if (!ok) return;
          try {
            await App.api('/api/admin/tenants/' + id, { method: 'DELETE' });
            App.showToast('Cliente eliminado', 'success');
            await cargar();
          } catch (e) {}
        }
      });

      await cargar();
    },

    async renderCliente(root, id) {
      root.innerHTML =
        App.breadcrumb([
          { label: 'Dashboard', href: '#/dashboard' },
          { label: 'Clientes', href: '#/clientes' },
          { label: 'Cargando...' }
        ]) +
        '<div style="display:flex;justify-content:center;padding:60px;"><div class="spinner"></div></div>';

      let tenant = null;
      try {
        const rt = await App.api('/api/admin/tenants');
        const lista = (rt && rt.tenants) || [];
        tenant = lista.find(t => t.id == id);
      } catch (e) {}

      if (!tenant) {
        root.innerHTML =
          App.breadcrumb([{ label: 'Dashboard', href: '#/dashboard' }, { label: 'Clientes', href: '#/clientes' }, { label: 'No encontrado' }]) +
          '<div class="table-wrapper"><div class="table-empty">' + ICONS.warning +
            '<h3>Cliente no encontrado</h3>' +
            '<p>El ID solicitado no existe.</p>' +
            '<a href="#/clientes" class="btn btn-primary mt-3">Volver a clientes</a>' +
          '</div></div>';
        return;
      }

      let config = {};
      try {
        const all = await App.api('/api/admin/tenants');
      } catch (e) {}

      try {
        const row = await fetch('/api/admin/tenants', {
          headers: { 'Authorization': 'Bearer ' + State.token }
        }).then(r => r.json()).then(d => {
          const t = (d.tenants || []).find(x => x.id == id);
          return t;
        });
      } catch (e) {}

      // Config no viene en el listado, así que hacemos fetch individual con ruta específica (no existe), 
      // por lo que inicializamos valores por defecto y se guardan al apretar Guardar
      const defaultHorarios = {};
      DAYS.forEach(d => { defaultHorarios[d] = { abierto: true, de: '09:00', a: '18:00' }; });
      defaultHorarios['sábado'] = { abierto: false, de: '10:00', a: '14:00' };
      defaultHorarios['domingo'] = { abierto: false, de: '', a: '' };

      const stateForm = {
        info: {
          nombre: tenant.nombre || '',
          slug: tenant.slug || '',
          whatsapp: tenant.whatsapp || '',
          email_contacto: tenant.email_contacto || '',
          dominio: tenant.dominio || '',
          direccion: '',
          ubicacion_url: ''
        },
        meta: {
          color_principal: '#2563eb',
          color_secundario: '#1e40af',
          color_acento: '#f59e0b',
          logo_url: '',
          favicon_url: '',
          meta_title: tenant.nombre || '',
          meta_description: '',
          og_image_url: ''
        },
        horarios: defaultHorarios,
        redes: { instagram: '', facebook: '', tiktok: '', web: '' }
      };

      // intentar cargar config: el endpoint PUT guarda, pero GET individual no existe → usamos un workaround:
      // si el tenant tiene datos guardados, la próxima vez que guardemos se mergea. 
      // Para esta versión, dejamos defaults y el usuario completa.

      root.innerHTML =
        App.breadcrumb([
          { label: 'Dashboard', href: '#/dashboard' },
          { label: 'Clientes', href: '#/clientes' },
          { label: tenant.nombre }
        ]) +
        App.tenantHeaderCard(tenant) +
        '<div class="form-card">' +
          '<div class="tabs" role="tablist" id="clienteTabs">' +
            '<button class="tab-btn active" role="tab" data-tab="info" aria-selected="true">📋 Información</button>' +
            '<button class="tab-btn" role="tab" data-tab="meta">🎨 Colores / Meta</button>' +
            '<button class="tab-btn" role="tab" data-tab="horarios">🕒 Horarios</button>' +
            '<button class="tab-btn" role="tab" data-tab="redes">🔗 Redes</button>' +
          '</div>' +
          '<form id="clienteForm">' +

            '<div class="tab-panel active" id="tab-info">' +
              '<div class="form-row">' +
                '<div class="form-group"><label>Nombre *</label><input type="text" name="nombre" required value="' + esc(stateForm.info.nombre) + '"></div>' +
                '<div class="form-group"><label>Slug *</label><input type="text" name="slug" required value="' + esc(stateForm.info.slug) + '" pattern="[a-zA-Z0-9\\-]+"></div>' +
              '</div>' +
              '<div class="form-row">' +
                '<div class="form-group"><label>WhatsApp</label><input type="tel" name="whatsapp" value="' + esc(stateForm.info.whatsapp) + '" placeholder="+54 9 ..."></div>' +
                '<div class="form-group"><label>Email contacto</label><input type="email" name="email_contacto" value="' + esc(stateForm.info.email_contacto) + '"></div>' +
              '</div>' +
              '<div class="form-row">' +
                '<div class="form-group"><label>Dominio personalizado</label><input type="text" name="dominio" value="' + esc(stateForm.info.dominio) + '" placeholder="www.tudominio.com.ar"></div>' +
                '<div class="form-group"><label>Ubicación URL (Maps)</label><input type="url" name="ubicacion_url" value="' + esc(stateForm.info.ubicacion_url) + '" placeholder="https://maps.google.com/..."></div>' +
              '</div>' +
              '<div class="form-group"><label>Dirección</label><input type="text" name="direccion" value="' + esc(stateForm.info.direccion) + '" placeholder="Calle, número, ciudad"></div>' +
            '</div>' +

            '<div class="tab-panel" id="tab-meta">' +
              '<div class="form-row-3">' +
                '<div class="form-group"><label>Color principal</label><div class="flex items-center gap-2">' +
                  '<input type="color" id="cp1" value="' + esc(stateForm.meta.color_principal) + '">' +
                  '<input type="text" name="color_principal" value="' + esc(stateForm.meta.color_principal) + '" pattern="^#[0-9A-Fa-f]{6}$" placeholder="#RRGGBB">' +
                '</div></div>' +
                '<div class="form-group"><label>Color secundario</label><div class="flex items-center gap-2">' +
                  '<input type="color" id="cp2" value="' + esc(stateForm.meta.color_secundario) + '">' +
                  '<input type="text" name="color_secundario" value="' + esc(stateForm.meta.color_secundario) + '" pattern="^#[0-9A-Fa-f]{6}$">' +
                '</div></div>' +
                '<div class="form-group"><label>Color acento</label><div class="flex items-center gap-2">' +
                  '<input type="color" id="cp3" value="' + esc(stateForm.meta.color_acento) + '">' +
                  '<input type="text" name="color_acento" value="' + esc(stateForm.meta.color_acento) + '" pattern="^#[0-9A-Fa-f]{6}$">' +
                '</div></div>' +
              '</div>' +
              '<div class="form-row">' +
                '<div class="form-group"><label>URL Logo</label><input type="url" name="logo_url" value="' + esc(stateForm.meta.logo_url) + '" placeholder="https://.../logo.png"></div>' +
                '<div class="form-group"><label>URL Favicon</label><input type="url" name="favicon_url" value="' + esc(stateForm.meta.favicon_url) + '" placeholder="https://.../favicon.ico"></div>' +
              '</div>' +
              '<div class="form-group"><label>Meta Title</label><input type="text" name="meta_title" value="' + esc(stateForm.meta.meta_title) + '" placeholder="Título para Google (60 caracteres)"></div>' +
              '<div class="form-group"><label>Meta Description</label><textarea name="meta_description" rows="2" placeholder="Descripción para buscadores...">' + esc(stateForm.meta.meta_description) + '</textarea></div>' +
              '<div class="form-group"><label>OG Image URL (compartir en redes)</label><input type="url" name="og_image_url" value="' + esc(stateForm.meta.og_image_url) + '" placeholder="https://.../og-image.png"></div>' +
            '</div>' +

            '<div class="tab-panel" id="tab-horarios">' +
              '<div class="hours-grid" id="hoursGrid"></div>' +
            '</div>' +

            '<div class="tab-panel" id="tab-redes">' +
              '<div class="form-row">' +
                '<div class="form-group"><label>Instagram URL</label><input type="url" name="red_instagram" value="' + esc(stateForm.redes.instagram) + '" placeholder="https://instagram.com/..."></div>' +
                '<div class="form-group"><label>Facebook URL</label><input type="url" name="red_facebook" value="' + esc(stateForm.redes.facebook) + '" placeholder="https://facebook.com/..."></div>' +
              '</div>' +
              '<div class="form-row">' +
                '<div class="form-group"><label>TikTok URL</label><input type="url" name="red_tiktok" value="' + esc(stateForm.redes.tiktok) + '" placeholder="https://tiktok.com/@..."></div>' +
                '<div class="form-group"><label>Sitio web</label><input type="url" name="red_web" value="' + esc(stateForm.redes.web) + '" placeholder="https://miweb.com.ar"></div>' +
              '</div>' +
            '</div>' +

            '<hr style="margin: 24px 0;">' +
            '<div class="flex justify-between items-center gap-3 flex-wrap">' +
              '<div class="text-muted text-sm">Guardar aplica cambios en toda la información del cliente.</div>' +
              '<div class="flex gap-2">' +
                '<a href="#/clientes" class="btn btn-outline">Cancelar</a>' +
                '<button type="submit" class="btn btn-primary btn-lg" id="btnSaveCliente">' +
                  ICONS.check + ' <span class="btn-text">Guardar cambios</span><span class="spinner spinner-sm"></span>' +
                '</button>' +
              '</div>' +
            '</div>' +
          '</form>' +
        '</div>';

      // tabs behavior
      root.querySelectorAll('#clienteTabs .tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          root.querySelectorAll('#clienteTabs .tab-btn').forEach(b => {
            b.classList.toggle('active', b === btn);
            b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
          });
          const tabId = btn.dataset.tab;
          ['info', 'meta', 'horarios', 'redes'].forEach(name => {
            const panel = root.querySelector('#tab-' + name);
            if (panel) panel.classList.toggle('active', name === tabId);
          });
        });
      });

      // sync color pickers
      const syncCP = (cpId, inputName) => {
        const cp = document.getElementById(cpId);
        if (!cp) return;
        const input = root.querySelector('[name="' + inputName + '"]');
        cp.addEventListener('input', () => { input.value = cp.value; });
        input.addEventListener('input', () => {
          if (/^#[0-9A-Fa-f]{6}$/.test(input.value)) cp.value = input.value;
        });
      };
      syncCP('cp1', 'color_principal');
      syncCP('cp2', 'color_secundario');
      syncCP('cp3', 'color_acento');

      // horarios grid
      const grid = root.querySelector('#hoursGrid');
      grid.innerHTML = DAYS.map((d, i) => {
        const st = stateForm.horarios[d] || { abierto: false, de: '', a: '' };
        return (
          '<div class="hours-day-row ' + (st.abierto ? '' : 'closed') + '" data-day="' + esc(d) + '">' +
            '<div class="hours-day-name">' + DAYS_LABELS[i] + '</div>' +
            '<label class="flex items-center gap-2" style="font-size:13px;font-weight:600;">' +
              '<span class="switch"><input type="checkbox" class="hr-open" ' + (st.abierto ? 'checked' : '') + '><span class="slider"></span></span>' +
              '<span>Abierto</span>' +
            '</label>' +
            '<div class="hours-times">' +
              '<input type="time" class="hr-de" value="' + esc(st.de || '') + '">' +
              '<span class="hours-sep">a</span>' +
              '<input type="time" class="hr-a" value="' + esc(st.a || '') + '">' +
            '</div>' +
          '</div>'
        );
      }).join('');
      grid.querySelectorAll('.hours-day-row').forEach(row => {
        const chk = row.querySelector('.hr-open');
        chk.addEventListener('change', () => {
          row.classList.toggle('closed', !chk.checked);
        });
      });

      // submit
      root.querySelector('#clienteForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('#btnSaveCliente');
        if (!e.target.reportValidity()) return;
        btn.classList.add('loading');
        btn.disabled = true;

        try {
          const fd = new FormData(e.target);
          const horariosOut = {};
          grid.querySelectorAll('.hours-day-row').forEach(r => {
            const d = r.dataset.day;
            horariosOut[d] = {
              abierto: r.querySelector('.hr-open').checked,
              de: r.querySelector('.hr-de').value || '',
              a: r.querySelector('.hr-a').value || ''
            };
          });

          const payload = {
            slug: (fd.get('slug') || '').trim(),
            nombre: fd.get('nombre') || '',
            whatsapp: fd.get('whatsapp') || '',
            email_contacto: fd.get('email_contacto') || '',
            dominio: fd.get('dominio') || '',
            direccion: fd.get('direccion') || '',
            ubicacion_url: fd.get('ubicacion_url') || '',

            color_principal: fd.get('color_principal') || '',
            color_secundario: fd.get('color_secundario') || '',
            color_acento: fd.get('color_acento') || '',
            logo_url: fd.get('logo_url') || '',
            favicon_url: fd.get('favicon_url') || '',
            meta_title: fd.get('meta_title') || '',
            meta_description: fd.get('meta_description') || '',
            og_image_url: fd.get('og_image_url') || '',

            horarios: horariosOut,
            redes: {
              instagram: fd.get('red_instagram') || '',
              facebook: fd.get('red_facebook') || '',
              tiktok: fd.get('red_tiktok') || '',
              web: fd.get('red_web') || ''
            }
          };

          const r = await App.api('/api/admin/tenants/' + id, { method: 'PUT', body: payload });
          App.showToast((r && r.mensaje) || 'Cliente actualizado', 'success');
        } catch (err) {
          // already toasted
        } finally {
          btn.classList.remove('loading');
          btn.disabled = false;
        }
      });
    },

    async renderServicios(root, tenantId) {
      let tenant = null;
      try {
        const rt = await App.api('/api/admin/tenants');
        tenant = (rt.tenants || []).find(t => t.id == tenantId);
      } catch (e) {}

      root.innerHTML =
        App.breadcrumb([
          { label: 'Dashboard', href: '#/dashboard' },
          { label: 'Clientes', href: '#/clientes' },
          { label: tenant ? tenant.nombre : 'Cliente', href: '#/cliente/' + tenantId },
          { label: 'Servicios' }
        ]) +
        (tenant ? App.tenantHeaderCard(tenant) : '') +
        '<div class="section-header">' +
          '<div><h1>Servicios</h1><div class="section-subtitle">' + (tenant ? esc(tenant.nombre) : '') + '</div></div>' +
          '<button class="btn btn-primary" id="btnAddSrv">' + ICONS.plus + ' <span class="btn-text">Nuevo servicio</span><span class="spinner spinner-sm"></span></button>' +
        '</div>' +
        '<div class="table-wrapper"><div class="table-scroll" id="srvTable"><div class="table-empty"><div class="spinner"></div></div></div></div>';

      let lista = [];
      const baseUrl = '/api/admin/tenants/' + tenantId + '/services';

      const render = () => {
        const t = root.querySelector('#srvTable');
        if (!lista.length) {
          t.innerHTML =
            '<div class="table-empty">' + ICONS.services +
              '<h3>Todavía no hay servicios</h3>' +
              '<p>Creá el primer servicio para este cliente.</p>' +
            '</div>';
          return;
        }
        lista.sort((a, b) => (Number(a.orden || 0) - Number(b.orden || 0)) || (a.id - b.id));
        t.innerHTML =
          '<table class="data-table">' +
            '<thead><tr>' +
              '<th>ID</th><th>Nombre</th><th>Categoría</th><th>Precio</th><th>Duración</th>' +
              '<th>Destacado</th><th>Activo</th><th>Orden</th><th style="width:140px;">Acciones</th>' +
            '</tr></thead>' +
            '<tbody>' +
              lista.map(s => (
                '<tr>' +
                  '<td class="text-sm text-muted">' + s.id + '</td>' +
                  '<td><strong>' + esc(s.nombre) + '</strong>' + (s.descripcion ? '<div class="text-xs text-muted mt-1">' + esc(s.descripcion) + '</div>' : '') + '</td>' +
                  '<td>' + (s.categoria ? '<span class="badge badge-muted">' + esc(s.categoria) + '</span>' : '<span class="text-muted">-</span>') + '</td>' +
                  '<td class="text-bold">' + (s.precio ? App.formatCurrency(s.precio) : '<span class="text-muted">A consultar</span>') + '</td>' +
                  '<td>' + (s.duracion_min ? esc(s.duracion_min) + ' min' : '<span class="text-muted">-</span>') + '</td>' +
                  '<td>' + (s.destacado ? '<span class="badge badge-warning">' + ICONS.star + ' Destacado</span>' : '<span class="text-muted text-sm">No</span>') + '</td>' +
                  '<td>' + (s.activo ? '<span class="badge badge-success">Activo</span>' : '<span class="badge badge-danger">Inactivo</span>') + '</td>' +
                  '<td>' + (s.orden || 0) + '</td>' +
                  '<td>' +
                    '<div class="table-actions">' +
                      '<button class="btn-icon primary edit-srv" data-id="' + s.id + '">' + ICONS.edit + '</button>' +
                      '<button class="btn-icon danger del-srv" data-id="' + s.id + '">' + ICONS.trash + '</button>' +
                    '</div>' +
                  '</td>' +
                '</tr>'
              )).join('') +
            '</tbody>' +
          '</table>';
      };

      const cargar = async () => {
        try {
          const r = await App.api(baseUrl);
          lista = (r && r.servicios) || [];
        } catch (e) { lista = []; }
        render();
      };

      const openModal = (srv) => {
        const isEdit = !!srv;
        App.showModal(
          isEdit ? 'Editar servicio' : 'Nuevo servicio',
          '<form id="srvForm">' +
            '<div class="form-row">' +
              '<div class="form-group"><label>Nombre *</label><input type="text" name="nombre" required value="' + esc(srv?.nombre || '') + '"></div>' +
              '<div class="form-group"><label>Categoría</label><input type="text" name="categoria" value="' + esc(srv?.categoria || '') + '" placeholder="Ej: General, Premium..."></div>' +
            '</div>' +
            '<div class="form-group"><label>Descripción</label><textarea name="descripcion" rows="3" placeholder="Qué incluye el servicio...">' + esc(srv?.descripcion || '') + '</textarea></div>' +
            '<div class="form-row-3">' +
              '<div class="form-group"><label>Precio ($)</label><input type="number" step="0.01" min="0" name="precio" value="' + (srv?.precio ?? '') + '" placeholder="0.00"></div>' +
              '<div class="form-group"><label>Duración (min)</label><input type="number" min="0" name="duracion_min" value="' + (srv?.duracion_min ?? '') + '" placeholder="Ej: 60"></div>' +
              '<div class="form-group"><label>Orden</label><input type="number" min="0" name="orden" value="' + (srv?.orden ?? (lista.length + 1)) + '"></div>' +
            '</div>' +
            '<div class="flex gap-4 items-center" style="padding:8px 0;">' +
              '<label class="flex items-center gap-2" style="font-size:13px;font-weight:600;margin:0;">' +
                '<span class="switch"><input type="checkbox" name="destacado" ' + (srv?.destacado ? 'checked' : '') + '><span class="slider"></span></span>' +
                '<span>⭐ Destacado</span>' +
              '</label>' +
              '<label class="flex items-center gap-2" style="font-size:13px;font-weight:600;margin:0;">' +
                '<span class="switch"><input type="checkbox" name="activo" ' + (srv?.activo !== false ? 'checked' : '') + '><span class="slider"></span></span>' +
                '<span>✅ Activo</span>' +
              '</label>' +
            '</div>' +
          '</form>',
          async (close) => {
            const form = document.getElementById('srvForm');
            if (!form.reportValidity()) return false;
            const fd = new FormData(form);
            const body = {
              nombre: fd.get('nombre') || '',
              categoria: fd.get('categoria') || '',
              descripcion: fd.get('descripcion') || '',
              precio: fd.get('precio') === '' ? 0 : Number(fd.get('precio')),
              duracion_min: fd.get('duracion_min') === '' ? 0 : Number(fd.get('duracion_min')),
              orden: fd.get('orden') === '' ? 0 : Number(fd.get('orden')),
              destacado: fd.get('destacado') === 'on',
              activo: fd.get('activo') === 'on'
            };
            try {
              const url = isEdit ? (baseUrl + '/' + srv.id) : baseUrl;
              const method = isEdit ? 'PUT' : 'POST';
              const r = await App.api(url, { method, body });
              App.showToast((r && r.mensaje) || (isEdit ? 'Servicio actualizado' : 'Servicio creado'), 'success');
              close();
              await cargar();
            } catch (e) { return false; }
          },
          isEdit ? 'Guardar cambios' : 'Crear servicio'
        );
      };

      root.querySelector('#btnAddSrv').addEventListener('click', () => openModal(null));

      root.addEventListener('click', async (e) => {
        const edit = e.target.closest('.edit-srv');
        const del = e.target.closest('.del-srv');
        if (edit) {
          const s = lista.find(x => x.id == edit.dataset.id);
          if (s) openModal(s);
        }
        if (del) {
          const s = lista.find(x => x.id == del.dataset.id);
          if (!s) return;
          const ok = await App.showConfirm('Eliminar servicio', '¿Seguro que querés eliminar "' + s.nombre + '"?', true);
          if (!ok) return;
          try {
            await App.api(baseUrl + '/' + s.id, { method: 'DELETE' });
            App.showToast('Servicio eliminado', 'success');
            await cargar();
          } catch (e) {}
        }
      });

      await cargar();
    },

    async renderGaleria(root, tenantId) {
      let tenant = null;
      try {
        const rt = await App.api('/api/admin/tenants');
        tenant = (rt.tenants || []).find(t => t.id == tenantId);
      } catch (e) {}

      root.innerHTML =
        App.breadcrumb([
          { label: 'Dashboard', href: '#/dashboard' },
          { label: 'Clientes', href: '#/clientes' },
          { label: tenant ? tenant.nombre : 'Cliente', href: '#/cliente/' + tenantId },
          { label: 'Galería' }
        ]) +
        (tenant ? App.tenantHeaderCard(tenant) : '') +
        '<div class="section-header">' +
          '<div><h1>Galería de imágenes</h1><div class="section-subtitle">' + (tenant ? esc(tenant.nombre) : '') + '</div></div>' +
          '<button class="btn btn-primary" id="btnAddImg">' + ICONS.plus + ' <span class="btn-text">Nueva imagen</span><span class="spinner spinner-sm"></span></button>' +
        '</div>' +
        '<div id="galeriaGrid" class="gallery-grid"><div class="skeleton" style="grid-column:1/-1;aspect-ratio:4/1;"></div></div>';

      let lista = [];
      const baseUrl = '/api/admin/tenants/' + tenantId + '/gallery';

      const render = () => {
        const grid = root.querySelector('#galeriaGrid');
        if (!lista.length) {
          grid.outerHTML =
            '<div class="table-wrapper"><div class="table-empty">' + ICONS.image +
              '<h3>Galería vacía</h3>' +
              '<p>Agregá imágenes para mostrar los trabajos del cliente.</p>' +
            '</div></div>';
          root.querySelector('#btnAddImg').addEventListener('click', () => openModal(null));
          return;
        }
        lista.sort((a, b) => (Number(a.orden || 0) - Number(b.orden || 0)) || (a.id - b.id));
        grid.innerHTML = lista.map(img => (
          '<div class="gallery-card ' + (img.activo ? '' : 'inactive') + '" data-id="' + img.id + '">' +
            '<div class="gallery-card-img">' +
              (img.url_imagen
                ? '<img src="' + esc(img.url_imagen) + '" alt="" onerror="this.outerHTML=\'' + ICONS.image.replace(/'/g, '&#39;') + '\';">'
                : ICONS.image) +
            '</div>' +
            '<div class="gallery-card-body">' +
              '<div class="gallery-card-title">' + esc(img.titulo || '(sin título)') + '</div>' +
              (img.categoria ? '<span class="badge badge-primary gallery-card-cat">' + esc(img.categoria) + '</span>'
               : '<span class="text-xs text-muted">Sin categoría</span>') +
              (img.descripcion ? '<div class="text-xs text-muted" style="overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">' + esc(img.descripcion) + '</div>' : '') +
            '</div>' +
            '<div class="gallery-card-footer">' +
              '<span class="text-xs text-muted">Orden: ' + (img.orden || 0) + '</span>' +
              '<div class="flex gap-1">' +
                '<button class="btn-icon primary edit-img" title="Editar">' + ICONS.edit + '</button>' +
                '<button class="btn-icon danger del-img" title="Eliminar">' + ICONS.trash + '</button>' +
              '</div>' +
            '</div>' +
          '</div>'
        )).join('');
      };

      const cargar = async () => {
        try {
          const r = await App.api(baseUrl);
          lista = (r && r.galeria) || [];
        } catch (e) { lista = []; }
        render();
        // re-bind add button after possible re-render
        const ab = document.getElementById('btnAddImg');
        if (ab && !ab.dataset.bound) {
          ab.dataset.bound = '1';
          ab.addEventListener('click', () => openModal(null));
        }
      };

      const openModal = (img) => {
        const isEdit = !!img;
        App.showModal(
          isEdit ? 'Editar imagen' : 'Nueva imagen',
          '<form id="imgForm" style="display:flex;flex-direction:column;">' +
            (isEdit && img.url_imagen
              ? '<div style="margin-bottom:16px;display:flex;justify-content:center;"><img src="' + esc(img.url_imagen) + '" style="max-height:180px;border-radius:10px;object-fit:cover;border:1px solid var(--color-border);" onerror="this.style.display=\'none\'"></div>'
              : '') +
            '<div class="form-group"><label>URL Imagen *</label><input type="url" name="url_imagen" required value="' + esc(img?.url_imagen || '') + '" placeholder="https://.../foto.jpg"></div>' +
            '<div class="form-row">' +
              '<div class="form-group"><label>Título</label><input type="text" name="titulo" value="' + esc(img?.titulo || '') + '"></div>' +
              '<div class="form-group"><label>Categoría</label><input type="text" name="categoria" value="' + esc(img?.categoria || '') + '" placeholder="Ej: Antes/Después, Productos..."></div>' +
            '</div>' +
            '<div class="form-group"><label>Descripción</label><textarea name="descripcion" rows="2">' + esc(img?.descripcion || '') + '</textarea></div>' +
            '<div class="form-row">' +
              '<div class="form-group"><label>Orden</label><input type="number" name="orden" value="' + (img?.orden ?? (lista.length + 1)) + '" min="0"></div>' +
              '<div class="form-group" style="display:flex;align-items:flex-end;">' +
                '<label class="flex items-center gap-2" style="font-size:13px;font-weight:600;margin:0;">' +
                  '<span class="switch"><input type="checkbox" name="activo" ' + (img?.activo !== false ? 'checked' : '') + '><span class="slider"></span></span>' +
                  '<span>Activo</span>' +
                '</label>' +
              '</div>' +
            '</div>' +
          '</form>',
          async (close) => {
            const form = document.getElementById('imgForm');
            if (!form.reportValidity()) return false;
            const fd = new FormData(form);
            const body = {
              url_imagen: fd.get('url_imagen') || '',
              titulo: fd.get('titulo') || '',
              descripcion: fd.get('descripcion') || '',
              categoria: fd.get('categoria') || '',
              orden: Number(fd.get('orden')) || 0,
              activo: fd.get('activo') === 'on'
            };
            try {
              const url = isEdit ? (baseUrl + '/' + img.id) : baseUrl;
              const r = await App.api(url, { method: isEdit ? 'PUT' : 'POST', body });
              App.showToast((r && r.mensaje) || (isEdit ? 'Imagen actualizada' : 'Imagen creada'), 'success');
              close();
              await cargar();
            } catch (e) { return false; }
          },
          isEdit ? 'Guardar cambios' : 'Agregar imagen'
        );
      };

      root.addEventListener('click', async (e) => {
        const editBtn = e.target.closest('.edit-img');
        const delBtn = e.target.closest('.del-img');
        const card = e.target.closest('.gallery-card');
        if (!card) return;
        const id = card.dataset.id;
        const img = lista.find(x => x.id == id);
        if (editBtn && img) openModal(img);
        if (delBtn && img) {
          const ok = await App.showConfirm('Eliminar imagen', '¿Seguro que querés eliminar esta imagen?', true);
          if (!ok) return;
          try {
            await App.api(baseUrl + '/' + img.id, { method: 'DELETE' });
            App.showToast('Imagen eliminada', 'success');
            await cargar();
          } catch (e) {}
        }
      });

      await cargar();
    },

    async renderFAQ(root, tenantId) {
      let tenant = null;
      try {
        const rt = await App.api('/api/admin/tenants');
        tenant = (rt.tenants || []).find(t => t.id == tenantId);
      } catch (e) {}

      root.innerHTML =
        App.breadcrumb([
          { label: 'Dashboard', href: '#/dashboard' },
          { label: 'Clientes', href: '#/clientes' },
          { label: tenant ? tenant.nombre : 'Cliente', href: '#/cliente/' + tenantId },
          { label: 'FAQ' }
        ]) +
        (tenant ? App.tenantHeaderCard(tenant) : '') +
        '<div class="section-header">' +
          '<div><h1>Preguntas Frecuentes</h1><div class="section-subtitle">' + (tenant ? esc(tenant.nombre) : '') + '</div></div>' +
          '<button class="btn btn-primary" id="btnAddFaq">' + ICONS.plus + ' <span class="btn-text">Nueva pregunta</span><span class="spinner spinner-sm"></span></button>' +
        '</div>' +
        '<div class="accordion-list" id="faqList"><div class="skeleton" style="height:72px;"></div><div class="skeleton" style="height:72px;"></div><div class="skeleton" style="height:72px;"></div></div>';

      let lista = [];
      const baseUrl = '/api/admin/tenants/' + tenantId + '/faq';

      const render = () => {
        const cont = root.querySelector('#faqList');
        if (!lista.length) {
          cont.innerHTML =
            '<div class="table-wrapper"><div class="table-empty">' + ICONS.info +
              '<h3>Todavía no hay FAQs</h3>' +
              '<p>Agregá las preguntas más frecuentes de tus clientes.</p>' +
            '</div></div>';
          return;
        }
        lista.sort((a, b) => (Number(a.orden || 0) - Number(b.orden || 0)) || (a.id - b.id));
        cont.innerHTML = lista.map(f => (
          '<div class="accordion-item" data-id="' + f.id + '">' +
            '<div class="accordion-header" role="button" tabindex="0">' +
              ICONS.chevron.replace('<svg', '<svg class="accordion-chevron"') +
              '<div class="accordion-title min-w-0">' +
                (f.activo ? '' : '<span class="badge badge-danger" style="margin-right:8px;">INACTIVO</span>') +
                esc(f.pregunta) +
              '</div>' +
              '<div class="accordion-actions" onclick="event.stopPropagation();">' +
                '<button class="btn-icon primary edit-faq" title="Editar">' + ICONS.edit + '</button>' +
                '<button class="btn-icon danger del-faq" title="Eliminar">' + ICONS.trash + '</button>' +
              '</div>' +
            '</div>' +
            '<div class="accordion-body"><div class="accordion-content">' + esc(f.respuesta || '(sin respuesta)') + '</div></div>' +
          '</div>'
        )).join('');

        cont.querySelectorAll('.accordion-header').forEach(h => {
          const toggle = () => {
            h.parentElement.classList.toggle('open');
          };
          h.addEventListener('click', toggle);
          h.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
          });
        });
      };

      const cargar = async () => {
        try {
          const r = await App.api(baseUrl);
          lista = (r && r.faq) || [];
        } catch (e) { lista = []; }
        render();
      };

      const openModal = (f) => {
        const isEdit = !!f;
        App.showModal(
          isEdit ? 'Editar FAQ' : 'Nueva FAQ',
          '<form id="faqForm">' +
            '<div class="form-group"><label>Pregunta *</label><input type="text" name="pregunta" required value="' + esc(f?.pregunta || '') + '" placeholder="Ej: ¿Cuáles son los medios de pago?"></div>' +
            '<div class="form-group"><label>Respuesta *</label><textarea name="respuesta" rows="5" required placeholder="Escribí la respuesta...">' + esc(f?.respuesta || '') + '</textarea></div>' +
            '<div class="form-row">' +
              '<div class="form-group"><label>Orden</label><input type="number" name="orden" value="' + (f?.orden ?? (lista.length + 1)) + '" min="0"></div>' +
              '<div class="form-group" style="display:flex;align-items:flex-end;">' +
                '<label class="flex items-center gap-2" style="font-size:13px;font-weight:600;margin:0;">' +
                  '<span class="switch"><input type="checkbox" name="activo" ' + (f?.activo !== false ? 'checked' : '') + '><span class="slider"></span></span>' +
                  '<span>Activo</span>' +
                '</label>' +
              '</div>' +
            '</div>' +
          '</form>',
          async (close) => {
            const form = document.getElementById('faqForm');
            if (!form.reportValidity()) return false;
            const fd = new FormData(form);
            const body = {
              pregunta: fd.get('pregunta') || '',
              respuesta: fd.get('respuesta') || '',
              orden: Number(fd.get('orden')) || 0,
              activo: fd.get('activo') === 'on'
            };
            try {
              const url = isEdit ? (baseUrl + '/' + f.id) : baseUrl;
              const r = await App.api(url, { method: isEdit ? 'PUT' : 'POST', body });
              App.showToast((r && r.mensaje) || (isEdit ? 'FAQ actualizada' : 'FAQ creada'), 'success');
              close();
              await cargar();
            } catch (e) { return false; }
          },
          isEdit ? 'Guardar cambios' : 'Crear FAQ'
        );
      };

      root.querySelector('#btnAddFaq').addEventListener('click', () => openModal(null));

      root.addEventListener('click', async (e) => {
        const editBtn = e.target.closest('.edit-faq');
        const delBtn = e.target.closest('.del-faq');
        const item = e.target.closest('.accordion-item');
        if (item && (editBtn || delBtn)) {
          const id = item.dataset.id;
          const f = lista.find(x => x.id == id);
          if (editBtn && f) openModal(f);
          if (delBtn && f) {
            const ok = await App.showConfirm('Eliminar FAQ', '¿Seguro que querés eliminar esta pregunta?', true);
            if (!ok) return;
            try {
              await App.api(baseUrl + '/' + f.id, { method: 'DELETE' });
              App.showToast('FAQ eliminada', 'success');
              await cargar();
            } catch (e) {}
          }
        }
      });

      await cargar();
    },

    async renderIAKnowledge(root, tenantId) {
      let tenant = null;
      try {
        const rt = await App.api('/api/admin/tenants');
        tenant = (rt.tenants || []).find(t => t.id == tenantId);
      } catch (e) {}

      root.innerHTML =
        App.breadcrumb([
          { label: 'Dashboard', href: '#/dashboard' },
          { label: 'Clientes', href: '#/clientes' },
          { label: tenant ? tenant.nombre : 'Cliente', href: '#/cliente/' + tenantId },
          { label: 'Knowledge IA' }
        ]) +
        (tenant ? App.tenantHeaderCard(tenant) : '') +
        '<div class="section-header">' +
          '<div><h1>Base de Conocimiento IA</h1><div class="section-subtitle">Información clave para que la IA responda correctamente a los clientes</div></div>' +
          '<button class="btn btn-primary" id="btnAddIA">' + ICONS.brain + ' <span class="btn-text">Nueva entrada</span><span class="spinner spinner-sm"></span></button>' +
        '</div>' +
        '<div class="table-wrapper"><div class="table-scroll" id="iaTable"><div class="table-empty"><div class="spinner"></div></div></div></div>';

      let lista = [];
      const baseUrl = '/api/admin/tenants/' + tenantId + '/ia-knowledge';

      const render = () => {
        const t = root.querySelector('#iaTable');
        if (!lista.length) {
          t.innerHTML =
            '<div class="table-empty">' + ICONS.brain +
              '<h3>Todavía no hay conocimiento cargado</h3>' +
              '<p>Agregá información del negocio: políticas, formas de pago, promociones, historia, etc.</p>' +
            '</div>';
          return;
        }
        lista.sort((a, b) => b.id - a.id);
        t.innerHTML =
          '<table class="data-table">' +
            '<thead><tr>' +
              '<th style="width:70px;">ID</th><th>Categoría</th><th>Contenido (preview)</th><th>Activo</th>' +
              '<th style="width:140px;">Acciones</th>' +
            '</tr></thead>' +
            '<tbody>' +
              lista.map(k => {
                const preview = String(k.contenido || '').replace(/\s+/g, ' ').slice(0, 140);
                return (
                  '<tr>' +
                    '<td class="text-sm text-muted">' + k.id + '</td>' +
                    '<td><span class="badge badge-primary">' + esc(k.categoria || 'general') + '</span></td>' +
                    '<td class="text-sm">' + esc(preview) + (preview.length >= 140 ? '...' : '') + '</td>' +
                    '<td>' + (k.activo ? '<span class="badge badge-success">Activo</span>' : '<span class="badge badge-danger">Inactivo</span>') + '</td>' +
                    '<td><div class="table-actions">' +
                      '<button class="btn-icon primary edit-ia" data-id="' + k.id + '">' + ICONS.edit + '</button>' +
                      '<button class="btn-icon danger del-ia" data-id="' + k.id + '">' + ICONS.trash + '</button>' +
                    '</div></td>' +
                  '</tr>'
                );
              }).join('') +
            '</tbody>' +
          '</table>';
      };

      const cargar = async () => {
        try {
          const r = await App.api(baseUrl);
          lista = (r && r.knowledge) || [];
        } catch (e) { lista = []; }
        render();
      };

      const openModal = (k) => {
        const isEdit = !!k;
        App.showModal(
          isEdit ? 'Editar conocimiento' : 'Nueva entrada de conocimiento',
          '<form id="iaForm">' +
            '<div class="form-row">' +
              '<div class="form-group"><label>Categoría</label><input type="text" name="categoria" value="' + esc(k?.categoria || 'general') + '" placeholder="general, pagos, promociones..."></div>' +
              '<div class="form-group" style="display:flex;align-items:flex-end;">' +
                '<label class="flex items-center gap-2" style="font-size:13px;font-weight:600;margin:0;">' +
                  '<span class="switch"><input type="checkbox" name="activo" ' + (k?.activo !== false ? 'checked' : '') + '><span class="slider"></span></span>' +
                  '<span>Activo</span>' +
                '</label>' +
              '</div>' +
            '</div>' +
            '<div class="form-group"><label>Contenido *</label>' +
              '<textarea name="contenido" required rows="12" style="font-family:Consolas,Monaco,monospace;font-size:13px;line-height:1.6;" placeholder="Ej:&#10;- Medios de pago: efectivo, transferencia, Mercado Pago, todas las tarjetas.&#10;- Horarios: L a V de 9 a 18hs.&#10;- Garantía de 30 días en todos los servicios.&#10;- Promoción 2x1 los martes...">' + esc(k?.contenido || '') + '</textarea>' +
              '<div class="text-xs text-muted mt-1">Cuanta más información mejor. Podés usar puntos (- item) o texto libre.</div>' +
            '</div>' +
          '</form>',
          async (close) => {
            const form = document.getElementById('iaForm');
            if (!form.reportValidity()) return false;
            const fd = new FormData(form);
            const body = {
              categoria: (fd.get('categoria') || 'general').trim().toLowerCase(),
              contenido: fd.get('contenido') || '',
              activo: fd.get('activo') === 'on'
            };
            try {
              const url = isEdit ? (baseUrl + '/' + k.id) : baseUrl;
              const r = await App.api(url, { method: isEdit ? 'PUT' : 'POST', body });
              App.showToast((r && r.mensaje) || (isEdit ? 'Conocimiento actualizado' : 'Conocimiento creado'), 'success');
              close();
              await cargar();
            } catch (e) { return false; }
          },
          isEdit ? 'Guardar cambios' : 'Guardar'
        );
      };

      root.querySelector('#btnAddIA').addEventListener('click', () => openModal(null));

      root.addEventListener('click', async (e) => {
        const edit = e.target.closest('.edit-ia');
        const del = e.target.closest('.del-ia');
        if (edit) {
          const k = lista.find(x => x.id == edit.dataset.id);
          if (k) openModal(k);
        }
        if (del) {
          const k = lista.find(x => x.id == del.dataset.id);
          if (!k) return;
          const ok = await App.showConfirm('Eliminar entrada', '¿Seguro que querés eliminar esta entrada de conocimiento?', true);
          if (!ok) return;
          try {
            await App.api(baseUrl + '/' + k.id, { method: 'DELETE' });
            App.showToast('Entrada eliminada', 'success');
            await cargar();
          } catch (e) {}
        }
      });

      await cargar();
    },

    async renderForms(root, tenantId) {
      let tenant = null;
      try {
        const rt = await App.api('/api/admin/tenants');
        tenant = (rt.tenants || []).find(t => t.id == tenantId);
      } catch (e) {}

      root.innerHTML =
        App.breadcrumb([
          { label: 'Dashboard', href: '#/dashboard' },
          { label: 'Clientes', href: '#/clientes' },
          { label: tenant ? tenant.nombre : 'Cliente', href: '#/cliente/' + tenantId },
          { label: 'Formularios' }
        ]) +
        (tenant ? App.tenantHeaderCard(tenant) : '') +
        '<div class="section-header">' +
          '<div><h1>Formularios recibidos</h1><div class="section-subtitle">' + (tenant ? esc(tenant.nombre) : '') + '</div></div>' +
        '</div>' +
        '<div class="table-wrapper">' +
          '<div class="table-toolbar" style="flex-direction:column;align-items:stretch;">' +
            '<div class="flex justify-between items-center gap-3 flex-wrap">' +
              '<div class="filter-bar" id="filtroTipo">' +
                '<button class="filter-btn active" data-val="">Todos</button>' +
              '</div>' +
              '<div class="filter-bar" id="filtroLeido">' +
                '<button class="filter-btn active" data-val="">Todos</button>' +
                '<button class="filter-btn" data-val="0">Sin leer</button>' +
                '<button class="filter-btn" data-val="1">Leídos</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="table-scroll" id="formsTable"><div class="table-empty"><div class="spinner"></div></div></div>' +
        '</div>';

      let lista = [];
      let tipos = new Set();
      let filtroTipo = '';
      let filtroLeido = '';
      const baseUrl = '/api/admin/tenants/' + tenantId + '/forms';

      const render = () => {
        let arr = lista.slice();
        if (filtroTipo) arr = arr.filter(f => f.tipo === filtroTipo);
        if (filtroLeido !== '') arr = arr.filter(f => (f.leido ? '1' : '0') === filtroLeido);

        const t = root.querySelector('#formsTable');
        if (!arr.length) {
          t.innerHTML =
            '<div class="table-empty">' + ICONS.clipboard +
              '<h3>' + (lista.length ? 'Sin resultados para los filtros' : 'Todavía no hay formularios') + '</h3>' +
              '<p>' + (lista.length ? 'Probá cambiando los filtros.' : 'Aquí aparecerán las consultas recibidas.') + '</p>' +
            '</div>';
          return;
        }
        arr.sort((a, b) => (Number(b.created_at || 0)) - (Number(a.created_at || 0)));
        t.innerHTML =
          '<table class="data-table">' +
            '<thead><tr>' +
              '<th>ID</th><th>Fecha</th><th>Tipo</th><th>IP</th><th>Preview</th><th>Estado</th>' +
              '<th style="width:200px;">Acciones</th>' +
            '</tr></thead>' +
            '<tbody>' +
              arr.map(f => {
                let data = {};
                try { data = (typeof f.data === 'string') ? JSON.parse(f.data) : (f.data || {}); } catch (e) { data = {}; }
                const preview = [data.nombre, data.email, data.telefono, data.asunto].filter(Boolean).slice(0, 2).join(' · ');
                return (
                  '<tr class="' + (f.leido ? '' : 'unread') + '">' +
                    '<td class="text-sm text-muted">' + f.id + '</td>' +
                    '<td>' + App.formatDate(f.created_at) + '</td>' +
                    '<td><span class="badge badge-info">' + esc(f.tipo || 'contacto') + '</span></td>' +
                    '<td class="text-xs text-muted">' + esc(f.ip || '-') + '</td>' +
                    '<td class="text-sm">' + (preview ? esc(preview) : '<span class="text-muted">Sin datos</span>') + '</td>' +
                    '<td>' + (f.leido
                      ? '<span class="badge badge-muted">Leído</span>'
                      : '<span class="badge badge-warning">Sin leer</span>') +
                    '</td>' +
                    '<td><div class="table-actions">' +
                      (!f.leido ? '<button class="btn btn-outline btn-sm mark-read" data-id="' + f.id + '">Marcar leído</button>' : '') +
                      '<button class="btn-icon primary view-form" data-id="' + f.id + '" title="Ver detalle">' + ICONS.eye + '</button>' +
                      '<button class="btn-icon danger del-form" data-id="' + f.id + '" title="Eliminar">' + ICONS.trash + '</button>' +
                    '</div></td>' +
                  '</tr>'
                );
              }).join('') +
            '</tbody>' +
          '</table>';
      };

      const renderFiltroTipos = () => {
        const bar = root.querySelector('#filtroTipo');
        if (tipos.size <= 1) return;
        const current = filtroTipo;
        const btns = ['<button class="filter-btn ' + (current === '' ? 'active' : '') + '" data-val="">Todos</button>'];
        Array.from(tipos).sort().forEach(tp => {
          btns.push('<button class="filter-btn ' + (current === tp ? 'active' : '') + '" data-val="' + esc(tp) + '">' + esc(tp) + '</button>');
        });
        bar.innerHTML = btns.join('');
        bar.querySelectorAll('.filter-btn').forEach(b => {
          b.addEventListener('click', () => {
            filtroTipo = b.dataset.val;
            renderFiltroTipos();
            root.querySelectorAll('#filtroLeido .filter-btn').forEach(x => {
              x.classList.toggle('active', x.dataset.val === filtroLeido);
            });
            render();
          });
        });
      };

      root.querySelector('#filtroLeido').addEventListener('click', (e) => {
        const b = e.target.closest('.filter-btn');
        if (!b) return;
        filtroLeido = b.dataset.val;
        root.querySelectorAll('#filtroLeido .filter-btn').forEach(x => {
          x.classList.toggle('active', x === b);
        });
        render();
      });

      const cargar = async () => {
        try {
          const r = await App.api(baseUrl);
          lista = (r && r.forms) || [];
        } catch (e) { lista = []; }
        tipos = new Set(lista.map(f => f.tipo || 'contacto').filter(Boolean));
        renderFiltroTipos();
        // initial active buttons
        root.querySelectorAll('#filtroLeido .filter-btn').forEach(x => {
          x.classList.toggle('active', x.dataset.val === filtroLeido);
        });
        render();
      };

      const showDetail = (f) => {
        let data = {};
        try { data = (typeof f.data === 'string') ? JSON.parse(f.data) : (f.data || {}); } catch (e) { data = {}; }
        const dataPretty = JSON.stringify(data, null, 2);
        App.showModal(
          'Formulario #' + f.id + ' · ' + (f.tipo || 'contacto'),
          '<div class="message-detail">' +
            '<div class="message-detail-label">Fecha</div><div class="message-detail-value">' + App.formatDate(f.created_at) + '</div>' +
            '<div class="message-detail-label">Tipo</div><div class="message-detail-value"><span class="badge badge-info">' + esc(f.tipo || 'contacto') + '</span></div>' +
            '<div class="message-detail-label">IP</div><div class="message-detail-value">' + esc(f.ip || '-') + '</div>' +
            '<div class="message-detail-label">Estado</div><div class="message-detail-value">' +
              (f.leido ? '<span class="badge badge-muted">Leído</span>' : '<span class="badge badge-warning">Sin leer</span>') +
            '</div>' +
          '</div>' +
          '<h4 style="font-size:13px;font-weight:700;color:var(--color-text-secondary);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:8px;">Datos del formulario</h4>' +
          '<pre style="max-height:300px;">' + esc(dataPretty) + '</pre>',
          async (close) => {
            if (!f.leido) {
              try {
                await App.api(baseUrl + '/' + f.id, { method: 'PATCH' });
                f.leido = 1;
              } catch (e) {}
            }
            close();
            render();
          },
          f.leido ? 'Cerrar' : 'Marcar leído y cerrar'
        );
      };

      root.addEventListener('click', async (e) => {
        const markBtn = e.target.closest('.mark-read');
        const viewBtn = e.target.closest('.view-form');
        const delBtn = e.target.closest('.del-form');

        if (markBtn) {
          const id = markBtn.dataset.id;
          const f = lista.find(x => x.id == id);
          if (!f) return;
          try {
            await App.api(baseUrl + '/' + id, { method: 'PATCH' });
            f.leido = 1;
            App.showToast('Marcado como leído', 'success');
            render();
          } catch (e) {}
        }
        if (viewBtn) {
          const f = lista.find(x => x.id == viewBtn.dataset.id);
          if (f) showDetail(f);
        }
        if (delBtn) {
          const f = lista.find(x => x.id == delBtn.dataset.id);
          if (!f) return;
          const ok = await App.showConfirm('Eliminar formulario', '¿Seguro que querés eliminar este formulario?', true);
          if (!ok) return;
          try {
            await App.api(baseUrl + '/' + f.id, { method: 'DELETE' });
            App.showToast('Formulario eliminado', 'success');
            await cargar();
          } catch (e) {}
        }
      });

      await cargar();
    }
  };

  window.AdminApp = Object.freeze(Object.assign({ Views }, App));

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.init());
  } else {
    App.init();
  }

})();
