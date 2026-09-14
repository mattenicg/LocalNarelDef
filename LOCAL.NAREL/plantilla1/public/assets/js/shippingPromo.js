(function () {
  'use strict';

  // ==========================================================================
  // CONFIGURACIÓN DE PROMOCIÓN DE ENVÍOS GRATIS
  // REGLA: NO INVENTAR FECHAS NI HORARIOS FICTICIOS.
  // La fecha y hora de finalización debe configurarse exactamente según
  // la definición del cliente. Se deja la propiedad endDate como null
  // para introducirla posteriormente sin inventar una fecha falsa.
  //
  // Para configurar la fecha de finalización:
  // window.__SHIPPING_PROMO_CONFIG__.endDate = '2026-09-21T23:59:59-03:00';
  // o utilizar window.setShippingPromoEndDate('2026-09-21T23:59:59-03:00');
  // ==========================================================================
  window.__SHIPPING_PROMO_CONFIG__ = {
    endDate: null, // Dejar en null hasta recibir la fecha y hora exacta del cliente.
    minAmount: 40000,
    city: 'Santa Fe Capital',
    mainText: 'ENVÍOS GRATIS SOLO POR ESTA SEMANA, ¿QUÉ ESPERÁS? ¡ASÍ SE INAUGURA UNA WEB! ⚡',
    exclusiveLabel: 'EXCLUSIVA PARA SANTA FE CAPITAL',
  };

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

  // Método global para actualizar la fecha programáticamente
  window.setShippingPromoEndDate = function (isoString) {
    if (!window.__SHIPPING_PROMO_CONFIG__) window.__SHIPPING_PROMO_CONFIG__ = {};
    window.__SHIPPING_PROMO_CONFIG__.endDate = isoString;
    updateCountdown();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      updateCountdown();
      setInterval(updateCountdown, 1000);
    });
  } else {
    updateCountdown();
    setInterval(updateCountdown, 1000);
  }
})();
