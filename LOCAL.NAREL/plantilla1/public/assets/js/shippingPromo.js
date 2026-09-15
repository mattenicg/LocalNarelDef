(function () {
  'use strict';

  // ==========================================================================
  // CONFIGURACIÓN DE PROMOCIÓN DE ENVÍOS GRATIS Y CONTADOR
  // Persistente, configurable desde el panel de administración
  // No se reinicia al recargar la página porque calcula la diferencia
  // exacta con una marca de tiempo absoluta (timestamp en UTC).
  // ==========================================================================

  const DEFAULT_CONFIG = {
    enabled: true,
    endDate: null,
    minAmount: 40000,
    city: 'Santa Fe Capital',
    mainText: 'ENVÍOS GRATIS SOLO POR ESTA SEMANA, ¿QUÉ ESPERÁS? ¡ASÍ SE INAUGURA UNA WEB! ⚡',
    exclusiveLabel: 'EXCLUSIVA PARA SANTA FE CAPITAL',
    subText: 'Envíos por compras a partir de <strong>$40.000</strong>.',
  };

  // 1. Respetar configuración pre-inyectada por el servidor en <head> si existe
  const injectedConfig = window.__SHIPPING_PROMO_CONFIG__ || {};
  
  // 2. Cache local en localStorage para carga instantánea sin parpadeo
  let cachedEndDate = null;
  try {
    cachedEndDate = localStorage.getItem('narel_shipping_promo_end_date');
  } catch (_) {}

  window.__SHIPPING_PROMO_CONFIG__ = Object.assign({}, DEFAULT_CONFIG, injectedConfig);

  // Si no vino endDate en el HTML pero sí estaba en el cache local, usarlo mientras carga el API
  if (!window.__SHIPPING_PROMO_CONFIG__.endDate && cachedEndDate) {
    window.__SHIPPING_PROMO_CONFIG__.endDate = cachedEndDate;
  }

  function applyDomUpdates(config) {
    if (!config) return;

    const banner = document.getElementById('shippingPromoBanner');
    if (banner) {
      if (config.enabled === false) {
        banner.style.display = 'none';
        return;
      } else {
        banner.style.display = '';
      }
    }

    // Título principal
    if (config.mainText) {
      const headingEl = document.querySelector('.shipping-promo-heading');
      if (headingEl && headingEl.textContent.trim() !== config.mainText.trim()) {
        headingEl.textContent = config.mainText;
      }
    }

    // Badge exclusivo
    if (config.exclusiveLabel) {
      const badgeText = document.querySelector('.shipping-promo-badge span:last-child');
      if (badgeText && badgeText.textContent.trim() !== config.exclusiveLabel.trim()) {
        badgeText.textContent = config.exclusiveLabel;
      }
    }

    // Detalle / Monto mínimo
    if (config.subText || config.minAmount) {
      const detailEl = document.querySelector('.shipping-promo-detail');
      if (detailEl) {
        if (config.subText && config.subText.includes('<')) {
          detailEl.innerHTML = `<span>${config.subText}</span>`;
        } else if (config.subText) {
          detailEl.innerHTML = `<span>${config.subText}</span>`;
        } else if (config.minAmount) {
          detailEl.innerHTML = `<span>Envíos por compras a partir de <strong>$${Number(config.minAmount).toLocaleString('es-AR')}</strong>.</span>`;
        }
      }
    }
  }

  function updateCountdown() {
    const daysEl = document.querySelector('[data-sp-days]');
    const hoursEl = document.querySelector('[data-sp-hours]');
    const minsEl = document.querySelector('[data-sp-mins]');
    const statusEl = document.getElementById('shippingPromoHint');

    if (!daysEl || !hoursEl || !minsEl) return;

    const rawEnd = window.__SHIPPING_PROMO_CONFIG__?.endDate;
    if (!rawEnd) {
      daysEl.textContent = '--';
      hoursEl.textContent = '--';
      minsEl.textContent = '--';
      if (statusEl) {
        statusEl.textContent = 'Fecha de finalización a configurar';
      }
      return;
    }

    const endDate = new Date(rawEnd);
    if (isNaN(endDate.getTime())) {
      daysEl.textContent = '--';
      hoursEl.textContent = '--';
      minsEl.textContent = '--';
      if (statusEl) {
        statusEl.textContent = 'Fecha inválida';
      }
      return;
    }

    const now = Date.now();
    const diff = endDate.getTime() - now;

    if (diff <= 0) {
      daysEl.textContent = '00';
      hoursEl.textContent = '00';
      minsEl.textContent = '00';
      if (statusEl) {
        statusEl.textContent = 'Promoción finalizada';
      }
      return;
    }

    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / (3600 * 24));
    const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);

    daysEl.textContent = String(days).padStart(2, '0');
    hoursEl.textContent = String(hours).padStart(2, '0');
    minsEl.textContent = String(mins).padStart(2, '0');
    if (statusEl) {
      statusEl.textContent = 'Tiempo restante';
    }
  }

  // Sincronización asíncrona con el backend
  async function syncWithServer() {
    try {
      const res = await fetch('/api/shipping-promo/public');
      if (!res.ok) return;
      const json = await res.json();
      if (json && json.ok && json.data) {
        window.__SHIPPING_PROMO_CONFIG__ = Object.assign({}, window.__SHIPPING_PROMO_CONFIG__, json.data);
        if (json.data.endDate) {
          try {
            localStorage.setItem('narel_shipping_promo_end_date', json.data.endDate);
          } catch (_) {}
        } else {
          try {
            localStorage.removeItem('narel_shipping_promo_end_date');
          } catch (_) {}
        }
        applyDomUpdates(window.__SHIPPING_PROMO_CONFIG__);
        updateCountdown();
      }
    } catch (err) {
      // Si falla la red, el countdown ya funciona con la fecha inyectada o del localStorage
      console.debug('[shippingPromo] Usando configuración local/inyectada.');
    }
  }

  // Método global para actualizar la fecha programáticamente
  window.setShippingPromoEndDate = function (isoString) {
    if (!window.__SHIPPING_PROMO_CONFIG__) window.__SHIPPING_PROMO_CONFIG__ = {};
    window.__SHIPPING_PROMO_CONFIG__.endDate = isoString;
    try {
      if (isoString) localStorage.setItem('narel_shipping_promo_end_date', isoString);
      else localStorage.removeItem('narel_shipping_promo_end_date');
    } catch (_) {}
    updateCountdown();
  };

  // Inicialización
  function init() {
    applyDomUpdates(window.__SHIPPING_PROMO_CONFIG__);
    updateCountdown();
    setInterval(updateCountdown, 1000);
    syncWithServer();

    // Re-sincronizar si la pestaña vuelve a ser visible
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        syncWithServer();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
