(function () {
  'use strict';

  const ICONS = {
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    exito: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="20 6 9 17 4 12"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    whatsapp: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>',
    telefono: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
    email: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
    ubicacion: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
    reloj: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    facebook: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>',
    twitter: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
    youtube: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>',
    linkedin: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.063 2.063 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>',
    tiktok: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
    document: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    zap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    award: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    arrowRight: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>',
    sparkles: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/><path d="M19 14l.75 2.25L22 17l-2.25.75L19 20l-.75-2.25L16 17l2.25-.75L19 14z"/><path d="M5 15l.5 1.5L7 17l-1.5.5L5 19l-.5-1.5L3 17l1.5-.5L5 15z"/></svg>'
  };

  const DEFAULT_CONFIG = {
    colores: {
      primario: '#2563eb',
      secundario: '#7c3aed',
      acento: '#0ea5e9'
    },
    meta: {
      title: 'Tu Negocio — Servicios Profesionales',
      description: 'Soluciones profesionales para tu negocio.',
      og_image_url: ''
    },
    hero: {
      kicker: '✨ Bienvenido',
      titulo: 'Impulsa tu negocio',
      titulo_acento: 'con soluciones reales.',
      subtitulo: 'Ofrecemos servicios profesionales diseñados para llevar tu proyecto al siguiente nivel. Calidad, confianza y resultados garantizados.'
    },
    stats: [
      { numero: '10+', texto: 'Años de experiencia' },
      { numero: '500+', texto: 'Clientes felices' },
      { numero: '100%', texto: 'Satisfacción' }
    ],
    beneficios: [
      { icono: 'zap', titulo: 'Atención rápida', texto: 'Respondemos a tus consultas en tiempo récord.' },
      { icono: 'award', titulo: 'Calidad garantizada', texto: 'Resultados de excelencia en cada proyecto.' },
      { icono: 'shield', titulo: 'Total confianza', texto: 'Transparencia y compromiso en cada paso.' },
      { icono: 'heart', titulo: 'Atención personalizada', texto: 'Tratamos a cada cliente como único.' }
    ],
    nosotros: {
      titulo: 'Somos un equipo apasionado por lo que hacemos',
      texto: 'Con años de experiencia en el sector, nos dedicamos a ofrecer soluciones de calidad que realmente marcan la diferencia. Trabajamos de la mano con cada cliente para entender sus necesidades y superar sus expectativas.',
      card_titulo: 'Compromiso total',
      card_texto: 'Garantía de satisfacción en cada proyecto'
    },
    direccion: '',
    horarios: [],
    horario_texto: 'Lun-Vie 9:00-18:00',
    redes: {
      web: '',
      facebook: '',
      instagram: '',
      twitter: '',
      youtube: '',
      linkedin: '',
      tiktok: ''
    },
    footer_about: 'Soluciones profesionales diseñadas para impulsar tu negocio.'
  };

  const ROUTES = ['home', 'servicios', 'galeria', 'nosotros', 'contacto', 'presupuesto', '404'];

  function genUUID() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    if (window.crypto && window.crypto.getRandomValues) {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = window.crypto.getRandomValues(new Uint8Array(1))[0] % 16 | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function escapeHTML(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function debounce(fn, wait) {
    let t;
    return function () {
      const ctx = this, args = arguments;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, wait);
    };
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''));
  }

  function deepMerge(target, source) {
    if (typeof target !== 'object' || target === null) return source;
    if (typeof source !== 'object' || source === null) return target;
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        target[key] = deepMerge(target[key] || {}, source[key]);
      } else if (source[key] !== undefined) {
        target[key] = source[key];
      }
    }
    return target;
  }

  const App = {
    slug: null,
    tenant: null,
    config: null,
    servicios: [],
    galeria: [],
    dataLoaded: false,
    loadingData: false,
    sessionId: null,
    chatHistory: [],

    async init() {
      try {
        this.slug = this.extractSlug();
        const injected = window.__TENANT__;
        if (injected && injected.slug && injected.tenant && injected.config) {
          this.slug = injected.slug;
          this.tenant = injected.tenant;
          this.config = deepMerge(JSON.parse(JSON.stringify(DEFAULT_CONFIG)), injected.config || {});
          this.dataLoaded = true;
        } else {
          await this.loadTenantConfig();
        }

        if (!this.config) this.config = deepMerge({}, DEFAULT_CONFIG);
        if (!this.tenant) {
          this.tenant = {
            id: null,
            slug: this.slug || 'demo',
            nombre: this.config.meta?.title?.split('—')[0]?.trim() || 'Tu Negocio',
            dominio: window.location.origin,
            whatsapp: '',
            email_contacto: ''
          };
        }

        this.sessionId = this.getOrCreateSessionId();

        this.applyTheme(this.config.colores || DEFAULT_CONFIG.colores);
        this.fillSiteContent();
        this.setupSchema();
        this.fillMetadata(
          this.config.meta?.title || DEFAULT_CONFIG.meta.title,
          this.config.meta?.description || DEFAULT_CONFIG.meta.description,
          this.config.meta?.og_image_url || ''
        );
        this.setupNavbar();
        this.setupWhatsappButton();
        this.setupGalleryLightbox();
        this.setupIAChat();
        this.setupScroll();
        this.router();
        window.addEventListener('hashchange', () => this.router());

        this.loadDataCollections();

      } catch (err) {
        console.error('Error init App:', err);
        this.showToast('error', 'Error de inicialización', err.message || 'Ocurrió un problema al cargar la página');
        window.location.hash = '#/404';
        this.router();
      }
    },

    extractSlug() {
      const injected = window.__TENANT__;
      if (injected && injected.slug) return injected.slug;
      const parts = window.location.pathname.split('/').filter(Boolean);
      if (parts.length > 0 && parts[0] !== 'public' && parts[0] !== 'assets' && parts[0] !== 'admin') {
        return parts[0];
      }
      const hash = window.location.hash || '';
      const match = hash.match(/#\/t\/([a-zA-Z0-9_-]+)/);
      if (match) return match[1];
      const host = window.location.hostname;
      if (host && host !== 'localhost' && !/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
        const sub = host.split('.')[0];
        if (sub && sub !== 'www' && host.split('.').length > 2) return sub;
      }
      return 'demo';
    },

    async loadTenantConfig() {
      try {
        const slug = this.slug;
        const resp = await fetch(`/api/public/${encodeURIComponent(slug)}/config`);
        if (!resp.ok) {
          if (resp.status === 404 || resp.status >= 500) {
            window.location.hash = '#/404';
            throw new Error('Tenant no encontrado');
          }
          throw new Error('HTTP ' + resp.status);
        }
        const data = await resp.json();
        if (!data.ok) throw new Error(data.error || 'Respuesta inválida');
        this.tenant = data.tenant;
        this.config = deepMerge(JSON.parse(JSON.stringify(DEFAULT_CONFIG)), data.config || {});
        this.dataLoaded = true;
      } catch (err) {
        if (err.message !== 'Tenant no encontrado') {
          console.warn('No se pudo cargar config de tenant, usando demo local:', err.message);
          this.config = deepMerge({}, DEFAULT_CONFIG);
          this.tenant = {
            id: null,
            slug: this.slug || 'demo',
            nombre: 'Tu Negocio Demo',
            dominio: window.location.origin,
            whatsapp: '',
            email_contacto: 'demo@example.com'
          };
          this.dataLoaded = true;
        } else {
          throw err;
        }
      }
    },

    async loadDataCollections() {
      if (this.loadingData) return;
      this.loadingData = true;
      try {
        const slug = this.tenant && this.tenant.slug ? this.tenant.slug : this.slug;
        try {
          const [sResp, gResp] = await Promise.all([
            fetch(`/api/public/${encodeURIComponent(slug)}/services`).then(r => r.ok ? r.json() : Promise.resolve({ ok: false })),
            fetch(`/api/public/${encodeURIComponent(slug)}/gallery`).then(r => r.ok ? r.json() : Promise.resolve({ ok: false }))
          ]);
          if (sResp && sResp.ok && Array.isArray(sResp.servicios)) this.servicios = sResp.servicios;
          if (gResp && gResp.ok && Array.isArray(gResp.galeria)) this.galeria = gResp.galeria;
        } catch (e) {
          console.warn('No se pudieron cargar colecciones:', e.message);
        }
        this.router();
      } finally {
        this.loadingData = false;
      }
    },

    applyTheme(colors) {
      const root = document.documentElement;
      const c = Object.assign({}, DEFAULT_CONFIG.colores, colors || {});
      if (c.primario) root.style.setProperty('--color-primario', c.primario);
      if (c.secundario) root.style.setProperty('--color-secundario', c.secundario);
      if (c.acento) root.style.setProperty('--color-acento', c.acento);
      const metaTheme = document.querySelector('meta[name="theme-color"]');
      if (metaTheme) metaTheme.setAttribute('content', c.primario || '#2563eb');
    },

    fillMetadata(title, description, ogImage) {
      if (title) {
        document.title = title;
        this.setMetaTag('property', 'og:title', title);
        this.setMetaTag('name', 'twitter:title', title);
      }
      if (description) {
        this.setMetaTag('name', 'description', description);
        this.setMetaTag('property', 'og:description', description);
        this.setMetaTag('name', 'twitter:description', description);
      }
      if (ogImage) {
        this.setMetaTag('property', 'og:image', ogImage);
        this.setMetaTag('name', 'twitter:image', ogImage);
      }
      const url = window.location.href;
      this.setMetaTag('property', 'og:url', url);
    },

    setMetaTag(attr, key, value) {
      let el = document.querySelector(`meta[${attr}="${key}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute('content', value || '');
    },

    fillSiteContent() {
      const cfg = this.config;
      const t = this.tenant || {};
      const nombre = (t && t.nombre) ? t.nombre : (cfg.meta && cfg.meta.title ? cfg.meta.title.split('—')[0].trim() : 'TuNegocio');
      const inicial = (nombre || 'N').trim().charAt(0).toUpperCase();

      ['brandName', 'brandNameFooter', 'footerBrandName'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = nombre;
      });
      ['logoMark', 'logoMarkFooter'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = inicial;
      });

      if (cfg.hero) {
        const hk = document.getElementById('heroKicker');
        if (hk && cfg.hero.kicker) hk.textContent = cfg.hero.kicker;
        const ht = document.getElementById('heroTitle');
        if (ht && cfg.hero.titulo) {
          ht.innerHTML = escapeHTML(cfg.hero.titulo) + (cfg.hero.titulo_acento ? ` <span class="gradient">${escapeHTML(cfg.hero.titulo_acento)}</span>` : '');
        } else if (ht && cfg.hero.titulo_acento) {
          const existing = ht.querySelector('span.gradient');
          if (existing) existing.textContent = cfg.hero.titulo_acento;
        }
        const htag = document.getElementById('heroTagline');
        if (htag && cfg.hero.subtitulo) htag.textContent = cfg.hero.subtitulo;
      }

      if (Array.isArray(cfg.stats) && cfg.stats.length) {
        const stats = document.getElementById('heroStats');
        if (stats) {
          stats.innerHTML = cfg.stats.slice(0, 4).map(s => `
            <div class="stat"><b>${escapeHTML(s.numero || '')}</b><span>${escapeHTML(s.texto || '')}</span></div>
          `).join('');
        }
      }

      const fa = document.getElementById('footerAbout');
      if (fa && cfg.footer_about) fa.textContent = cfg.footer_about;

      if (cfg.horario_texto) {
        const fh = document.getElementById('footerHorario');
        if (fh) fh.textContent = cfg.horario_texto;
      }

      this.fillFooterContact();
      this.fillSocialLinks();
      this.fillYear();
    },

    fillFooterContact() {
      const t = this.tenant || {};
      const cfg = this.config || {};

      const tel = document.getElementById('footerTelefono');
      if (tel) {
        if (t.whatsapp) {
          tel.href = `https://wa.me/${String(t.whatsapp).replace(/\D/g, '')}`;
          tel.textContent = t.whatsapp;
          tel.target = '_blank';
          tel.rel = 'noopener noreferrer';
        } else {
          tel.href = '#';
          tel.textContent = '—';
        }
      }

      const em = document.getElementById('footerEmail');
      if (em) {
        if (t.email_contacto) {
          em.href = `mailto:${t.email_contacto}`;
          em.textContent = t.email_contacto;
        } else {
          em.href = '#';
          em.textContent = '—';
        }
      }

      const dir = document.getElementById('footerDireccion');
      if (dir) {
        dir.textContent = cfg.direccion || (t.direccion ? t.direccion : '—');
      }
    },

    fillSocialLinks() {
      const container = document.getElementById('footerSocial');
      if (!container) return;
      const redes = (this.config && this.config.redes) || {};
      const items = [];
      const iconos = {
        facebook: { icon: ICONS.facebook, label: 'Facebook' },
        instagram: { icon: ICONS.instagram, label: 'Instagram' },
        twitter: { icon: ICONS.twitter, label: 'X / Twitter' },
        youtube: { icon: ICONS.youtube, label: 'YouTube' },
        linkedin: { icon: ICONS.linkedin, label: 'LinkedIn' },
        tiktok: { icon: ICONS.tiktok, label: 'TikTok' },
        web: { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>', label: 'Sitio web' }
      };
      for (const key of Object.keys(iconos)) {
        const url = redes[key];
        if (!url) continue;
        const conf = iconos[key];
        items.push(`<a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer" aria-label="${conf.label}" title="${conf.label}">${conf.icon}</a>`);
      }
      container.innerHTML = items.join('');
    },

    fillYear() {
      const el = document.getElementById('year');
      if (el) el.textContent = String(new Date().getFullYear());
    },

    async setupSchema() {
      const el = document.getElementById('schemaJson');
      try {
        const slug = this.tenant && this.tenant.slug ? this.tenant.slug : this.slug;
        const resp = await fetch(`/api/public/${encodeURIComponent(slug)}/schema`);
        if (resp.ok) {
          const data = await resp.json();
          if (data && data.ok && data.schema) {
            el.textContent = JSON.stringify(data.schema);
            return;
          }
        }
      } catch (e) { /* ignore */ }

      const t = this.tenant || {};
      const cfg = this.config || {};
      const schema = {
        '@context': 'https://schema.org',
        '@type': 'LocalBusiness',
        name: t.nombre || '',
        description: cfg.meta?.description || '',
        email: t.email_contacto || undefined,
        telephone: t.whatsapp ? `+${String(t.whatsapp).replace(/\D/g, '')}` : undefined,
        image: cfg.meta?.og_image_url || undefined,
        url: cfg.redes?.web || t.dominio || window.location.origin,
        address: cfg.direccion ? { '@type': 'PostalAddress', streetAddress: cfg.direccion, addressCountry: 'ES' } : undefined,
        priceRange: '$$',
        openingHoursSpecification: Array.isArray(cfg.horarios) ? cfg.horarios.map(h => ({
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: h.dia || undefined,
          opens: (h.horario || '').split(' - ')[0] || undefined,
          closes: (h.horario || '').split(' - ')[1] || undefined
        })) : undefined,
        sameAs: Object.values(cfg.redes || {}).filter(Boolean)
      };
      el.textContent = JSON.stringify(schema);
    },

    setupNavbar() {
      const hamburger = document.getElementById('hamburger');
      const nav = document.getElementById('navbarNav');
      if (hamburger && nav) {
        hamburger.addEventListener('click', () => {
          const open = nav.classList.toggle('open');
          hamburger.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
      }
      document.addEventListener('click', (e) => {
        if (!nav || !hamburger) return;
        if (nav.classList.contains('open') && !nav.contains(e.target) && !hamburger.contains(e.target)) {
          nav.classList.remove('open');
          hamburger.setAttribute('aria-expanded', 'false');
        }
      });
    },

    setupScroll() {
      const navbar = document.getElementById('navbar');
      if (!navbar) return;
      const onScroll = () => {
        if (window.scrollY > 10) navbar.classList.add('scrolled');
        else navbar.classList.remove('scrolled');
      };
      onScroll();
      window.addEventListener('scroll', debounce(onScroll, 10), { passive: true });
    },

    setupWhatsappButton() {
      const btn = document.getElementById('whatsappFloatBtn');
      if (!btn) return;
      const wa = (this.tenant && this.tenant.whatsapp) ? String(this.tenant.whatsapp).replace(/\D/g, '') : '';
      if (!wa) {
        btn.style.opacity = '0';
        btn.style.pointerEvents = 'none';
        return;
      }
      const msj = encodeURIComponent(`Hola! Vengo de tu sitio web y tengo una consulta.`);
      btn.href = `https://wa.me/${wa}?text=${msj}`;
    },

    setupGalleryLightbox() {
      const lightbox = document.getElementById('lightbox');
      const closeBtn = document.getElementById('lightboxClose');
      const img = document.getElementById('lightboxImg');
      if (!lightbox) return;

      const close = () => {
        lightbox.classList.remove('open');
        document.body.style.overflow = '';
        if (img) { img.src = ''; img.alt = ''; }
      };

      if (closeBtn) closeBtn.addEventListener('click', close);
      lightbox.addEventListener('click', (e) => { if (e.target === lightbox) close(); });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && lightbox.classList.contains('open')) close(); });

      document.addEventListener('click', (e) => {
        const item = e.target.closest('[data-galeria-src]');
        if (!item) return;
        e.preventDefault();
        const src = item.getAttribute('data-galeria-src') || item.querySelector('img')?.getAttribute('src');
        const alt = item.getAttribute('data-galeria-alt') || item.querySelector('img')?.getAttribute('alt') || 'Imagen';
        if (!src) return;
        if (img) { img.src = src; img.alt = alt; }
        lightbox.classList.add('open');
        document.body.style.overflow = 'hidden';
      });
    },

    setupIAChat() {
      const toggle = document.getElementById('iaChatToggle');
      const panel = document.getElementById('iaChatPanel');
      const closeBtn = document.getElementById('iaChatClose');
      const input = document.getElementById('iaChatInput');
      const sendBtn = document.getElementById('iaChatSend');
      const messagesEl = document.getElementById('iaChatMessages');
      if (!toggle || !panel || !input || !sendBtn || !messagesEl) return;

      const stored = localStorage.getItem(`ia_hist_${this.slug || 'demo'}`);
      if (stored) {
        try { this.chatHistory = JSON.parse(stored); } catch (_) { this.chatHistory = []; }
      }
      this.renderIAChatMessages();

      if (!this.chatHistory.length) {
        this.chatHistory.push({
          role: 'bot',
          contenido: `¡Hola! 👋 Soy el asistente virtual de ${(this.tenant && this.tenant.nombre) || 'nuestro negocio'}. ¿En qué puedo ayudarte hoy?`,
          sugerencias: ['¿Qué servicios ofrecen?', '¿Cuáles son sus horarios?', '¿Cómo solicito un presupuesto?', 'Hable con un humano']
        });
        this.renderIAChatMessages();
        this.saveIAChatHistory();
      }

      const open = () => {
        panel.classList.add('open');
        panel.setAttribute('aria-modal', 'true');
        setTimeout(() => input.focus(), 100);
        messagesEl.scrollTop = messagesEl.scrollHeight;
      };
      const close = () => {
        panel.classList.remove('open');
        panel.setAttribute('aria-modal', 'false');
      };

      toggle.addEventListener('click', () => {
        panel.classList.contains('open') ? close() : open();
      });
      if (closeBtn) closeBtn.addEventListener('click', close);

      sendBtn.addEventListener('click', () => this.sendIAMessage());
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendIAMessage(); }
      });
      input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';
      });

      messagesEl.addEventListener('click', (e) => {
        const sug = e.target.closest('.ia-quick-reply');
        if (sug) {
          const text = sug.getAttribute('data-text') || sug.textContent.trim();
          if (text) {
            input.value = text;
            this.sendIAMessage();
          }
        }
      });
    },

    getOrCreateSessionId() {
      const key = `ia_session_${this.slug || 'demo'}`;
      let id = localStorage.getItem(key);
      if (!id) { id = genUUID(); localStorage.setItem(key, id); }
      return id;
    },

    saveIAChatHistory() {
      try {
        const trimmed = this.chatHistory.slice(-30);
        localStorage.setItem(`ia_hist_${this.slug || 'demo'}`, JSON.stringify(trimmed));
      } catch (_) { /* ignore */ }
    },

    renderIAChatMessages() {
      const messagesEl = document.getElementById('iaChatMessages');
      if (!messagesEl) return;
      messagesEl.innerHTML = this.chatHistory.map(m => {
        if (m.typing) {
          return `<div class="ia-msg bot typing" aria-label="Escribiendo"><span></span><span></span><span></span></div>`;
        }
        const cls = m.role === 'user' ? 'user' : 'bot';
        let extra = '';
        if (m.accion_whatsapp_url) {
          extra += `<div style="margin-top:10px"><a href="${escapeHTML(m.accion_whatsapp_url)}" class="ia-wa-btn" target="_blank" rel="noopener noreferrer">${ICONS.whatsapp} Ir a WhatsApp</a></div>`;
        }
        if (Array.isArray(m.sugerencias) && m.sugerencias.length) {
          extra += `<div class="ia-quick-replies">${m.sugerencias.map(s => `<button class="ia-quick-reply" data-text="${escapeHTML(s)}">${escapeHTML(s)}</button>`).join('')}</div>`;
        }
        return `<div class="ia-msg ${cls}">${escapeHTML(m.contenido || m.texto || '').replace(/\n/g, '<br>')}${extra}</div>`;
      }).join('');
      messagesEl.scrollTop = messagesEl.scrollHeight;
    },

    async sendIAMessage() {
      const input = document.getElementById('iaChatInput');
      const sendBtn = document.getElementById('iaChatSend');
      const messagesEl = document.getElementById('iaChatMessages');
      if (!input || !sendBtn || !messagesEl) return;

      const mensaje = (input.value || '').trim();
      if (!mensaje) return;

      input.value = '';
      input.style.height = 'auto';

      this.chatHistory.push({ role: 'user', contenido: mensaje });
      this.renderIAChatMessages();
      this.saveIAChatHistory();

      const typingIdx = this.chatHistory.length;
      this.chatHistory.push({ role: 'bot', typing: true });
      this.renderIAChatMessages();

      sendBtn.disabled = true;
      try {
        const slug = this.tenant && this.tenant.slug ? this.tenant.slug : this.slug;
        const resp = await fetch(`/api/ia/${encodeURIComponent(slug)}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: this.sessionId,
            mensaje,
            historial: this.chatHistory.slice(-10).filter(m => !m.typing).map(m => ({ role: m.role, contenido: m.contenido || m.texto || '' }))
          })
        });

        this.chatHistory.splice(typingIdx, 1);

        if (resp.status === 429) {
          const wa = (this.tenant && this.tenant.whatsapp) ? String(this.tenant.whatsapp).replace(/\D/g, '') : '';
          const waUrl = wa ? `https://wa.me/${wa}?text=${encodeURIComponent('Hola! Quería consultar sobre sus servicios.')}` : null;
          this.chatHistory.push({
            role: 'bot',
            contenido: 'Has alcanzado el límite de mensajes por hora. Por favor, contáctanos directamente por WhatsApp.',
            accion_whatsapp_url: waUrl || undefined
          });
          this.showToast('warning', 'Límite alcanzado', 'Intenta nuevamente más tarde o usa WhatsApp.');
        } else if (!resp.ok) {
          let msg = 'Error al procesar mensaje';
          try {
            const d = await resp.json();
            if (d && d.error) msg = d.error;
          } catch (_) { }
          this.chatHistory.push({
            role: 'bot',
            contenido: 'Lo siento, ocurrió un error: ' + msg
          });
          this.showToast('error', 'Error', msg);
        } else {
          const data = await resp.json();
          const entrada = {
            role: 'bot',
            contenido: (data && data.respuesta) || (data && data.mensaje) || (data && data.texto) || '...',
            accion_whatsapp_url: data && (data.accion_whatsapp_url || data.whatsapp_url) || undefined,
            sugerencias: Array.isArray(data && data.sugerencias) ? data.sugerencias.slice(0, 4) : undefined
          };
          if (!entrada.accion_whatsapp_url && data && data.accion === 'whatsapp' && this.tenant && this.tenant.whatsapp) {
            const wa = String(this.tenant.whatsapp).replace(/\D/g, '');
            entrada.accion_whatsapp_url = `https://wa.me/${wa}?text=${encodeURIComponent(data.mensaje_whatsapp || 'Hola!')}`;
          }
          this.chatHistory.push(entrada);
        }
      } catch (err) {
        this.chatHistory.splice(typingIdx, 1);
        this.chatHistory.push({ role: 'bot', contenido: 'Error de conexión. Revisa tu internet e intenta nuevamente.' });
        this.showToast('error', 'Error de red', err.message || 'No se pudo conectar');
      } finally {
        sendBtn.disabled = false;
        this.renderIAChatMessages();
        this.saveIAChatHistory();
        setTimeout(() => input.focus(), 0);
      }
    },

    router() {
      const hash = window.location.hash || '#/home';
      const raw = hash.replace(/^#\/?/, '');
      const parts = raw.split('/').filter(Boolean);
      let route = parts[0] || 'home';
      if (!ROUTES.includes(route)) route = '404';
      this.setActiveNav(route);
      const main = document.getElementById('mainContent');
      if (!main) return;
      if (!this.dataLoaded) {
        main.innerHTML = `<div class="loading-spinner-wrap"><div class="spinner"></div></div>`;
        return;
      }
      window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
      switch (route) {
        case 'home': this.renderHome(); break;
        case 'servicios': this.renderServicios(); break;
        case 'galeria': this.renderGaleria(); break;
        case 'nosotros': this.renderNosotros(); break;
        case 'contacto': this.renderContacto(); break;
        case 'presupuesto': this.renderPresupuesto(); break;
        case '404':
        default: this.render404(); break;
      }
    },

    setActiveNav(route) {
      document.querySelectorAll('#navbarNav a[data-route]').forEach(a => {
        if (a.getAttribute('data-route') === route) a.classList.add('active');
        else a.classList.remove('active');
      });
      const nav = document.getElementById('navbarNav');
      const hamburger = document.getElementById('hamburger');
      if (nav && nav.classList.contains('open')) {
        nav.classList.remove('open');
        if (hamburger) hamburger.setAttribute('aria-expanded', 'false');
      }
    },

    renderContainer(html, includeContainer = true) {
      const main = document.getElementById('mainContent');
      if (!main) return;
      main.innerHTML = includeContainer ? `<div class="container">${html}</div>` : html;
    },

    renderHome() {
      const servicios = (this.servicios || []).filter(s => s.activo !== 0).slice(0, 6);
      const galeria = (this.galeria || []).filter(g => g.activo !== 0).slice(0, 6);
      const cfg = this.config || DEFAULT_CONFIG;
      const t = this.tenant || {};
      const wa = t.whatsapp ? String(t.whatsapp).replace(/\D/g, '') : '';

      const serviciosHTML = servicios.length
        ? `<div class="section"><div class="section-head"><span class="eyebrow">Nuestra oferta</span><h2>Servicios destacados</h2><p>Explora los servicios más solicitados por nuestros clientes.</p></div><div class="servicios-grid">${servicios.map(this.renderServicioCard.bind(this)).join('')}</div><div style="text-align:center;margin-top:32px"><a href="#/servicios" class="btn btn-secondary">Ver todos los servicios ${ICONS.arrowRight}</a></div></div>`
        : '';

      const galeriaHTML = galeria.length
        ? `<div class="section section-alt"><div class="container"><div class="section-head"><span class="eyebrow">Nuestro trabajo</span><h2>Galería destacada</h2><p>Un vistazo a algunos de nuestros proyectos recientes.</p></div><div class="galeria-grid">${galeria.map(this.renderGaleriaItem.bind(this)).join('')}</div><div style="text-align:center;margin-top:32px"><a href="#/galeria" class="btn btn-secondary">Ver galería completa ${ICONS.arrowRight}</a></div></div></div>`
        : '';

      const ctaHTML = `<div class="section"><div class="container"><div class="cta-banner"><div><h2>¿Listo para comenzar?</h2><p>Solicita un presupuesto sin compromiso o chatea directamente con nosotros.</p></div>${wa ? `<a href="https://wa.me/${wa}?text=${encodeURIComponent('Hola! Quiero solicitar un presupuesto.')}" class="btn btn-whatsapp" target="_blank" rel="noopener noreferrer">${ICONS.whatsapp} Chatear por WhatsApp</a>` : `<a href="#/presupuesto" class="btn btn-whatsapp">${ICONS.document} Solicitar presupuesto</a>`}</div></div></div>`;

      this.renderContainer(`
        ${serviciosHTML ? serviciosHTML : `<div class="section section-alt">${serviciosHTML}</div>`}
        ${galeriaHTML}
        ${ctaHTML}
      `, false);
    },

    renderServicioCard(s) {
      const icono = s.icono || (ICONS[s.icono] ? '' : ICONS.zap);
      const iconSVG = ICONS[s.icono] || ICONS.star;
      return `
        <div class="servicio-card">
          <div class="servicio-icon">${iconSVG}</div>
          <h3>${escapeHTML(s.nombre || 'Servicio')}</h3>
          <p>${escapeHTML(s.descripcion || '')}</p>
          ${s.precio != null ? `<div class="precio"><span class="valor">${escapeHTML(String(s.precio).startsWith('$') || String(s.precio).startsWith('€') ? '' : '$')}${escapeHTML(String(s.precio))}</span>${s.precio_nota ? `<small>${escapeHTML(s.precio_nota)}</small>` : (s.precio_unit ? `<small> ${escapeHTML(s.precio_unit)}</small>` : '')}</div>` : ''}
          <a href="#/presupuesto?servicio=${encodeURIComponent(s.id || s.nombre || '')}" class="btn btn-primary btn-sm btn-full">Solicitar</a>
        </div>
      `;
    },

    renderGaleriaItem(g) {
      const src = g.url_imagen || g.imagen || g.src || '';
      const thumb = g.url_thumbnail || src;
      const fallback = `this.onerror=null;this.removeAttribute('data-galeria-src');this.parentElement.style.background='linear-gradient(135deg,var(--color-primario),var(--color-secundario))';this.style.display='none';this.parentElement.innerHTML='<div style=\\'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:48px;opacity:.7\\'>${ICONS.image}</div>';`;
      return `
        <div class="galeria-item" data-galeria-src="${escapeHTML(src)}" data-galeria-alt="${escapeHTML(g.titulo || g.alt || 'Imagen')}" role="button" tabindex="0" aria-label="${escapeHTML(g.titulo || 'Abrir imagen')}">
          <img src="${escapeHTML(thumb || src)}" alt="${escapeHTML(g.titulo || g.alt || 'Imagen')}" loading="lazy" onerror="${fallback}">
          <div class="galeria-overlay"><span>${escapeHTML(g.titulo || '')}</span></div>
        </div>
      `;
    },

    renderServicios() {
      const all = (this.servicios || []).filter(s => s.activo !== 0);
      const categorias = {};
      all.forEach(s => {
        const cat = s.categoria || 'General';
        if (!categorias[cat]) categorias[cat] = [];
        categorias[cat].push(s);
      });

      let html = `<div class="section"><div class="section-head"><span class="eyebrow">Servicios</span><h2>Nuestros Servicios</h2><p>Soluciones diseñadas para impulsar tu negocio. Calidad y profesionalismo garantizados.</p></div>`;

      if (!all.length) {
        html += `<div class="empty-state">${ICONS.document}<h3>Sin servicios disponibles</h3><p>Por favor, vuelve más tarde o contáctanos para conocer nuestra oferta.</p></div>`;
      } else {
        const nombres = Object.keys(categorias);
        if (nombres.length <= 1) {
          html += `<div class="servicios-grid">${all.map(this.renderServicioCard.bind(this)).join('')}</div>`;
        } else {
          nombres.forEach(cat => {
            html += `<h3 style="font-size:22px;margin:32px 0 20px"><span class="eyebrow" style="margin-right:12px">${escapeHTML(cat)}</span></h3>`;
            html += `<div class="servicios-grid">${categorias[cat].map(this.renderServicioCard.bind(this)).join('')}</div>`;
          });
        }
      }
      html += `</div>`;
      html += this.renderFormPresupuestoCTA();
      this.renderContainer(html, true);
    },

    renderGaleria() {
      const items = (this.galeria || []).filter(g => g.activo !== 0);
      let html = `<div class="section"><div class="section-head"><span class="eyebrow">Galería</span><h2>Nuestro Trabajo</h2><p>Descubre la calidad de nuestros proyectos en imágenes. Haz clic en cualquier foto para ampliar.</p></div>`;
      if (!items.length) {
        html += `<div class="empty-state">${ICONS.image}<h3>Galería vacía</h3><p>Pronto compartiremos imágenes de nuestros proyectos.</p></div>`;
      } else {
        html += `<div class="galeria-masonry">${items.map(this.renderGaleriaItem.bind(this)).join('')}</div>`;
      }
      html += `</div>`;
      this.renderContainer(html, true);
    },

    renderNosotros() {
      const cfg = this.config || DEFAULT_CONFIG;
      const nosotros = cfg.nosotros || DEFAULT_CONFIG.nosotros;
      const beneficios = Array.isArray(cfg.beneficios) && cfg.beneficios.length ? cfg.beneficios : DEFAULT_CONFIG.beneficios;
      const aboutImg = cfg.nosotros_imagen || `https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=equipo%20de%20trabajo%20profesional%20en%20oficina%20moderna%20colaborando%2C%20luz%20natural%2C%20estilo%20fotograf%C3%ADa%20corporativa&image_size=portrait_4_3`;

      const html = `
        <div class="section">
          <div class="section-head">
            <span class="eyebrow">Nosotros</span>
            <h2>Sobre Nosotros</h2>
            <p>Conoce más sobre nuestro equipo, nuestra misión y lo que nos apasiona.</p>
          </div>
          <div class="about-grid">
            <div class="about-visual" aria-hidden="true">
              <div class="about-accent"></div>
              <img src="${escapeHTML(aboutImg)}" alt="Equipo de trabajo" loading="lazy" onerror="this.style.display='none'">
              <div class="about-card-float">
                <div class="check">${ICONS.check}</div>
                <div>
                  <b>${escapeHTML(nosotros.card_titulo || DEFAULT_CONFIG.nosotros.card_titulo)}</b>
                  <span>${escapeHTML(nosotros.card_texto || DEFAULT_CONFIG.nosotros.card_texto)}</span>
                </div>
              </div>
            </div>
            <div class="about-copy">
              <h2>${escapeHTML(nosotros.titulo || DEFAULT_CONFIG.nosotros.titulo)}</h2>
              <p class="intro">${escapeHTML(nosotros.texto || DEFAULT_CONFIG.nosotros.texto)}</p>
              <div class="beneficios">
                ${beneficios.map(b => `
                  <div class="beneficio">
                    <div class="beneficio-icon">${ICONS[b.icono] || ICONS.star}</div>
                    <div>
                      <h4>${escapeHTML(b.titulo || '')}</h4>
                      <p>${escapeHTML(b.texto || '')}</p>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
        ${this.renderHorariosSection()}
      `;
      this.renderContainer(html, true);
    },

    renderHorariosSection() {
      const cfg = this.config || {};
      if (!Array.isArray(cfg.horarios) || !cfg.horarios.length) return '';
      return `
        <div class="section section-alt">
          <div class="section-head">
            <span class="eyebrow">Horarios</span>
            <h2>Nuestros Horarios</h2>
            <p>Estamos disponibles en los siguientes días y horarios.</p>
          </div>
          <div class="horarios-list" style="max-width:520px;margin:0 auto">
            ${cfg.horarios.map(h => `
              <div class="horario-item ${(h.cerrado || h.horario === 'Cerrado') ? 'cerrado' : ''}">
                <span class="dia">${escapeHTML(h.dia || '')}</span>
                <span class="hora">${escapeHTML(h.cerrado ? 'Cerrado' : (h.horario || ''))}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    },

    renderContacto() {
      const t = this.tenant || {};
      const cfg = this.config || {};
      const wa = t.whatsapp ? String(t.whatsapp).replace(/\D/g, '') : '';

      const html = `
        <div class="section">
          <div class="section-head">
            <span class="eyebrow">Contacto</span>
            <h2>¿Listo para comenzar? Hablemos</h2>
            <p>Cuéntanos sobre tu proyecto y te responderemos a la brevedad.</p>
          </div>
          <div class="contacto-grid">
            <aside class="contacto-info">
              <h3>Información de contacto</h3>
              <p class="intro-contacto">Estamos disponibles para atender tus consultas. Elige el canal que prefieras.</p>
              <address class="info-items">
                ${t.whatsapp ? `
                  <div class="info-item">
                    <div class="info-icon">${ICONS.telefono}</div>
                    <div>
                      <b>Teléfono / WhatsApp</b>
                      <a href="https://wa.me/${wa}" target="_blank" rel="noopener noreferrer">${escapeHTML(t.whatsapp)}</a>
                    </div>
                  </div>
                ` : ''}
                ${t.email_contacto ? `
                  <div class="info-item">
                    <div class="info-icon">${ICONS.email}</div>
                    <div>
                      <b>Email</b>
                      <a href="mailto:${escapeHTML(t.email_contacto)}">${escapeHTML(t.email_contacto)}</a>
                    </div>
                  </div>
                ` : ''}
                ${cfg.direccion ? `
                  <div class="info-item">
                    <div class="info-icon">${ICONS.ubicacion}</div>
                    <div>
                      <b>Ubicación</b>
                      <span>${escapeHTML(cfg.direccion)}</span>
                    </div>
                  </div>
                ` : ''}
                ${cfg.horario_texto ? `
                  <div class="info-item">
                    <div class="info-icon">${ICONS.reloj}</div>
                    <div>
                      <b>Horario</b>
                      <span>${escapeHTML(cfg.horario_texto)}</span>
                    </div>
                  </div>
                ` : ''}
              </address>
              ${wa ? `
                <a href="https://wa.me/${wa}?text=${encodeURIComponent('Hola! Quería contactarme con ustedes.')}" class="btn btn-whatsapp btn-full" target="_blank" rel="noopener noreferrer" style="margin-top:8px">
                  ${ICONS.whatsapp} Chatear por WhatsApp
                </a>
              ` : ''}
            </aside>

            <div class="form-card">
              <h3>Envíanos un mensaje</h3>
              <p class="subtitulo">Responderemos tu consulta en menos de 24 horas.</p>
              ${this.renderFormMarkup('contacto', 'contactoForm')}
            </div>
          </div>
        </div>
      `;
      this.renderContainer(html, true);
      this.setupForm('contacto', 'contactoForm');
    },

    renderPresupuesto() {
      const t = this.tenant || {};
      const wa = t.whatsapp ? String(t.whatsapp).replace(/\D/g, '') : '';
      const servicios = (this.servicios || []).filter(s => s.activo !== 0);

      const html = `
        <div class="section">
          <div class="section-head">
            <span class="eyebrow">Presupuesto</span>
            <h2>Solicita tu Presupuesto</h2>
            <p>Cuéntanos qué necesitas y te enviaremos un presupuesto personalizado sin compromiso.</p>
          </div>
          <div class="form-card" style="max-width:760px;margin:0 auto">
            <h3>Datos del presupuesto</h3>
            <p class="subtitulo">Completa el formulario y te contactaremos a la brevedad.</p>
            ${this.renderFormMarkup('presupuesto', 'presupuestoForm', { incluirServicio: true, incluirFecha: true, servicios })}
          </div>
          ${wa ? `
            <div style="text-align:center;margin-top:32px">
              <p style="color:var(--texto-claro);margin-bottom:12px">¿Prefieres atención inmediata?</p>
              <a href="https://wa.me/${wa}?text=${encodeURIComponent('Hola! Quiero un presupuesto personalizado.')}" class="btn btn-whatsapp" target="_blank" rel="noopener noreferrer">
                ${ICONS.whatsapp} Consultar por WhatsApp
              </a>
            </div>
          ` : ''}
        </div>
      `;
      this.renderContainer(html, true);
      this.setupForm('presupuesto', 'presupuestoForm');
    },

    render404() {
      const html = `
        <div class="page-not-found">
          <h2>404</h2>
          <h3 style="font-size:28px;margin-bottom:16px">Página no encontrada</h3>
          <p>La página que buscas no existe o ha sido movida.</p>
          <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
            <a href="#/home" class="btn btn-primary">Volver al inicio</a>
            <a href="#/contacto" class="btn btn-secondary">Contactar</a>
          </div>
        </div>
      `;
      this.renderContainer(html, true);
    },

    renderFormPresupuestoCTA() {
      return `
        <div class="section section-alt">
          <div class="container">
            <div class="cta-banner">
              <div>
                <h2>¿Tienes un proyecto en mente?</h2>
                <p>Solicita tu presupuesto personalizado hoy mismo. Sin compromiso.</p>
              </div>
              <a href="#/presupuesto" class="btn btn-whatsapp">
                ${ICONS.document} Solicitar presupuesto
              </a>
            </div>
          </div>
        </div>
      `;
    },

    renderFormMarkup(tipo, formId, opts) {
      opts = opts || {};
      const servicios = opts.servicios || [];
      return `
        <div class="form-success" id="${formId}-success" role="status" aria-live="polite">
          ${ICONS.exito}
          <div>
            <b style="display:block;margin-bottom:4px">¡Enviado correctamente!</b>
            <span id="${formId}-success-text">Te contactaremos a la brevedad.</span>
          </div>
          <a href="#" class="btn btn-whatsapp btn-sm" id="${formId}-wa" target="_blank" rel="noopener noreferrer" style="margin-left:auto;display:none">
            ${ICONS.whatsapp} Ir a WhatsApp
          </a>
        </div>
        <div class="form-error-box" id="${formId}-error" role="alert" aria-live="assertive">
          ${ICONS.error}
          <span id="${formId}-error-text">Error al enviar</span>
        </div>
        <form id="${formId}" novalidate data-tipo="${tipo}">
          <div class="form-hp" aria-hidden="true">
            <label>Deja este campo vacío: <input type="text" name="website" tabindex="-1" autocomplete="off"></label>
          </div>
          <div class="form-grid form-grid-2">
            <div class="form-group">
              <label for="${formId}-nombre">Nombre <span class="req">*</span></label>
              <input type="text" id="${formId}-nombre" name="nombre" class="form-control" placeholder="Tu nombre completo" required minlength="2" maxlength="100">
              <span class="form-error-msg" data-error-for="${formId}-nombre"></span>
            </div>
            <div class="form-group">
              <label for="${formId}-email">Email <span class="req">*</span></label>
              <input type="email" id="${formId}-email" name="email" class="form-control" placeholder="tu@email.com" required maxlength="150">
              <span class="form-error-msg" data-error-for="${formId}-email"></span>
            </div>
            <div class="form-group">
              <label for="${formId}-telefono">Teléfono <span class="req">*</span></label>
              <input type="tel" id="${formId}-telefono" name="telefono" class="form-control" placeholder="+34 600 000 000" required minlength="6" maxlength="30">
              <span class="form-error-msg" data-error-for="${formId}-telefono"></span>
            </div>
            <div class="form-group">
              <label for="${formId}-empresa">Empresa (opcional)</label>
              <input type="text" id="${formId}-empresa" name="empresa" class="form-control" placeholder="Nombre de tu empresa" maxlength="100">
            </div>
            ${opts.incluirServicio ? `
              <div class="form-group">
                <label for="${formId}-servicio">Servicio de interés</label>
                <select id="${formId}-servicio" name="servicio" class="form-control">
                  <option value="">Selecciona una opción...</option>
                  ${servicios.map(s => `<option value="${escapeHTML(s.id || '')}">${escapeHTML(s.nombre || '')}${s.precio ? ` — ${s.precio}` : ''}</option>`).join('')}
                  <option value="otro">Otro / No estoy seguro</option>
                </select>
              </div>
            ` : ''}
            ${opts.incluirFecha ? `
              <div class="form-group">
                <label for="${formId}-fecha">Fecha deseada (opcional)</label>
                <input type="date" id="${formId}-fecha" name="fecha" class="form-control">
              </div>
            ` : ''}
          </div>
          <div class="form-group">
            <label for="${formId}-mensaje">${tipo === 'presupuesto' ? 'Cuéntanos sobre tu proyecto <span class="req">*</span>' : 'Mensaje <span class="req">*</span>'}</label>
            <textarea id="${formId}-mensaje" name="mensaje" class="form-control" placeholder="${tipo === 'presupuesto' ? 'Detalla lo que necesitas, alcance, plazos...' : 'Cuéntanos sobre tu consulta...'}" required minlength="10" maxlength="2000" rows="5"></textarea>
            <span class="form-error-msg" data-error-for="${formId}-mensaje"></span>
          </div>
          <div class="form-submit-wrap">
            <button type="submit" class="btn btn-primary" id="${formId}-submit">
              <span class="btn-text">${tipo === 'presupuesto' ? 'Solicitar presupuesto' : 'Enviar mensaje'}</span>
              <span class="spinner spinner-sm" id="${formId}-spinner" style="display:none;vertical-align:middle"></span>
            </button>
            <span style="font-size:12px;color:var(--texto-claro)">Al enviar aceptas nuestra política de privacidad.</span>
          </div>
        </form>
      `;
    },

    setupForm(tipo, formId) {
      const form = document.getElementById(formId);
      if (!form) return;
      const submitBtn = document.getElementById(`${formId}-submit`);
      const spinner = document.getElementById(`${formId}-spinner`);
      const successBox = document.getElementById(`${formId}-success`);
      const successText = document.getElementById(`${formId}-success-text`);
      const waBtn = document.getElementById(`${formId}-wa`);
      const errorBox = document.getElementById(`${formId}-error`);
      const errorText = document.getElementById(`${formId}-error-text`);

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        this.clearFormErrors(form);
        successBox && successBox.classList.remove('show');
        errorBox && errorBox.classList.remove('show');

        const fd = new FormData(form);
        const data = {};
        fd.forEach((v, k) => { data[k] = typeof v === 'string' ? v.trim() : v; });

        const errors = this.validateFormData(data);
        if (Object.keys(errors).length) {
          this.showFormErrors(form, errors);
          this.showToast('error', 'Revisa el formulario', 'Completa los campos obligatorios.');
          return;
        }

        if (data.website) return;

        if (submitBtn) {
          submitBtn.disabled = true;
          const txt = submitBtn.querySelector('.btn-text');
          if (txt) txt.style.display = 'none';
        }
        if (spinner) spinner.style.display = 'inline-block';

        try {
          const slug = this.tenant && this.tenant.slug ? this.tenant.slug : this.slug;
          const body = Object.assign({}, data);
          if (data.servicio) {
            const servicios = this.servicios || [];
            const encontrado = servicios.find(s => String(s.id) === String(data.servicio));
            if (encontrado) body.servicio_nombre = encontrado.nombre;
          }
          const resp = await fetch(`/api/public/${encodeURIComponent(slug)}/forms/${encodeURIComponent(tipo)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });

          let json = { ok: false };
          try { json = await resp.json(); } catch (_) { }

          if (!resp.ok || !json.ok) {
            let msg = json && json.error ? json.error : `Error HTTP ${resp.status}`;
            if (resp.status === 429) msg = 'Demasiados envíos. Espera un momento y vuelve a intentar.';
            throw new Error(msg);
          }

          if (successText && json.mensaje) successText.textContent = json.mensaje;
          if (waBtn && json.whatsapp_url) {
            waBtn.href = json.whatsapp_url;
            waBtn.style.display = 'inline-flex';
          } else if (waBtn) {
            waBtn.style.display = 'none';
          }
          successBox && successBox.classList.add('show');
          this.showToast('success', '¡Enviado!', json.mensaje || 'Te contactaremos a la brevedad.');
          form.reset();

        } catch (err) {
          if (errorText) errorText.textContent = err.message || 'Error al enviar';
          errorBox && errorBox.classList.add('show');
          this.showToast('error', 'Error al enviar', err.message || 'Intenta nuevamente.');
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            const txt = submitBtn.querySelector('.btn-text');
            if (txt) txt.style.display = 'inline';
          }
          if (spinner) spinner.style.display = 'none';
        }
      });
    },

    validateFormData(data) {
      const errors = {};
      if (!data.nombre || data.nombre.length < 2) errors.nombre = 'Ingresa tu nombre (mínimo 2 caracteres)';
      if (!data.email || !isValidEmail(data.email)) errors.email = 'Ingresa un email válido';
      if (!data.telefono || String(data.telefono).replace(/\D/g, '').length < 6) errors.telefono = 'Ingresa un teléfono válido';
      if (!data.mensaje || data.mensaje.length < 10) errors.mensaje = 'Cuéntanos más (mínimo 10 caracteres)';
      return errors;
    },

    showFormErrors(form, errors) {
      for (const key of Object.keys(errors)) {
        const input = form.querySelector(`[name="${key}"]`);
        if (!input) continue;
        input.classList.add('error');
        const span = form.querySelector(`[data-error-for="${input.id}"]`);
        if (span) span.textContent = errors[key];
      }
      const first = form.querySelector('.form-control.error');
      if (first) first.focus && first.focus();
    },

    clearFormErrors(form) {
      form.querySelectorAll('.form-control.error').forEach(i => i.classList.remove('error'));
      form.querySelectorAll('[data-error-for]').forEach(s => s.textContent = '');
    },

    showToast(tipo, titulo, texto) {
      const container = document.getElementById('toastContainer');
      if (!container) return;
      const id = 't_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
      const toast = document.createElement('div');
      toast.className = `toast ${tipo}`;
      toast.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
      toast.id = id;
      toast.innerHTML = `
        ${ICONS[tipo] || ICONS.check}
        <div>
          <b>${escapeHTML(titulo || '')}</b>
          <span>${escapeHTML(texto || '')}</span>
        </div>
        <button class="toast-close" aria-label="Cerrar aviso" onclick="document.getElementById('${id}').remove()">
          ${ICONS.close}
        </button>
      `;
      container.appendChild(toast);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => toast.classList.add('show'));
      });
      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
      }, 5000);
    }
  };

  window.App = App;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.init());
  } else {
    App.init();
  }
})();
