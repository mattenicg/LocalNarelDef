(function () {
  'use strict';

  let sectionsList = [];
  let pendingDeleteId = null;

  window.addEventListener('DOMContentLoaded', init);

  async function init() {
    const user = await window.auth.requireAuth({ requireAdmin: true });
    if (!user) return;

    bindEvents();
    await loadSections();
  }

  function slugify(text) {
    return String(text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function htmlEscape(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function showPageMessage(text, isError = false) {
    const el = document.getElementById('pageMessage');
    if (!el) return;
    el.innerHTML = `
      <div class="alert ${isError ? 'error' : 'success'}" style="margin-bottom:16px;">
        ${htmlEscape(text)}
      </div>
    `;
    setTimeout(() => {
      if (el.innerHTML.includes(htmlEscape(text))) {
        el.innerHTML = '';
      }
    }, 6000);
  }

  function bindEvents() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase().trim();
        renderSections(query);
      });
    }

    const btnOpenCreate = document.getElementById('btnOpenCreateSection');
    if (btnOpenCreate) {
      btnOpenCreate.addEventListener('click', () => openSectionModal(null));
    }

    const sectionModal = document.getElementById('sectionModal');
    const sectionModalCancelBtn = document.getElementById('sectionModalCancelBtn');
    if (sectionModalCancelBtn) {
      sectionModalCancelBtn.addEventListener('click', closeSectionModal);
    }
    if (sectionModal) {
      sectionModal.addEventListener('click', (e) => {
        if (e.target === sectionModal) closeSectionModal();
      });
    }

    const sectionNameInput = document.getElementById('sectionName');
    const sectionSlugInput = document.getElementById('sectionSlug');
    const urlPreviewText = document.getElementById('urlPreviewText');

    let slugTouchedManually = false;
    if (sectionNameInput && sectionSlugInput) {
      sectionNameInput.addEventListener('input', () => {
        if (!slugTouchedManually) {
          const autoSlug = slugify(sectionNameInput.value);
          sectionSlugInput.value = autoSlug;
          if (urlPreviewText) {
            urlPreviewText.textContent = `/${autoSlug || 'seccion'}`;
          }
        }
      });

      sectionSlugInput.addEventListener('input', () => {
        slugTouchedManually = true;
        const s = slugify(sectionSlugInput.value);
        if (urlPreviewText) {
          urlPreviewText.textContent = `/${s || 'seccion'}`;
        }
      });
    }

    const sectionForm = document.getElementById('sectionForm');
    if (sectionForm) {
      sectionForm.addEventListener('submit', handleFormSubmit);
    }

    const deleteModal = document.getElementById('deleteModal');
    const deleteCancelBtn = document.getElementById('deleteCancelBtn');
    const deleteConfirmBtn = document.getElementById('deleteConfirmBtn');

    if (deleteCancelBtn) {
      deleteCancelBtn.addEventListener('click', closeDeleteModal);
    }
    if (deleteModal) {
      deleteModal.addEventListener('click', (e) => {
        if (e.target === deleteModal) closeDeleteModal();
      });
    }
    if (deleteConfirmBtn) {
      deleteConfirmBtn.addEventListener('click', executeDelete);
    }
  }

  async function loadSections() {
    const tbody = document.getElementById('sectionsTbody');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--grey);font-family:\'DM Mono\',monospace;">Cargando secciones...</td></tr>';
    }

    try {
      const res = await window.auth.apiFetch('/api/admin/categories');
      if (!res || !res.ok) {
        throw new Error(res && res.message ? res.message : 'Error al cargar secciones');
      }

      sectionsList = Array.isArray(res.data) ? res.data : [];
      renderSections();
    } catch (err) {
      console.error('[sections] error:', err);
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:#f87171;">Error al cargar secciones: ${htmlEscape(err.message)}</td></tr>`;
      }
    }
  }

  function renderSections(query = '') {
    const tbody = document.getElementById('sectionsTbody');
    if (!tbody) return;

    let filtered = sectionsList;
    if (query) {
      filtered = sectionsList.filter((s) => {
        const nameMatch = String(s.name || '').toLowerCase().includes(query);
        const slugMatch = String(s.slug || '').toLowerCase().includes(query);
        const subMatch = String(s.subtitle || '').toLowerCase().includes(query);
        return nameMatch || slugMatch || subMatch;
      });
    }

    if (!filtered.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center;padding:40px;color:var(--grey);font-family:'DM Mono',monospace;">
            ${query ? 'No se encontraron secciones para la búsqueda.' : 'No hay secciones creadas todavía.'}
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map((sec, idx) => {
      const rawSub = sec.subtitle && String(sec.subtitle).trim() ? String(sec.subtitle).trim() : 'CARGADO DESDE PANEL ADMIN';
      const isDefault = rawSub === 'CARGADO DESDE PANEL ADMIN';
      const prodCount = Number(sec.products_count) || 0;
      const subcats = Array.isArray(sec.subcategories) ? sec.subcategories : [];
      const order = sec.sort_order !== undefined && sec.sort_order !== null ? sec.sort_order : (idx + 1);

      return `
        <tr data-id="${htmlEscape(sec.id)}">
          <td style="text-align:center;font-family:'DM Mono',monospace;color:var(--grey);">
            ${order}
          </td>
          <td>
            <strong style="font-size:15px;color:#fff;letter-spacing:.05em;">
              ${htmlEscape(sec.name)}
            </strong>
          </td>
          <td>
            <a href="/${htmlEscape(sec.slug)}" target="_blank" class="url-preview-pill" title="Abrir página de la sección en la tienda">
              <span>/${htmlEscape(sec.slug)}</span>
              <span style="font-size:10px;">↗</span>
            </a>
          </td>
          <td>
            <span class="subtitle-badge">
              ${htmlEscape(rawSub)}
            </span>
            ${isDefault ? '<span class="default-tag">(Por defecto)</span>' : '<span class="default-tag" style="color:var(--yellow);">(Personalizado)</span>'}
          </td>
          <td style="text-align:center;">
            <span class="section-badge" style="background:${prodCount > 0 ? 'rgba(255,230,0,0.1)' : 'rgba(255,255,255,0.04)'};color:${prodCount > 0 ? 'var(--yellow)' : 'var(--grey)'};">
              ${prodCount} prod.
            </span>
          </td>
          <td>
            ${subcats.length ? subcats.map(sc => `<span class="section-badge">${htmlEscape(sc.name)}</span>`).join('') : '<span style="color:var(--grey);font-size:11px;font-style:italic;">Sin subcategorías</span>'}
          </td>
          <td style="text-align:right;white-space:nowrap;">
            <button type="button" class="button secondary" style="width:auto;padding:6px 12px;font-size:12px;margin-right:6px;" onclick="window.editSection('${htmlEscape(sec.id)}')">
              EDITAR
            </button>
            <button type="button" class="button secondary" style="width:auto;padding:6px 12px;font-size:12px;color:#f87171;border-color:rgba(248,113,113,0.3);" onclick="window.confirmDeleteSection('${htmlEscape(sec.id)}')">
              BORRAR
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  function openSectionModal(section = null) {
    const modal = document.getElementById('sectionModal');
    const title = document.getElementById('sectionModalTitle');
    const desc = document.getElementById('sectionModalDesc');
    const alertEl = document.getElementById('sectionModalAlert');

    const idInput = document.getElementById('sectionId');
    const nameInput = document.getElementById('sectionName');
    const slugInput = document.getElementById('sectionSlug');
    const subtitleInput = document.getElementById('sectionSubtitle');
    const sortOrderInput = document.getElementById('sectionSortOrder');
    const urlPreview = document.getElementById('urlPreviewText');

    if (alertEl) alertEl.style.display = 'none';

    if (section) {
      title.textContent = `Editar Sección: ${section.name}`;
      desc.textContent = 'Modificá el nombre, la URL asociada o el texto de abajo (subtítulo). Los cambios se sincronizarán con los productos vinculados.';
      idInput.value = section.id;
      nameInput.value = section.name || '';
      slugInput.value = section.slug || '';
      subtitleInput.value = section.subtitle !== undefined ? section.subtitle : 'CARGADO DESDE PANEL ADMIN';
      sortOrderInput.value = section.sort_order || 1;
      if (urlPreview) urlPreview.textContent = `/${section.slug || 'seccion'}`;
    } else {
      title.textContent = 'Nueva Sección';
      desc.textContent = 'Creá una nueva sección en la tienda con su propia URL y pie de encabezado.';
      idInput.value = '';
      nameInput.value = '';
      slugInput.value = '';
      subtitleInput.value = 'CARGADO DESDE PANEL ADMIN';
      sortOrderInput.value = sectionsList.length + 1;
      if (urlPreview) urlPreview.textContent = '/seccion';
    }

    if (modal) modal.style.display = 'flex';
    setTimeout(() => { if (nameInput) nameInput.focus(); }, 100);
  }

  function closeSectionModal() {
    const modal = document.getElementById('sectionModal');
    if (modal) modal.style.display = 'none';
  }

  async function handleFormSubmit(e) {
    e.preventDefault();
    const alertEl = document.getElementById('sectionModalAlert');
    const saveBtn = document.getElementById('sectionModalSaveBtn');

    const id = document.getElementById('sectionId').value.trim();
    const name = document.getElementById('sectionName').value.trim();
    let slug = slugify(document.getElementById('sectionSlug').value.trim() || name);
    const subtitle = document.getElementById('sectionSubtitle').value.trim() || 'CARGADO DESDE PANEL ADMIN';
    const sort_order = Number(document.getElementById('sectionSortOrder').value) || (sectionsList.length + 1);

    if (!name || name.length < 2) {
      if (alertEl) {
        alertEl.className = 'alert error';
        alertEl.textContent = 'El nombre de la sección debe tener al menos 2 caracteres.';
        alertEl.style.display = 'block';
      }
      return;
    }

    if (!slug) {
      if (alertEl) {
        alertEl.className = 'alert error';
        alertEl.textContent = 'La URL o identificador no es válido.';
        alertEl.style.display = 'block';
      }
      return;
    }

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'GUARDANDO...';
    }

    try {
      let res;
      if (id) {
        // Edit existing section
        res = await window.auth.apiFetch(`/api/admin/categories/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ name, slug, subtitle, sort_order }),
        });
      } else {
        // Create new section
        res = await window.auth.apiFetch('/api/admin/categories', {
          method: 'POST',
          body: JSON.stringify({ name, slug, subtitle, sort_order }),
        });
      }

      if (!res || !res.ok) {
        throw new Error(res && res.message ? res.message : 'Error al guardar la sección');
      }

      closeSectionModal();
      showPageMessage(res.message || 'Sección guardada exitosamente');
      await loadSections();
    } catch (err) {
      if (alertEl) {
        alertEl.className = 'alert error';
        alertEl.textContent = err.message || 'Error al guardar la sección';
        alertEl.style.display = 'block';
      }
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'GUARDAR SECCIÓN';
      }
    }
  }

  window.editSection = function (id) {
    const sec = sectionsList.find((s) => String(s.id) === String(id));
    if (sec) {
      openSectionModal(sec);
    }
  };

  window.confirmDeleteSection = function (id) {
    const sec = sectionsList.find((s) => String(s.id) === String(id));
    if (!sec) return;

    pendingDeleteId = id;
    const modal = document.getElementById('deleteModal');
    const desc = document.getElementById('deleteModalText');
    if (desc) {
      desc.textContent = `¿Estás seguro de que deseas eliminar la sección "${sec.name}" (URL: /${sec.slug})?`;
    }
    if (modal) modal.style.display = 'flex';
  };

  function closeDeleteModal() {
    pendingDeleteId = null;
    const modal = document.getElementById('deleteModal');
    if (modal) modal.style.display = 'none';
  }

  async function executeDelete() {
    if (!pendingDeleteId) return;

    const confirmBtn = document.getElementById('deleteConfirmBtn');
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'ELIMINANDO...';
    }

    try {
      const res = await window.auth.apiFetch(`/api/admin/categories/${pendingDeleteId}`, {
        method: 'DELETE',
      });

      if (!res || !res.ok) {
        throw new Error(res && res.message ? res.message : 'Error al eliminar la sección');
      }

      closeDeleteModal();
      showPageMessage(res.message || 'Sección eliminada exitosamente');
      await loadSections();
    } catch (err) {
      alert(`Error al eliminar: ${err.message}`);
    } finally {
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'ELIMINAR SECCIÓN';
      }
    }
  }
})();
