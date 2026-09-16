(function () {
  'use strict';

  let sectionsList = [];
  let pendingDeleteId = null;
  let pendingDeleteSubcatId = null;
  let subcatSlugTouchedManually = false;

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
    // Buscador
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase().trim();
        renderSections(query);
      });
    }

    // Modal Sección
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

    // Botón agregar subcategoría desde el modal de sección
    const modalAddSubcatBtn = document.getElementById('modalAddSubcatBtn');
    if (modalAddSubcatBtn) {
      modalAddSubcatBtn.addEventListener('click', () => {
        const currentCatId = document.getElementById('sectionId').value;
        if (currentCatId) {
          window.openCreateSubcategory(currentCatId);
        }
      });
    }

    // Modal Eliminar Sección
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

    // Modal Crear / Editar Subcategoría
    const subcatModal = document.getElementById('subcatModal');
    const subcatModalCancelBtn = document.getElementById('subcatModalCancelBtn');
    if (subcatModalCancelBtn) {
      subcatModalCancelBtn.addEventListener('click', closeSubcatModal);
    }
    if (subcatModal) {
      subcatModal.addEventListener('click', (e) => {
        if (e.target === subcatModal) closeSubcatModal();
      });
    }

    const subcatNameInput = document.getElementById('subcatName');
    const subcatSlugInput = document.getElementById('subcatSlug');
    const subcatUrlPreview = document.getElementById('subcatUrlPreviewText');

    if (subcatNameInput && subcatSlugInput) {
      subcatNameInput.addEventListener('input', () => {
        if (!subcatSlugTouchedManually) {
          const autoSlug = slugify(subcatNameInput.value);
          subcatSlugInput.value = autoSlug;
          updateSubcatUrlPreview();
        }
      });

      subcatSlugInput.addEventListener('input', () => {
        subcatSlugTouchedManually = true;
        updateSubcatUrlPreview();
      });
    }

    const subcatForm = document.getElementById('subcatForm');
    if (subcatForm) {
      subcatForm.addEventListener('submit', handleSubcatFormSubmit);
    }

    // Modal Eliminar Subcategoría
    const deleteSubcatModal = document.getElementById('deleteSubcatModal');
    const deleteSubcatCancelBtn = document.getElementById('deleteSubcatCancelBtn');
    const deleteSubcatConfirmBtn = document.getElementById('deleteSubcatConfirmBtn');

    if (deleteSubcatCancelBtn) {
      deleteSubcatCancelBtn.addEventListener('click', closeDeleteSubcatModal);
    }
    if (deleteSubcatModal) {
      deleteSubcatModal.addEventListener('click', (e) => {
        if (e.target === deleteSubcatModal) closeDeleteSubcatModal();
      });
    }
    if (deleteSubcatConfirmBtn) {
      deleteSubcatConfirmBtn.addEventListener('click', executeDeleteSubcat);
    }
  }

  function updateSubcatUrlPreview() {
    const previewEl = document.getElementById('subcatUrlPreviewText');
    if (!previewEl) return;
    const catId = document.getElementById('subcatCategoryId').value;
    const parentSec = sectionsList.find((s) => String(s.id) === String(catId));
    const parentSlug = parentSec ? parentSec.slug : 'seccion';
    const subSlug = slugify(document.getElementById('subcatSlug').value) || 'subcategoria';
    previewEl.textContent = `/${parentSlug}/${subSlug}`;
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

      // Si el modal de edición de sección está abierto, actualizar su lista de subcategorías
      const secModal = document.getElementById('sectionModal');
      if (secModal && secModal.style.display === 'flex') {
        const currentSecId = document.getElementById('sectionId').value;
        const currentSec = sectionsList.find((s) => String(s.id) === String(currentSecId));
        if (currentSec) {
          renderModalSubcategories(currentSec);
        }
      }
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
        const subcatMatch = Array.isArray(s.subcategories) && s.subcategories.some(sc => String(sc.name || '').toLowerCase().includes(query) || String(sc.slug || '').toLowerCase().includes(query));
        return nameMatch || slugMatch || subMatch || subcatMatch;
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
            <div class="subcat-list">
              ${subcats.map(sc => `
                <div class="subcat-chip" data-id="${htmlEscape(sc.id)}">
                  <span class="subcat-chip-name" onclick="window.openEditSubcategory('${htmlEscape(sc.id)}')" title="Click para editar subcategoría '${htmlEscape(sc.name)}'">
                    ${htmlEscape(sc.name)} <span style="font-size:10px;opacity:.7;">✎</span>
                  </span>
                  <button type="button" class="subcat-chip-del" onclick="window.confirmDeleteSubcategory('${htmlEscape(sc.id)}')" title="Borrar subcategoría '${htmlEscape(sc.name)}'">×</button>
                </div>
              `).join('')}
              <button type="button" class="subcat-add-btn" onclick="window.openCreateSubcategory('${htmlEscape(sec.id)}')" title="Agregar subcategoría a ${htmlEscape(sec.name)}">
                + Subcat
              </button>
            </div>
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

  function renderModalSubcategories(section) {
    const group = document.getElementById('sectionModalSubcatsGroup');
    const container = document.getElementById('sectionModalSubcatsList');
    if (!group || !container) return;

    if (!section || !section.id) {
      group.style.display = 'none';
      container.innerHTML = '';
      return;
    }

    group.style.display = 'block';
    const subcats = Array.isArray(section.subcategories) ? section.subcategories : [];

    if (!subcats.length) {
      container.innerHTML = '<span style="color:var(--grey);font-size:12px;font-style:italic;">Esta sección todavía no tiene subcategorías.</span>';
      return;
    }

    container.innerHTML = subcats.map((sc) => `
      <div class="subcat-chip" data-id="${htmlEscape(sc.id)}">
        <span class="subcat-chip-name" onclick="window.openEditSubcategory('${htmlEscape(sc.id)}')" title="Click para editar subcategoría '${htmlEscape(sc.name)}'">
          ${htmlEscape(sc.name)} <span style="font-size:10px;opacity:.7;">✎</span>
        </span>
        <button type="button" class="subcat-chip-del" onclick="window.confirmDeleteSubcategory('${htmlEscape(sc.id)}')" title="Borrar subcategoría '${htmlEscape(sc.name)}'">×</button>
      </div>
    `).join('');
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
      renderModalSubcategories(section);
    } else {
      title.textContent = 'Nueva Sección';
      desc.textContent = 'Creá una nueva sección en la tienda con su propia URL y pie de encabezado.';
      idInput.value = '';
      nameInput.value = '';
      slugInput.value = '';
      subtitleInput.value = 'CARGADO DESDE PANEL ADMIN';
      sortOrderInput.value = sectionsList.length + 1;
      if (urlPreview) urlPreview.textContent = '/seccion';
      renderModalSubcategories(null);
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
        res = await window.auth.apiFetch(`/api/admin/categories/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ name, slug, subtitle, sort_order }),
        });
      } else {
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

  // ================= ACCIONES DE SUBCATEGORÍAS =================

  window.openCreateSubcategory = function (categoryId) {
    const sec = sectionsList.find((s) => String(s.id) === String(categoryId));
    if (!sec) return;

    subcatSlugTouchedManually = false;
    const modal = document.getElementById('subcatModal');
    const title = document.getElementById('subcatModalTitle');
    const desc = document.getElementById('subcatModalDesc');
    const idInput = document.getElementById('subcatId');
    const catIdInput = document.getElementById('subcatCategoryId');
    const parentNameEl = document.getElementById('subcatParentSectionName');
    const nameInput = document.getElementById('subcatName');
    const slugInput = document.getElementById('subcatSlug');
    const previewEl = document.getElementById('subcatUrlPreviewText');
    const alertEl = document.getElementById('subcatModalAlert');

    if (alertEl) alertEl.style.display = 'none';
    title.textContent = `Nueva Subcategoría en "${sec.name}"`;
    desc.textContent = `Ingresá el nombre de la subcategoría que se agregará a la sección "${sec.name}".`;
    idInput.value = '';
    catIdInput.value = sec.id;
    parentNameEl.textContent = `${sec.name.toUpperCase()} (/${sec.slug})`;
    nameInput.value = '';
    slugInput.value = '';
    if (previewEl) previewEl.textContent = `/${sec.slug}/subcategoria`;

    if (modal) modal.style.display = 'flex';
    setTimeout(() => { if (nameInput) nameInput.focus(); }, 100);
  };

  window.openEditSubcategory = function (subcatId) {
    let parentSec = null;
    let targetSub = null;

    for (const sec of sectionsList) {
      const found = (sec.subcategories || []).find((sc) => String(sc.id) === String(subcatId));
      if (found) {
        parentSec = sec;
        targetSub = found;
        break;
      }
    }

    if (!targetSub || !parentSec) return;

    subcatSlugTouchedManually = true;
    const modal = document.getElementById('subcatModal');
    const title = document.getElementById('subcatModalTitle');
    const desc = document.getElementById('subcatModalDesc');
    const idInput = document.getElementById('subcatId');
    const catIdInput = document.getElementById('subcatCategoryId');
    const parentNameEl = document.getElementById('subcatParentSectionName');
    const nameInput = document.getElementById('subcatName');
    const slugInput = document.getElementById('subcatSlug');
    const previewEl = document.getElementById('subcatUrlPreviewText');
    const alertEl = document.getElementById('subcatModalAlert');

    if (alertEl) alertEl.style.display = 'none';
    title.textContent = `Editar Subcategoría: ${targetSub.name}`;
    desc.textContent = `Modificá el nombre o identificador de la subcategoría. Los productos asignados se actualizarán automáticamente.`;
    idInput.value = targetSub.id;
    catIdInput.value = parentSec.id;
    parentNameEl.textContent = `${parentSec.name.toUpperCase()} (/${parentSec.slug})`;
    nameInput.value = targetSub.name || '';
    slugInput.value = targetSub.slug || '';
    if (previewEl) previewEl.textContent = `/${parentSec.slug}/${targetSub.slug || 'subcategoria'}`;

    if (modal) modal.style.display = 'flex';
    setTimeout(() => { if (nameInput) nameInput.focus(); }, 100);
  };

  function closeSubcatModal() {
    const modal = document.getElementById('subcatModal');
    if (modal) modal.style.display = 'none';
  }

  async function handleSubcatFormSubmit(e) {
    e.preventDefault();
    const alertEl = document.getElementById('subcatModalAlert');
    const saveBtn = document.getElementById('subcatModalSaveBtn');

    const id = document.getElementById('subcatId').value.trim();
    const categoryId = document.getElementById('subcatCategoryId').value.trim();
    const name = document.getElementById('subcatName').value.trim();
    const slug = slugify(document.getElementById('subcatSlug').value.trim() || name);

    if (!name || name.length < 2) {
      if (alertEl) {
        alertEl.className = 'alert error';
        alertEl.textContent = 'El nombre de la subcategoría debe tener al menos 2 caracteres.';
        alertEl.style.display = 'block';
      }
      return;
    }

    if (!slug) {
      if (alertEl) {
        alertEl.className = 'alert error';
        alertEl.textContent = 'El identificador/URL no es válido.';
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
        // Editar subcategoría
        res = await window.auth.apiFetch(`/api/admin/categories/subcategories/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ name, slug }),
        });
      } else {
        // Crear subcategoría
        res = await window.auth.apiFetch('/api/admin/categories/subcategories', {
          method: 'POST',
          body: JSON.stringify({ category_id: categoryId, name, slug }),
        });
      }

      if (!res || !res.ok) {
        throw new Error(res && res.message ? res.message : 'Error al guardar la subcategoría');
      }

      closeSubcatModal();
      showPageMessage(res.message || 'Subcategoría guardada exitosamente');
      await loadSections();
    } catch (err) {
      if (alertEl) {
        alertEl.className = 'alert error';
        alertEl.textContent = err.message || 'Error al guardar la subcategoría';
        alertEl.style.display = 'block';
      }
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'GUARDAR SUBCATEGORÍA';
      }
    }
  }

  window.confirmDeleteSubcategory = function (subcatId) {
    let parentSec = null;
    let targetSub = null;

    for (const sec of sectionsList) {
      const found = (sec.subcategories || []).find((sc) => String(sc.id) === String(subcatId));
      if (found) {
        parentSec = sec;
        targetSub = found;
        break;
      }
    }

    if (!targetSub || !parentSec) return;

    pendingDeleteSubcatId = subcatId;
    const modal = document.getElementById('deleteSubcatModal');
    const desc = document.getElementById('deleteSubcatText');
    if (desc) {
      desc.textContent = `¿Estás seguro de que deseas eliminar la subcategoría "${targetSub.name}" de la sección "${parentSec.name}"?`;
    }
    if (modal) modal.style.display = 'flex';
  };

  function closeDeleteSubcatModal() {
    pendingDeleteSubcatId = null;
    const modal = document.getElementById('deleteSubcatModal');
    if (modal) modal.style.display = 'none';
  }

  async function executeDeleteSubcat() {
    if (!pendingDeleteSubcatId) return;

    const confirmBtn = document.getElementById('deleteSubcatConfirmBtn');
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'ELIMINANDO...';
    }

    try {
      const res = await window.auth.apiFetch(`/api/admin/categories/subcategories/${pendingDeleteSubcatId}`, {
        method: 'DELETE',
      });

      if (!res || !res.ok) {
        throw new Error(res && res.message ? res.message : 'Error al eliminar la subcategoría');
      }

      closeDeleteSubcatModal();
      showPageMessage(res.message || 'Subcategoría eliminada exitosamente');
      await loadSections();
    } catch (err) {
      alert(`Error al eliminar subcategoría: ${err.message}`);
    } finally {
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'ELIMINAR SUBCATEGORÍA';
      }
    }
  }
})();
