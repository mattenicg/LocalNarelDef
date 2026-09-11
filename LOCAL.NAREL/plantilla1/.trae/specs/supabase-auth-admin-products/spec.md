# Sistema Auth + Admin Supabase (Narel Local) - Product Requirements Document

## Overview
- **Summary**: Implementar un sistema real de autenticación, gestión de roles, panel de administración y ABM de productos conectado nativamente a Supabase (Auth, PostgreSQL RLS y Storage).
- **Purpose**: Agregar backend seguro, usuarios administradores y stock real al proyecto de tienda, sin romper ni modificar la tienda visual existente.
- **Target Users**: Usuarios registrados (`user`), Administradores de tienda (`admin`).

## Goals
- Implementar registro/login/logout **real** con Supabase Auth (email + contraseña).
- Crear tabla `profiles` sincronizada automáticamente con `auth.users`.
- Implementar **una sola sesión activa por usuario** (invalidación de sesión anterior al loguearse).
- Flujo completo de recuperación/restablecimiento de contraseña vía Supabase.
- Panel `/admin` protegido **tanto en frontend como en PostgreSQL RLS**.
- CRUD completo de productos (`products`) con imágenes almacenadas en **Supabase Storage**.
- Asignación de rol `admin` únicamente desde base de datos (nunca desde frontend).
- Mensajes de error/éxito claros para el usuario final.
- Checklist final de 10 puntos de testing (lo especifica el documento de requerimientos).

## Non-Goals
- ❌ **NO MODIFICAR NADA DEL FRONTEND DE LA TIENDA** (`plantilla 1.html`, estilos CSS, logo extendido, paleta, textos, estructura de categorías). El frontend permanece 100% intacto.
- ❌ No migrar la tienda cliente-side actual (productos harcodeados, carrito JS) para que consuma datos desde Supabase. Eso queda fuera de este scope.
- ❌ No agregar frameworks de frontend (React, Vue, Next, etc). Se mantiene el stack vanilla HTML/JS + Node/Express existente.
- ❌ No implementar pasarelas de pago ni checkout.
- ❌ No usar `localStorage` como mecanismo de sesión válido ni contraseñas en tablas propias.

## Background & Context
- Proyecto actual: SaaS multi-tenant base con Node.js Express, SQLite (sql.js), plantillas HTML en carpeta `public/`.
- Archivo "Nuevo Documento de texto.txt" es la fuente de requerimientos funcional y de seguridad.
- La tienda visual (`plantilla 1.html`) acaba de pasar por un rediseño visual completo (tipografía gótica Cinzel, monocromo B/N/gris, logo NAREL plateado de 100vw de ancho, branding NL) y NO DEBE alterarse.
- Existe un panel admin HTML previo en `public/admin/` (`index.html` + `login.html`) que se reemplazará por las nuevas vistas conectadas a Supabase.
- Dependencia externa CRÍTICA: Proyecto de Supabase del usuario (requiere configuración manual inicial).

## Functional Requirements

### Auth
- **FR-1**: Registro con nombre, apellido, email, contraseña → crea usuario en Supabase Auth + fila en `profiles` (mismo UUID, rol `user` por defecto).
- **FR-2**: Login email/contraseña con validación de campos + mensajes de error.
- **FR-3**: Logout funcional (cerrar sesión Supabase + invalidar sesión custom).
- **FR-4**: Control de UNA SOLA SESIÓN por usuario. Nuevo login invalida cualquier sesión anterior existente.
- **FR-5**: Peticiones a rutas protegidas validan token + sesión activa en tabla `user_sessions`.
- **FR-6**: Flujo "Olvidé mi contraseña" (petición → email Supabase) + "Restablecer contraseña" (token válido + confirmación).

### Roles & Seguridad
- **FR-7**: Roles posibles: `user` (default) y `admin`.
- **FR-8**: Rol asignable **solo desde Supabase/PostgreSQL**. Ningún endpoint ni script del cliente puede promover un usuario a admin.
- **FR-9**: Ruta `/admin*` y endpoints de administración inaccesibles para usuarios `user` o invitados, incluso con requests directos (validación doble: middleware + RLS).
- **FR-10**: RLS (Row Level Security) activado en tablas: `profiles`, `products`, `user_sessions`. Políticas:
  - `profiles`: cada usuario lee/edita el propio; admins: read all.
  - `products`: lectura pública o de usuarios autenticados; write (INSERT/UPDATE/DELETE) solo admins.
  - `user_sessions`: solo el propio usuario (o auth trigger) puede escribir/leer sus sesiones.

### Productos & Storage
- **FR-11**: Tabla `products` con: `id (uuid)`, `name`, `description`, `price` (numeric), `sizes` (text/array), `stock` (int), `image_url`, `created_at`, `updated_at`.
- **FR-12**: CRUD productos en panel admin: listar, crear, editar, eliminar (con confirmación).
- **FR-13**: Imágenes de productos se suben a bucket `product-images` de Supabase Storage (formatos JPG/JPEG/PNG/WEBP, límite de tamaño 5MB).
- **FR-14**: Al subir imagen → validar → Storage → guardar URL pública en `products.image_url`.
- **FR-15**: Al editar/eliminar producto con imagen, opción de eliminar la imagen anterior del Storage.

### Interfaz (nuevas páginas, no afectan la tienda)
- **FR-16**: Páginas nuevas en carpeta `public/`:
  - `/login.html` (login)
  - `/register.html` (registro)
  - `/forgot-password.html` (olvide contraseña)
  - `/reset-password.html` (setear nueva pass)
  - `/dashboard.html` (bienvenida usuario logueado)
  - `/admin/index.html` (dashboard admin: stats + atajos)
  - `/admin/products.html` (listado de productos tabla + acciones)
  - `/admin/product-new.html` (form crear producto)
  - `/admin/product-edit.html?id=<uuid>` (form editar producto)

### Manejo de Errores & UX
- **FR-17**: Errores Supabase interceptados → mensajes human-readable (nunca stack traces), ejemplos:
  - "Email o contraseña incorrectos"
  - "El email ya está registrado"
  - "Las contraseñas no coinciden"
  - "No tenés permisos para acceder"
  - "Producto creado correctamente"
  - "Error al subir la imagen"

## Non-Functional Requirements
- **NFR-1 (Seguridad)**: Nunca exponer `service_role key` al cliente. Únicamente `anon/public key` en el navegador. Credenciales en `.env` nunca harcodeadas.
- **NFR-2 (Responsive)**: Todas las páginas nuevas se ven correctamente en móvil, tablet, desktop.
- **NFR-3 (Arquitectura ordenada)**: Separar: páginas HTML públicas, JS de páginas (UI), servicio `supabaseClient` (browser + server), middleware Express de auth/session, SQL de migración.
- **NFR-4 (No romper)**: `plantilla 1.html` y sus rutas (`/plantilla-1.html`, contenido `/assets`) siguen funcionando exactamente igual.
- **NFR-5 (Logging)**: Logs de errores de Supabase por Winston (ya existente), sin exponer datos sensibles.

## Constraints
- **Technical**:
  - Backend de auth debe usar la integración `@supabase/supabase-js` (Node).
  - Cliente de Supabase en navegador: `@supabase/supabase-js` (CDN o build).
  - RLS obligatorio en tablas: Sí, 100% (políticas por rol).
  - Control de sesión única: tabla `user_sessions` en PostgreSQL + triggers/funciones auxiliares.
  - Stack: Mantener Node.js + Express existente; reemplazo de SQLite → Supabase solamente para auth + admin + products (el resto del proyecto existente puede seguir o convivir).
- **Business**:
  - NO modificar el frontend de la tienda actual.
  - Usuario promedio entiende el panel sin instrucciones.
- **Dependencies**:
  - Supabase Auth (email + password).
  - Supabase Storage bucket público o firmado para imágenes.
  - Redirect URLs configuradas en Supabase Auth para login / reset password.
  - Supabase SDK instalado vía npm.

## Assumptions
- El usuario tiene una cuenta Supabase activa y acceso al dashboard de SQL Editor.
- El usuario podrá ejecutar el SQL generado directamente en Supabase.
- El usuario completará manualmente las variables de entorno `.env` con las credenciales.
- El usuario creará el primer `admin` ejecutando un update SQL manual (se proveerá el comando exacto).

## Acceptance Criteria

### AC-1: Registro crea Auth + Profile con UUID sincronizado
- **Type**: `rule`
- **Given**: Formulario de registro completo con datos válidos.
- **When**: Usuario envía el registro.
- **Then**: Existe usuario en `auth.users` + fila en `profiles` con mismo UUID, rol `user`, first_name/last_name/email correctos.
- **Pass Condition**: 2 filas, mismo UUID, perfil completo, rol=user.
- **Evidence**: Query SQL Supabase: `SELECT id, first_name, last_name, email, role FROM profiles LIMIT 1;` y `SELECT id FROM auth.users WHERE id = <profile_id>;` coinciden.

### AC-2: Login invalida sesión anterior (sesión única)
- **Type**: `rule`
- **Given**: Usuario A con sesión activa en Navegador 1.
- **When**: Mismo usuario A inicia sesión en Navegador 2.
- **Then**: Al refrescar Navegador 1 → su sesión ya no es válida, se desloguea automáticamente o le niegan rutas protegidas.
- **Pass Condition**: Tabla `user_sessions` tiene una sola fila activa (la más reciente) por usuario. Otras tienen `invalidated_at` poblado.
- **Evidence**: Query `SELECT user_id, active, invalidated_at FROM user_sessions WHERE user_id = <id>;`

### AC-3: RLS impide que usuario "user" escriba productos
- **Type**: `rule`
- **Given**: Usuario autenticado NO admin (`role='user'`).
- **When**: Intenta un INSERT/UPDATE/DELETE directo contra la tabla `products` por medio del cliente Supabase (anon key).
- **Then**: Operación falla con error de RLS "policy violation".
- **Pass Condition**: Operación retorna error, DB no se modifica.
- **Evidence**: Prueba manual en DevTools o script Supabase anon-client.

### AC-4: Admin CRUD productos con imagen en Storage
- **Type**: `rule`
- **Given**: Usuario `admin` autenticado en `/admin/products/new`.
- **When**: Crea un producto completo con imagen JPEG.
- **Then**: Producto nuevo existe en `products` con `image_url` válida. Imagen existe en bucket `product-images/`.
- **Pass Condition**: Listado `/admin/products.html` muestra el producto y la imagen se abre en navegador.
- **Evidence**: Listado admin + Storage bucket + SQL.

### AC-5: Olvidé contraseña + reset funcionan
- **Type**: `rule`
- **Given**: Usuario registrado.
- **When**: Pide recupero → entra al link del email → ingresa pass nueva + confirmación.
- **Then**: Puede iniciar sesión con la contraseña nueva inmediatamente.
- **Pass Condition**: Login exitoso con la nueva contraseña.
- **Evidence**: Flujo manual completo + login.

### AC-6: Frontend de la tienda INTACTO
- **Type**: `rule`
- **Given**: Archivo `plantilla 1.html` antes de la implementación.
- **When**: Se comparan línea por línea con el archivo después de terminar la implementación (excepto línea de script <script> opcional de Supabase si fuera necesario; por defecto, NINGÚN cambio).
- **Then**: Ceros modificaciones en markup/estilos del frontend de la tienda.
- **Pass Condition**: Hash del archivo o comparación diff vacía.
- **Evidence**: diff `plantilla 1.html` pre/post.

### AC-7: Frontend responsive (páginas nuevas)
- **Type**: `rubric`
- **Dimension**: Adaptabilidad mobile-first + desktop.
- **Scale**: 0-5
- **Anchors**: 1 = layout roto < 480px; 3 = usable desktop / regular mobile; 5 = pixel-perfect en 375px, 768px, 1280px, sin scrolls horizontales.
- **Pass Threshold**: >= 4
- **Evidence**: Screenshots en 3 tamaños.

### AC-8: Seguridad general (sin secretos en cliente)
- **Type**: `rule`
- **Given**: Todo el código JS enviado al navegador.
- **When**: Búsqueda textual de `service_role`, `service-role`, o un SK comienza con `sb-` tipo service.
- **Then**: Ninguna ocurrencia.
- **Pass Condition**: 0 matches.
- **Evidence**: grep/ripgrep.

### AC-9: Mensajes de error claros al usuario
- **Type**: `rubric`
- **Dimension**: Calidad UX de mensajes.
- **Scale**: 0-5
- **Anchors**: 1 = errores técnicos crudos (ej: `invalid JWT`); 3 = mensaje genérico "Error"; 5 = mensajes humanos: "Email ya registrado", "Contraseña muy corta", "Sin permisos".
- **Pass Threshold**: >= 4
- **Evidence**: Lista casos y mensajes.

### AC-10: Endpoints protegidos por middleware
- **Type**: `rule`
- **Given**: Request sin sesión válida contra `/api/admin/products`.
- **When**: GET/POST/PUT/DELETE.
- **Then**: 401 / 403 (según corresponda) y sin datos.
- **Pass Condition**: Status code correcto y JSON de error.
- **Evidence**: curl test sin cookie/token.

## Open Questions
- [x] ¿Qué stack de páginas usar? → Vanilla HTML + JS sin frameworks (resuelto por constraint de no romper).
- [x] ¿Login con Google/Facebook? → No, solo email + password por el documento.
- [ ] ¿Los productos creados en Admin tienen que visualizarse automáticamente en `plantilla 1.html` reemplazando los productos hardcodeados? → Documento no lo pide, se deja fuera de scope (non-goal). Si el usuario confirma más adelante, se hace aparte.
- [x] ¿Storage bucket público o URLs firmadas? → Público de lectura, escritura solo admins (RLS) para simplicidad; alternativa técnica correcta si hubiera imágenes privadas.
