# Sistema Auth + Admin Supabase - Implementation Plan

## Task 1: Setup inicial de Supabase en el proyecto (instalar SDK + vars de entorno)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - Instalar `@supabase/supabase-js` vía npm.
  - Crear servicio `src/services/supabase.service.js` singleton admin (service role) para server, con tipado simple de exports.
  - Actualizar `.env.example` agregando: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET=product-images`, `JWT_SECRET` (o usar SUPABASE_JWT).
  - Actualizar `src/config/env.js` para cargar las nuevas variables.
- **Acceptance Criteria Addressed**: NFR-1, NFR-5, AC-8
- **Test Requirements**:
  - `rule` TR-1.1: Importar supabase service, `getServiceSupabase()` retorna cliente no null; conexión exitosa a Supabase `auth.getSession()` retorna sin errores (network ok). Evidence: Ejecutar `node -e "require('./src/services/supabase.service').testConnect()"` → `ok`.
  - `rule` TR-1.2: Archivo `.env.example` contiene SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_STORAGE_BUCKET. Evidence: `grep` sobre el archivo.
  - `rule` TR-1.3: No hay supabase keys hardcodeadas en `*.js` del cliente. Evidence: `ripgrep` por `sb-service` en `public/**/*.js`.

## Task 2: Generar SQL completo de migración Supabase (tablas + RLS + triggers + Storage)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - Crear carpeta `supabase/migrations/` y archivo `001_init_auth_profiles_products_sessions.sql` con:
    1. `profiles` (UUID PK → auth.users, first/last name, email, role default 'user', created_at).
    2. Trigger automático al insertar en auth.users → crea fila en profiles (función PL/pgSQL + trigger).
    3. `products` (UUID PK gen_random_uuid, name, desc, price numeric, sizes text/array, stock int, image_url, timestamps).
    4. `user_sessions` (UUID PK, user_id FK profiles, session_id único, created_at, last_seen, invalidated_at, active boolean, user_agent, ip).
    5. Índices: `user_sessions(user_id, active)`, `products(active_admin_stuff)`.
    6. Enable RLS en `profiles`, `products`, `user_sessions`.
    7. Políticas RLS:
       - profiles: select propio usuario, admins select all; update solo propio; insert solo from service_role/trigger.
       - products: select public/authenticated; insert/update/delete SOLO role='admin'.
       - user_sessions: CRUD solo el user_id dueño; invalidaciones via service_role trigger.
    8. Storage: instrucciones para crear bucket `product-images`, políticas read public, write solo admins.
  - Adjuntar SQL "promover primer admin" (`UPDATE profiles SET role='admin' WHERE email='x@x';`)
- **Acceptance Criteria Addressed**: FR-1, FR-4, FR-7, FR-8, FR-10, FR-11, AC-1, AC-2, AC-3
- **Test Requirements**:
  - `rule` TR-2.1: SQL corre sin errores en Supabase SQL Editor; tablas aparecen en "Table Editor". Evidence: Capturas o salida SQL Editor (usuario ejecuta).
  - `rule` TR-2.2: Usuario recién creado por signup crea fila profiles automática (test signup luego `SELECT * FROM profiles WHERE email=...`). Evidence: fila existe, role='user'.
  - `rule` TR-2.3: Usuario NO admin intenta INSERT products → RLS bloquea. Evidence: Error Supabase/403.
  - `rule` TR-2.4: Triger de invalidación de sesión al insertar user_sessions invalida anteriores (misma FK user_id). Evidence: active=false + invalidated_at en filas viejas.

## Task 3: Backend - Supabase server-side utilities (sesión única, validación, logout)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 2
- **Description**:
  - `src/services/session.service.js`: createSession(userId, ua, ip) → crea en user_sessions + invalida antiguas (update set active=false where user_id=X).
  - validateSession(userId, sessionId) → revisa user_sessions active=true y no expired (last_seen + 7d).
  - touchSession(sessionId) → actualiza last_seen (middleware ligero).
  - logoutSession(sessionId) → active=false, invalidated_at now.
  - Util para extraer user_id y session desde jwt Supabase o cookie custom (mejor cookie httpOnly secure para sessionId + JWT Supabase).
- **Acceptance Criteria Addressed**: FR-4, FR-5, AC-2
- **Test Requirements**:
  - `rule` TR-3.1: createSession(id) luego listar user_sessions → 1 sola activa por user; anteriores false. Evidence: query SQL.
  - `rule` TR-3.2: validateSession sobre sesión invalidada → return false. Sesión activa → return true.
  - `rule` TR-3.3: logoutSession invalida; validación posterior falla.

## Task 4: Middleware Express de auth (protectRoute, requireAdmin, validateSession)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 3
- **Description**:
  - Nuevo: `src/middleware/supabaseAuth.js` con:
    - `authenticate(req, res, next)` → lee JWT Supabase (header auth o cookie), valida con supabase admin client, extrae user_id, extrae session_id cookie, llama validateSession. Si falla → 401.
    - `requireAdmin(req, res, next)` → después de authenticate, hace query profiles.role === 'admin'. Si no → 403.
    - `publicOnlyRedirect(req, res, next)` → si session válida, redirect a /dashboard.html.
  - Integrar `touchSession` en el middleware `authenticate` (cada 3 min actualiza last_seen).
- **Acceptance Criteria Addressed**: FR-2, FR-9, FR-10, AC-10
- **Test Requirements**:
  - `rule` TR-4.1: GET /api/admin/products sin token → 401. Con token user no admin → 403. Con admin → 200. Evidence: curl 3 requests.
  - `rule` TR-4.2: Sesión invalidada de Task 3 → pide endpoint protegido → 401.
  - `rubric` TR-4.3: Escalabilidad middleware; scale 0-5 (1 = bloqueante, 3 = ok, 5 = no queries innecesarias, touch con throttle). Threshold: >=4. Evidence: leer código middleware.

## Task 5: Auth REST API endpoints (register, login, logout, forgot, reset)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 4
- **Description**:
  - Archivo nuevo `src/routes/supabase.auth.routes.js` → montado en `/api/auth`.
  - POST `/api/auth/register` (first_name, last_name, email, password). Validar campos; supabase.auth.admin.createUser + signUp? (mejor signup estándar); si ok inserta session; devuelve 201 + redirect URL o token.
  - POST `/api/auth/login` (email, password). supabase signInWithPassword. Si ok: llamar createSession (esto invalida anteriores por Task3). Guardar session cookie HttpOnly secure. Devolver 200 { role, name }.
  - POST `/api/auth/logout` → llama logoutSession + signOut supabase.
  - POST `/api/auth/forgot-password` (email) → resetPasswordForEmail + redirect URL.
  - POST `/api/auth/reset-password` (new_password, confirm, access_token o via url params) → updateUser({password}).
  - GET `/api/auth/me` → res.json perfil logueado (first_name, last_name, role, email).
- **Acceptance Criteria Addressed**: FR-1, FR-2, FR-3, FR-6, FR-17, AC-1, AC-5
- **Test Requirements**:
  - `rule` TR-5.1: Register 400 si falta email/contraseña < 6 chars. Register 201 si completo.
  - `rule` TR-5.2: Login mal credenciales → 401 + msg "Email o contraseña incorrectos". Register duplicado → 409 + "Email ya registrado".
  - `rule` TR-5.3: Login dos dispositivos → primer device /api/auth/me falla (sesión invalidada).
  - `rule` TR-5.4: POST reset-password confirm !== new_password → 400 "Contraseñas no coinciden".

## Task 6: Products Admin REST API CRUD
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 5
- **Description**:
  - Nuevas rutas: `src/routes/supabase.products.routes.js` montadas `/api/admin/products` con `authenticate` + `requireAdmin` MIDDLEWARES ANTES.
  - GET `/api/admin/products` → listado con paginación opcional o limit 100, filtros si.
  - GET `/api/admin/products/:id` → producto por UUID.
  - POST `/api/admin/products` (name, description, price, sizes, stock, image_url) → validaciones (price > 0, stock >= 0, name no empty). Insert via service role o directo (RLS ya protege).
  - PUT `/api/admin/products/:id` → update, updated_at now().
  - DELETE `/api/admin/products/:id` → confirmación? El backend no lo pide, pero sí el panel; backend devuelve 200 o 404.
- **Acceptance Criteria Addressed**: FR-11, FR-12, FR-9, AC-3, AC-10
- **Test Requirements**:
  - `rule` TR-6.1: Con credenciales user al POST /api/admin/products → 403.
  - `rule` TR-6.2: Crear, editar, borrar producto OK → 200/201 con JSON.
  - `rule` TR-6.3: GET `/api/admin/products` devuelve array con `id, name, price, stock, image_url`.

## Task 7: Integration Supabase Storage (Product images)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 6
- **Description**:
  - Nuevo servicio `src/services/supabase.storage.service.js` (uploadProductImage, deleteProductImage, getPublicUrl).
  - Multer o express-fileupload para recibir multipart/form-data. Validar: mimetype jpg|jpeg|png|webp y tamaño <= 5MB.
  - POST `/api/admin/products/upload-image` → recibe file, valida → subir a Supabase Storage bucket `product-images` (carpeta `products/<uuid>/`) → devolver URL pública.
  - DELETE opcional: `DELETE /api/admin/products/:id/image` → borra de storage + update set image_url=null en producto.
  - En PUT edit producto: permitir reemplazar imagen (borrar vieja si existiera).
- **Acceptance Criteria Addressed**: FR-13, FR-14, FR-15, AC-4, NFR-1
- **Test Requirements**:
  - `rule` TR-7.1: Subir .exe o .php → 400 "Formato no permitido". Subir >5MB → 413/400 "Archivo muy grande".
  - `rule` TR-7.2: Upload exitoso → URL pública abre la imagen correctamente en navegador.
  - `rule` TR-7.3: Storage bucket listar objetos → archivo existe en ruta correcta.

## Task 8: Páginas públicas de auth HTML vanilla (login, register, forgot, reset, dashboard)
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 7
- **Description**:
  - Crear `public/login.html` + `public/assets/js/auth/login.js`
  - Crear `public/register.html` + `public/assets/js/auth/register.js`
  - Crear `public/forgot-password.html` + `public/assets/js/auth/forgot.js`
  - Crear `public/reset-password.html` + `public/assets/js/auth/reset.js` (lee token de URL params o usa cookie)
  - Crear `public/dashboard.html` + `public/assets/js/dashboard.js` (bienvenida, nombre usuario, si role admin muestra link al panel; si no oculta).
  - Reutilizar diseño: monocromo B/N/gris (mismo var CSS, paleta actual de la tienda). Tipografías: Bebas Neue, Oswald, Cinzel (mantener consistencia con design system existente, sin romper).
  - Todas responsive mobile-first. Validaciones cliente side + mensajes toast/alertas.
- **Acceptance Criteria Addressed**: FR-16, FR-17, AC-7, AC-9
- **Test Requirements**:
  - `rule` TR-8.1: Cada página carga sin errores JS. Evidence: consola browser.
  - `rule` TR-8.2: Validaciones front: contraseñas no coinciden muestra error, email formato inválido muestra error.
  - `rubric` TR-8.3: Responsive en 375px/768px/1280px (escala 0-5; threshold >= 4). Evidence: screenshots.
  - `rubric` TR-8.4: Mensajes de error (escala 0-5; threshold >= 4). Evidence: lista de errores humanos.

## Task 9: Panel de Admin HTML vanilla (dashboard + products CRUD + forms)
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 8
- **Description**:
  - `public/admin/dashboard.html` (principal) → stats cards (total products, total stock, sin stock). Links a productos / nuevo producto.
  - `public/admin/products.html` → tabla de productos: foto mini, name, price, stock, actions (Editar, Eliminar modal confirm).
  - `public/admin/product-new.html` → form crear con input file, drag drop opcional.
  - `public/admin/product-edit.html` → carga datos actuales por ?id=uuid, reemplazo imagen.
  - Archivos JS por página en `public/assets/js/admin/`.
  - Script `redirectIfNotAdmin.js` incluido en todas las admin.html: si /api/auth/me devuelve role!=admin → redirect a /login.html?next=...
  - Paleta y tipografía igual al resto. Diseño limpio, tablas zebra, botones con mismo estilo de la tienda (.button primary/secondary).
- **Acceptance Criteria Addressed**: FR-9, FR-12, FR-16, AC-4, AC-6
- **Test Requirements**:
  - `rule` TR-9.1: Usuario normal intenta abrir /admin/dashboard.html → redirect a login.
  - `rule` TR-9.2: Admin crea producto con imagen OK → aparece en listado; click Editar cambia el nombre; click Eliminar + confirmar desaparece.
  - `rule` TR-9.3: Stats del dashboard (total productos, stock) match COUNT/SUM SQL.
  - `rubric` TR-9.4: Calidad responsive móvil (escala 0-5; threshold >= 4).

## Task 10: Cliente Supabase (browser) y protección de rutas
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 9
- **Description**:
  - Utilidad `public/assets/js/supabaseClient.js` (SÓLO ANON_KEY, NUNCA SERVICE ROLE). Inicializa `window.supabaseClient = createClient(url, anonKey)`.
  - Helper `authGuard.js` incluido en dashboard y admin: on DOMContentLoaded llama GET /api/auth/me. Si 401 → redirect a login; si admin page pero role no admin → redirect dashboard.
  - Nota: NO usamos supabase client browser como fuente de "verdadero auth", sino el backend `/api/auth/me` (que valida sesión activa en user_sessions).
- **Acceptance Criteria Addressed**: FR-2, FR-3, FR-9, FR-10, NFR-1, AC-8
- **Test Requirements**:
  - `rule` TR-10.1: Cliente browser NO contiene ninguna service role key. Evidence: ripgrep por service- / sb-service-.
  - `rule` TR-10.2: Sesión invalidada server-side → página dashboard redirige al login en menos de 2 segundos al intentar cualquier acción.

## Task 11: Integración final server.js (rutas, archivos estáticos, no romper la tienda)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 10
- **Description**:
  - Importar las nuevas rutas en `src/server.js` al final de las rutas existentes:
    ```
    app.use('/api/auth', supabaseAuthRoutes)
    app.use('/api/admin/products', supabaseProductsRoutes)
    // NOTA: las rutas public/ se sirven por express.static existente.
    ```
  - Asegurarse de que `/plantilla-1.html` se sigue sirviendo 200.
  - Opcional: redirect `/` → `/plantilla-1.html` (mantener comportamiento actual).
  - JSON body + multer fileupload correctamente configurados límite tamaño.
- **Acceptance Criteria Addressed**: NFR-4, AC-6, AC-10
- **Test Requirements**:
  - `rule` TR-11.1: GET /plantilla-1.html → status 200. `diff` hash con el original pre-cambios = IDÉNTICO (ninguna línea cambiada).
  - `rule` TR-11.2: Rutas nuevas responden: POST /api/auth/login, GET /api/auth/me, GET /api/admin/products.
  - `rule` TR-11.3: Las rutas antiguas (demo-cliente, admin/login.html viejo si es que no se reemplaza, assets, etc) siguen sirviendo 404 o 200 según correspondían (no crash server).

## Task 12: Documentación final (archivos a configurar en Supabase, pasos, crear primer admin, testing checklist)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 11
- **Description**:
  - Archivo final `SUPABASE_SETUP.md` al final del proyecto (user lo pidió en la sección 13 del documento): tablas, RLS, storage, redirect URLs, variables de entorno, cómo ejecutar SQL en SQL Editor.
  - Checklist testing final (10 puntos exactos del requirement).
  - Explicación paso a paso para crear primer admin.
- **Acceptance Criteria Addressed**: (resumen final pedido por user)
- **Test Requirements**:
  - `rule` TR-12.1: SUPABASE_SETUP.md contiene lista de: Archivos creados/modificados, SQL, Config Supabase (Auth redirect URLs: http://localhost:3000/reset-password.html, http://localhost:3000/dashboard.html), Storage bucket name, Variables .env, Cómo crear primer admin.
  - `rule` TR-12.2: El checklist de 10 puntos final existe completo.
