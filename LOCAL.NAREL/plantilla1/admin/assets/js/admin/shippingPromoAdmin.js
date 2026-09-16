(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ShippingPromoAdmin = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Helper para formatear Date a string compatible con input type="datetime-local" (hora local)
  function toDateTimeLocalString(date) {
    if (!date || isNaN(date.getTime())) return '';
    const YYYY = date.getFullYear();
    const MM = String(date.getMonth() + 1).padStart(2, '0');
    const DD = String(date.getDate()).padStart(2, '0');
    const HH = String(date.getHours()).padStart(2, '0');
    const II = String(date.getMinutes()).padStart(2, '0');
    return `${YYYY}-${MM}-${DD}T${HH}:${II}`;
  }

  // Helper para parsear valor datetime-local a Date en zona local
  function parseDateTimeLocal(val) {
    if (!val) return null;
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }

  class ShippingPromoAdmin {
    constructor(options = {}) {
      this.containerId = options.containerId || 'shippingPromoAdminContainer';
      this.apiGetUrl = options.apiGetUrl || '/api/admin/shipping-promo';
      this.apiSaveUrl = options.apiSaveUrl || '/api/admin/shipping-promo';
      this.config = null;
      this.timerId = null;
    }

    async init() {
      const container = document.getElementById(this.containerId);
      if (!container) return;

      container.innerHTML = this.renderSkeleton();
      await this.loadConfig();
      this.bindEvents();
      this.startPreviewTimer();
    }

    renderSkeleton() {
      return `
        <div class="admin-panel promo-admin-card" id="spAdminCard" style="background:#141414;border:1px solid #2a2a2a;border-radius:8px;padding:24px;margin-bottom:28px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;margin-bottom:20px;">
            <div>
              <div style="font:700 11px 'DM Mono',monospace;color:#ffffff;letter-spacing:.2em;text-transform:uppercase;margin-bottom:6px;">
                ⚡ GESTIÓN DE ENLACE Y TIEMPO
              </div>
              <h2 style="font-family:'Bangers',cursive,sans-serif;font-size:28px;letter-spacing:.05em;color:#fff;margin:0;">
                CONTADOR DE ENVÍOS GRATIS
              </h2>
              <p style="font-size:13px;color:#b0b0b0;margin-top:4px;font-family:'DM Mono',monospace;">
                Configurá la fecha y hora exacta de finalización. El contador en la tienda se sincroniza automáticamente y nunca se reinicia al refrescar.
              </p>
            </div>
            <div id="spStatusBadge" style="padding:6px 14px;border-radius:4px;font:700 11px 'DM Mono',monospace;letter-spacing:.12em;background:#1e1e1e;color:#b0b0b0;border:1px solid #333;">
              CARGANDO...
            </div>
          </div>

          <div id="spFeedback" style="display:none;padding:12px 16px;border-radius:4px;margin-bottom:20px;font-family:'DM Mono',monospace;font-size:12px;letter-spacing:.05em;"></div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(300px, 1fr));gap:24px;align-items:start;">
            
            <!-- FORMULARIO DE EDICIÓN -->
            <form id="spForm" novalidate>
              <div class="form-group" style="margin-bottom:18px;">
                <label style="display:flex;align-items:center;gap:10px;cursor:pointer;user-select:none;">
                  <input type="checkbox" id="spEnabled" style="width:18px;height:18px;accent-color:#fff;cursor:pointer;">
                  <span style="font-size:14px;font-weight:600;color:#fff;letter-spacing:.05em;">Activar banner y contador en la tienda</span>
                </label>
              </div>

              <div class="form-group" style="margin-bottom:18px;">
                <label for="spEndDate" style="display:block;font:700 11px 'DM Mono',monospace;color:#b0b0b0;letter-spacing:.1em;text-transform:uppercase;margin-bottom:8px;">
                  Fecha y Hora de Finalización *
                </label>
                <input type="datetime-local" id="spEndDate" class="form-control" style="background:#0a0a0a;border:1px solid #333;color:#fff;padding:10px 14px;border-radius:4px;font-family:'DM Mono',monospace;font-size:14px;width:100%;box-sizing:border-box;">
                <small style="display:block;color:#888;font-size:11px;margin-top:6px;font-family:'DM Mono',monospace;">
                  Seleccioná la fecha y hora exacta hasta la que durará la promoción.
                </small>
              </div>

              <!-- BOTONES RÁPIDOS -->
              <div style="margin-bottom:20px;">
                <div style="font:600 10px 'DM Mono',monospace;color:#888;letter-spacing:.1em;margin-bottom:6px;text-transform:uppercase;">
                  Accesos rápidos para fijar fecha:
                </div>
                <div style="display:flex;gap:6px;flex-wrap:wrap;">
                  <button type="button" class="sp-preset-btn" data-preset="24h" style="padding:6px 10px;background:#1e1e1e;border:1px solid #333;color:#fff;border-radius:4px;font:700 10px 'DM Mono',monospace;cursor:pointer;">+24 HORAS</button>
                  <button type="button" class="sp-preset-btn" data-preset="3d" style="padding:6px 10px;background:#1e1e1e;border:1px solid #333;color:#fff;border-radius:4px;font:700 10px 'DM Mono',monospace;cursor:pointer;">+3 DÍAS</button>
                  <button type="button" class="sp-preset-btn" data-preset="7d" style="padding:6px 10px;background:#1e1e1e;border:1px solid #333;color:#fff;border-radius:4px;font:700 10px 'DM Mono',monospace;cursor:pointer;">+7 DÍAS</button>
                  <button type="button" class="sp-preset-btn" data-preset="sunday" style="padding:6px 10px;background:#1e1e1e;border:1px solid #333;color:#fff;border-radius:4px;font:700 10px 'DM Mono',monospace;cursor:pointer;">DOMINGO 23:59</button>
                  <button type="button" class="sp-preset-btn" data-preset="clear" style="padding:6px 10px;background:#1e1e1e;border:1px solid #444;color:#e74c3c;border-radius:4px;font:700 10px 'DM Mono',monospace;cursor:pointer;">LIMPIAR</button>
                </div>
              </div>

              <div class="form-group" style="margin-bottom:16px;">
                <label for="spMinAmount" style="display:block;font:700 11px 'DM Mono',monospace;color:#b0b0b0;letter-spacing:.1em;text-transform:uppercase;margin-bottom:8px;">
                  Monto Mínimo de Compra ($ ARS)
                </label>
                <input type="number" id="spMinAmount" min="0" step="1000" class="form-control" style="background:#0a0a0a;border:1px solid #333;color:#fff;padding:10px 14px;border-radius:4px;font-family:'DM Mono',monospace;font-size:14px;width:100%;box-sizing:border-box;" placeholder="40000">
              </div>

              <div class="form-group" style="margin-bottom:16px;">
                <label for="spMainText" style="display:block;font:700 11px 'DM Mono',monospace;color:#b0b0b0;letter-spacing:.1em;text-transform:uppercase;margin-bottom:8px;">
                  Texto Principal del Anuncio
                </label>
                <textarea id="spMainText" rows="2" class="form-control" style="background:#0a0a0a;border:1px solid #333;color:#fff;padding:10px 14px;border-radius:4px;font-family:inherit;font-size:13px;width:100%;box-sizing:border-box;"></textarea>
              </div>

              <div class="form-group" style="margin-bottom:20px;">
                <label for="spExclusiveLabel" style="display:block;font:700 11px 'DM Mono',monospace;color:#b0b0b0;letter-spacing:.1em;text-transform:uppercase;margin-bottom:8px;">
                  Etiqueta Destacada
                </label>
                <input type="text" id="spExclusiveLabel" class="form-control" style="background:#0a0a0a;border:1px solid #333;color:#fff;padding:10px 14px;border-radius:4px;font-family:inherit;font-size:13px;width:100%;box-sizing:border-box;" placeholder="EXCLUSIVA PARA SANTA FE CAPITAL">
              </div>

              <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
                <button type="submit" id="spSaveBtn" class="button primary" style="padding:12px 24px;font-family:'Bangers',cursive,sans-serif;font-size:18px;letter-spacing:.1em;background:#ffffff;color:#0a0a0a;cursor:pointer;border-radius:4px;">
                  💾 GUARDAR CAMBIOS
                </button>
                <a href="/" target="_blank" class="button secondary" style="padding:10px 16px;border:1px solid #333;color:#b0b0b0;border-radius:4px;font:700 11px 'DM Mono',monospace;display:inline-flex;align-items:center;gap:6px;">
                  VER TIENDA ↗
                </a>
              </div>
            </form>

            <!-- VISTA PREVIA EN VIVO -->
            <div style="background:#0a0a0a;border:1px solid #222;border-radius:6px;padding:20px;">
              <div style="font:700 10px 'DM Mono',monospace;color:#888;letter-spacing:.2em;text-transform:uppercase;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;">
                <span>VISTA PREVIA EN TIENDA</span>
                <span style="color:#2ecc71;display:flex;align-items:center;gap:4px;">● EN VIVO</span>
              </div>

              <!-- REPLICA EXACTA DE LA TARJETA DEL CONTADOR -->
              <div class="sp-preview-wrap" style="display:flex;justify-content:center;padding:18px 10px;">
                <div style="min-width:240px;background:linear-gradient(180deg, #181818 0%, #0c0c0c 100%);border:1.5px solid rgba(255, 255, 255, 0.4);border-radius:6px;padding:14px 18px;box-shadow:0 4px 20px rgba(0,0,0,0.7);text-align:center;box-sizing:border-box;position:relative;">
                  <div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg, transparent, #ffffff, transparent);border-radius:6px 6px 0 0;"></div>
                  
                  <div style="font:700 10px 'DM Mono',monospace;letter-spacing:.25em;color:#ffffff;text-transform:uppercase;margin-bottom:8px;display:flex;align-items:center;justify-content:center;gap:6px;">
                    <span style="display:inline-block;width:14px;height:1px;background:rgba(255,255,255,0.4);"></span>
                    <span>OFERTA LIMITADA</span>
                    <span style="display:inline-block;width:14px;height:1px;background:rgba(255,255,255,0.4);"></span>
                  </div>

                  <div style="display:flex;flex-direction:row;align-items:center;justify-content:center;gap:6px;">
                    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:50px;padding:6px 8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.12);border-radius:4px;">
                      <span id="prevDays" style="font-family:'Bangers',cursive,sans-serif;font-size:26px;line-height:1;color:#fff;">00</span>
                      <span style="font:600 9px 'DM Mono',monospace;letter-spacing:.15em;color:#b0b0b0;margin-top:3px;">DÍAS</span>
                    </div>
                    <span style="font-family:'Bangers',cursive,sans-serif;font-size:22px;line-height:1;color:#fff;padding-bottom:8px;">:</span>
                    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:50px;padding:6px 8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.12);border-radius:4px;">
                      <span id="prevHours" style="font-family:'Bangers',cursive,sans-serif;font-size:26px;line-height:1;color:#fff;">00</span>
                      <span style="font:600 9px 'DM Mono',monospace;letter-spacing:.15em;color:#b0b0b0;margin-top:3px;">HORAS</span>
                    </div>
                    <span style="font-family:'Bangers',cursive,sans-serif;font-size:22px;line-height:1;color:#fff;padding-bottom:8px;">:</span>
                    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:50px;padding:6px 8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.12);border-radius:4px;">
                      <span id="prevMins" style="font-family:'Bangers',cursive,sans-serif;font-size:26px;line-height:1;color:#fff;">00</span>
                      <span style="font:600 9px 'DM Mono',monospace;letter-spacing:.15em;color:#b0b0b0;margin-top:3px;">MIN</span>
                    </div>
                  </div>

                  <div id="prevHint" style="margin-top:8px;font:500 10px 'DM Mono',monospace;letter-spacing:.08em;color:#b0b0b0;text-transform:uppercase;">
                    TIEMPO RESTANTE
                  </div>
                </div>
              </div>

              <!-- RESUMEN EN VIVO DEL TEXTO -->
              <div style="margin-top:16px;padding-top:14px;border-top:1px solid #1a1a1a;">
                <div style="font:600 10px 'DM Mono',monospace;color:#666;letter-spacing:.1em;margin-bottom:6px;text-transform:uppercase;">
                  Encabezado en tienda:
                </div>
                <div id="prevMainText" style="font-family:'Bangers',cursive,sans-serif;font-size:16px;letter-spacing:.03em;color:#fff;line-height:1.2;">
                  —
                </div>
                <div id="prevSubText" style="margin-top:6px;font-size:11px;color:#b0b0b0;font-family:'DM Mono',monospace;">
                  —
                </div>
              </div>

            </div>

          </div>
        </div>
      `;
    }

    async loadConfig() {
      try {
        const res = await window.auth.apiFetch(this.apiGetUrl, { method: 'GET' });
        if (res && res.ok && res.data) {
          this.config = res.data;
          this.populateForm();
          this.updatePreviewAndStatus();
        } else {
          this.showFeedback(res?.message || 'Error al cargar la configuración', 'error');
        }
      } catch (err) {
        this.showFeedback('Error de conexión al cargar datos', 'error');
      }
    }

    populateForm() {
      if (!this.config) return;

      const enabledEl = document.getElementById('spEnabled');
      const endDateEl = document.getElementById('spEndDate');
      const minAmountEl = document.getElementById('spMinAmount');
      const mainTextEl = document.getElementById('spMainText');
      const exclusiveLabelEl = document.getElementById('spExclusiveLabel');

      if (enabledEl) enabledEl.checked = this.config.enabled !== false;
      if (endDateEl && this.config.endDate) {
        const d = new Date(this.config.endDate);
        endDateEl.value = toDateTimeLocalString(d);
      }
      if (minAmountEl && this.config.minAmount !== undefined) minAmountEl.value = this.config.minAmount;
      if (mainTextEl && this.config.mainText) mainTextEl.value = this.config.mainText;
      if (exclusiveLabelEl && this.config.exclusiveLabel) exclusiveLabelEl.value = this.config.exclusiveLabel;
    }

    bindEvents() {
      const form = document.getElementById('spForm');
      if (form) {
        form.addEventListener('submit', (e) => this.handleSubmit(e));
      }

      // Input changes reflect in preview immediately
      ['spEndDate', 'spMainText', 'spMinAmount', 'spExclusiveLabel', 'spEnabled'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
          el.addEventListener('input', () => this.updatePreviewAndStatus());
          el.addEventListener('change', () => this.updatePreviewAndStatus());
        }
      });

      // Preset buttons
      const presetButtons = document.querySelectorAll('.sp-preset-btn');
      presetButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
          const preset = btn.getAttribute('data-preset');
          this.applyPreset(preset);
        });
      });
    }

    applyPreset(preset) {
      const dateEl = document.getElementById('spEndDate');
      if (!dateEl) return;

      const now = new Date();
      let targetDate = null;

      if (preset === '24h') {
        targetDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      } else if (preset === '3d') {
        targetDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      } else if (preset === '7d') {
        targetDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      } else if (preset === 'sunday') {
        // Próximo domingo a las 23:59:59
        targetDate = new Date(now);
        const day = now.getDay();
        const daysUntilSunday = day === 0 ? 7 : 7 - day;
        targetDate.setDate(now.getDate() + daysUntilSunday);
        targetDate.setHours(23, 59, 59, 999);
      } else if (preset === 'clear') {
        targetDate = null;
      }

      if (targetDate) {
        dateEl.value = toDateTimeLocalString(targetDate);
      } else {
        dateEl.value = '';
      }

      this.updatePreviewAndStatus();
    }

    startPreviewTimer() {
      if (this.timerId) clearInterval(this.timerId);
      this.timerId = setInterval(() => {
        this.updatePreviewAndStatus();
      }, 1000);
    }

    updatePreviewAndStatus() {
      const enabledEl = document.getElementById('spEnabled');
      const endDateEl = document.getElementById('spEndDate');
      const mainTextEl = document.getElementById('spMainText');
      const minAmountEl = document.getElementById('spMinAmount');

      const isEnabled = enabledEl ? enabledEl.checked : true;
      const rawDateVal = endDateEl ? endDateEl.value : null;

      const daysEl = document.getElementById('prevDays');
      const hoursEl = document.getElementById('prevHours');
      const minsEl = document.getElementById('prevMins');
      const hintEl = document.getElementById('prevHint');
      const statusBadge = document.getElementById('spStatusBadge');

      const prevMainText = document.getElementById('prevMainText');
      const prevSubText = document.getElementById('prevSubText');

      if (prevMainText && mainTextEl) {
        prevMainText.textContent = mainTextEl.value.trim() || 'ENVÍOS GRATIS SOLO POR ESTA SEMANA, ¿QUÉ ESPERÁS? ¡ASÍ SE INAUGURA UNA WEB! ⚡';
      }
      if (prevSubText && minAmountEl) {
        const amt = Number(minAmountEl.value) || 40000;
        prevSubText.textContent = `Envíos por compras a partir de $${amt.toLocaleString('es-AR')}.`;
      }

      if (!statusBadge || !daysEl) return;

      if (!isEnabled) {
        statusBadge.textContent = '⚪ PAUSADO / OCULTO';
        statusBadge.style.background = '#222';
        statusBadge.style.color = '#888';
        statusBadge.style.borderColor = '#333';
        daysEl.textContent = '--';
        hoursEl.textContent = '--';
        minsEl.textContent = '--';
        hintEl.textContent = 'Banner Desactivado';
        return;
      }

      if (!rawDateVal) {
        statusBadge.textContent = '🟡 SIN FECHA DEFINIDA';
        statusBadge.style.background = '#2c2500';
        statusBadge.style.color = '#f1c40f';
        statusBadge.style.borderColor = '#554600';
        daysEl.textContent = '--';
        hoursEl.textContent = '--';
        minsEl.textContent = '--';
        hintEl.textContent = 'Fecha a configurar';
        return;
      }

      const target = parseDateTimeLocal(rawDateVal);
      if (!target) {
        statusBadge.textContent = '🔴 FECHA INVÁLIDA';
        statusBadge.style.background = '#300';
        statusBadge.style.color = '#e74c3c';
        statusBadge.style.borderColor = '#600';
        daysEl.textContent = '--';
        hoursEl.textContent = '--';
        minsEl.textContent = '--';
        hintEl.textContent = 'Fecha Inválida';
        return;
      }

      const diff = target.getTime() - Date.now();

      if (diff <= 0) {
        statusBadge.textContent = '🔴 PROMO FINALIZADA';
        statusBadge.style.background = '#300';
        statusBadge.style.color = '#e74c3c';
        statusBadge.style.borderColor = '#600';
        daysEl.textContent = '00';
        hoursEl.textContent = '00';
        minsEl.textContent = '00';
        hintEl.textContent = 'Promoción finalizada';
        return;
      }

      statusBadge.textContent = '🟢 ACTIVO EN TIENDA';
      statusBadge.style.background = '#0d2818';
      statusBadge.style.color = '#2ecc71';
      statusBadge.style.borderColor = '#185028';

      const totalSec = Math.floor(diff / 1000);
      const d = Math.floor(totalSec / (3600 * 24));
      const h = Math.floor((totalSec % (3600 * 24)) / 3600);
      const m = Math.floor((totalSec % 3600) / 60);

      daysEl.textContent = String(d).padStart(2, '0');
      hoursEl.textContent = String(h).padStart(2, '0');
      minsEl.textContent = String(m).padStart(2, '0');
      hintEl.textContent = 'Tiempo restante';
    }

    async handleSubmit(e) {
      if (e) e.preventDefault();

      const saveBtn = document.getElementById('spSaveBtn');
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'GUARDANDO...';
      }

      try {
        const enabled = document.getElementById('spEnabled')?.checked ?? true;
        const rawDate = document.getElementById('spEndDate')?.value;
        const parsedDate = parseDateTimeLocal(rawDate);
        const minAmount = Number(document.getElementById('spMinAmount')?.value) || 0;
        const mainText = document.getElementById('spMainText')?.value?.trim();
        const exclusiveLabel = document.getElementById('spExclusiveLabel')?.value?.trim();

        const payload = {
          enabled,
          endDate: parsedDate ? parsedDate.toISOString() : null,
          minAmount,
          mainText,
          exclusiveLabel,
          subText: `Envíos por compras a partir de <strong>$${minAmount.toLocaleString('es-AR')}</strong>.`,
        };

        const res = await window.auth.apiFetch(this.apiSaveUrl, {
          method: 'PUT',
          body: payload,
        });

        if (res && res.ok) {
          this.config = res.data;
          this.showFeedback('✅ Configuración del contador guardada exitosamente. La tienda ya está actualizada.', 'success');
          // Actualizar localStorage si estamos en el mismo dominio
          if (payload.endDate) {
            try { localStorage.setItem('narel_shipping_promo_end_date', payload.endDate); } catch (_) {}
          } else {
            try { localStorage.removeItem('narel_shipping_promo_end_date'); } catch (_) {}
          }
          this.updatePreviewAndStatus();
        } else {
          this.showFeedback(res?.message || 'Error al guardar la configuración', 'error');
        }
      } catch (err) {
        this.showFeedback('Error de red al guardar los cambios', 'error');
      } finally {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.textContent = '💾 GUARDAR CAMBIOS';
        }
      }
    }

    showFeedback(text, type) {
      const fb = document.getElementById('spFeedback');
      if (!fb) return;
      fb.style.display = 'block';
      if (type === 'success') {
        fb.style.background = '#0d2818';
        fb.style.color = '#2ecc71';
        fb.style.border = '1px solid #185028';
      } else {
        fb.style.background = '#300';
        fb.style.color = '#e74c3c';
        fb.style.border = '1px solid #600';
      }
      fb.textContent = text;
      setTimeout(() => {
        if (fb) fb.style.display = 'none';
      }, 6000);
    }
  }

  return ShippingPromoAdmin;
});
