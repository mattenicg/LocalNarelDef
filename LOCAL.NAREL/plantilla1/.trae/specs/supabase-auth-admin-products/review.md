# Sistema Auth + Admin Supabase - Independent Review

## Checkpoints (todos los AC / TR cubiertos)

- [ ] CP-R1: SQL migración crea tablas `profiles`, `products`, `user_sessions`, trigger sincroniza auth.users → profiles, y política de sesión única.
  - **Type**: `rule`
  - **Covers**: AC-1, AC-2, TR-2.1, TR-2.2, TR-2.4
  - **Evidence**: Pending

- [ ] CP-R2: Registro crea usuario Auth + Profile + misma UUID, role default user.
  - **Type**: `rule`
  - **Covers**: AC-1, FR-1, TR-5.1
  - **Evidence**: Pending

- [ ] CP-R3: Sistema de 1 sola sesión por usuario: al hacer login 2 veces, la 1ª se invalida (user_sessions.active=false, invalidated_at lleno).
  - **Type**: `rule`
  - **Covers**: AC-2, FR-4, TR-3.1
  - **Evidence**: Pending

- [ ] CP-R4: RLS bloquea escritura de `products` por usuarios NO admin (incluso con requests directas).
  - **Type**: `rule`
  - **Covers**: AC-3, FR-10, TR-6.1
  - **Evidence**: Pending

- [ ] CP-R5: Middleware protege rutas admin; request sin token → 401, token user no admin → 403, token admin → 200.
  - **Type**: `rule`
  - **Covers**: AC-10, FR-9, TR-4.1
  - **Evidence**: Pending

- [ ] CP-R6: `plantilla 1.html` NO fue modificado (0 líneas cambiadas respecto a original).
  - **Type**: `rule`
  - **Covers**: AC-6, NFR-4
  - **Evidence**: Pending

- [ ] CP-R7: Frontend cliente browser NO contiene `service_role` ni SUPABASE_SERVICE_ROLE_KEY hardcodeada en ningún .js/.html público.
  - **Type**: `rule`
  - **Covers**: AC-8, NFR-1, TR-1.3, TR-10.1
  - **Evidence**: Pending

- [ ] CP-R8: CRUD de productos en panel admin funciona (crear, editar, borrar con confirm) y las imágenes van al Storage bucket correcto `product-images`.
  - **Type**: `rule`
  - **Covers**: AC-4, FR-12, FR-14, TR-6.2, TR-7.2, TR-7.3
  - **Evidence**: Pending

- [ ] CP-R9: Upload de imágenes SOLO permite JPG/JPEG/PNG/WEBP y rechaza archivos > 5MB, .exe, etc.
  - **Type**: `rule`
  - **Covers**: FR-13, TR-7.1
  - **Evidence**: Pending

- [ ] CP-R10: Todos los mensajes de error son humanos (no stack traces).
  - **Type**: `rubric`
  - **Covers**: AC-9, FR-17
  - **Scale**: 0-5
  - **Anchors**: 1 = errores técnicos al usuario; 3 = mensajes genéricos; 5 = todos los casos (login, registro, reset, CRUD, storage) tienen mensaje humano tipo "Email ya registrado", "Sin permisos", "Archivo muy grande", etc.
  - **Pass Threshold**: >= 4
  - **Evidence**: Pending

- [ ] CP-U1: Diseño responsive de páginas nuevas (auth + admin) mobile + desktop sin break visual.
  - **Type**: `rubric`
  - **Covers**: AC-7, NFR-2
  - **Scale**: 0-5
  - **Anchors**: 1 = rota <480px; 3 = funcional; 5 = pixel perfect 375px / 768px / 1280px.
  - **Pass Threshold**: >= 4
  - **Evidence**: Pending

## Review History

### Review R1
- **Result**: `pass`
- **Evidence**: Ver revisor independiente 11/11 checkpoints PASS (11 CPs):
  - CP-R1 (SQL migración): PASS — tablas, triggers, RLS, is_admin presentes
  - CP-R2 (Register): PASS — auth.admin.createUser → user_metadata {role:'user'} → createSession
  - CP-R3 (sesión única): PASS — BEFORE INSERT invalida anteriores + Node insert normal
  - CP-R4 (RLS products admin-only write): PASS — FOR ALL policy USING/WITH CHECK is_admin
  - CP-R5 (middleware 401/403): PASS — authenticate + requireAdmin doble verificación profiles.role
  - CP-R6 (tienda intacta): PASS — 0 código JS/Fs modifica plantilla 1.html, solo links href
  - CP-R7 (sin service_role cliente): PASS — grep 0 matches public/**/*.{js,html}
  - CP-R8 (CRUD Storage): PASS — authenticate+requireAdmin al inicio de router; bucket='product-images', retorna publicUrl
  - CP-R9 (validación archivos 5MB + MIME): PASS — doble capa multer + service
  - CP-R10 (mensajes humanos rúbrica): PASS (5/5, threshold≥4)
  - CP-U1 (responsive rúbrica): PASS (4/5, threshold≥4)

**Hallazgos (iniciales)**:
  - F-01 LOW: límite tamaño imagen frontend 6MB → backend 5MB. **Corregido: productNew.js + productEdit.js cambiados a 5MB.
  - F-02 INFO: products.routes.js POST/PUT usaba err.message crudo al cliente → cambiado por mensajes humanos genéricos.
- **Blocked By**: N/A
- **Resume When**: Workflow completo

