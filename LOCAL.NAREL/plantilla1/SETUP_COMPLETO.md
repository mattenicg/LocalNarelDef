# 🚀 GUÍA COMPLETA: 5 PASOS CRÍTICOS PARA ACTIVAR EL PROYECTO

## ✅ PASO 1: INSTALAR NODE.JS Y DEPENDENCIAS

### 1.1 Descargar e instalar Node.js (si no lo tienes)
1. Ir a: https://nodejs.org/
2. Descargar **LTS (versión recomendada)** - ej. v20.x o superior
3. Ejecutar instalador `.msi`
4. Aceptar todas las opciones por defecto
5. **IMPORTANTE:** Reiniciar la computadora después de instalar

### 1.2 Verificar la instalación
Abrir **PowerShell** y ejecutar:
```powershell
node --version
npm --version
```
Deberías ver algo como:
```
v20.11.0
10.2.4
```

### 1.3 Ejecutar npm install
En PowerShell, ir a la carpeta del proyecto y ejecutar:
```powershell
cd "d:\Matte\WEBS VENTAS\Plantilla.ropa\plantilla 1"
npm install
```

**Esto tardará 2-5 minutos.** Espera a que termine sin interrumpir.

Cuando termine deberías ver:
```
added 250+ packages
```

---

## ✅ PASO 2: EJECUTAR MIGRACIONES SQL EN SUPABASE

### 2.1 Acceder a Supabase SQL Editor
1. Ir a: https://supabase.com/dashboard
2. Seleccionar tu proyecto (ej. "Plantilla Ropa")
3. Click en **"SQL Editor"** (lado izquierdo)
4. Click en **"New query"** (botón azul arriba)

### 2.2 Ejecutar Migración 001 (TABLAS PRINCIPALES)
1. En el archivo: `supabase/migrations/001_init_auth_profiles_products_sessions.sql`
2. **Copiar COMPLETO el contenido** (Ctrl+A → Ctrl+C)
3. Pegar en el SQL Editor de Supabase
4. Click **"RUN"** (esquina inferior derecha)
5. Esperar hasta que diga **"Query successful"** ✅

**Qué se crea:**
- Tabla `profiles` (usuarios con roles)
- Tabla `products` (catálogo)
- Tabla `sessions` (sesiones activas)
- Políticas de seguridad (RLS)
- Triggers automáticos

### 2.3 Ejecutar Migración 002 (CATEGORÍAS)
1. Repetir proceso con `supabase/migrations/002_add_category_active_featured_to_products.sql`
2. Click **"New query"**
3. Copiar + Pegar
4. Click **"RUN"**

**Qué se agrega:**
- Columna `category` en productos
- Columna `is_active` (visibilidad)
- Columna `is_featured` (destacados)

### 2.4 Ejecutar Migración 003 (BANNERS)
1. Archivo: `supabase/migrations/003_create_promo_banners.sql`
2. Repetir proceso (New query → Copy → Paste → RUN)

**Qué se crea:**
- Tabla `promo_banners` para imágenes promocionales

### 2.5 Ejecutar Migración 004 (PROMOCIONES)
1. Archivo: `supabase/migrations/004_create_promotions.sql`
2. Repetir proceso

**Qué se crea:**
- Tabla `promotions` (promociones/ofertas)
- Tabla `promotion_items` (productos en promo)

### 2.5 Migración 005 (PEDIDOS Y STOCK)
1. Ejecutar `supabase/migrations/005_create_orders_and_stock.sql` después de las migraciones 001-004.
2. Esta migración crea pedidos, items, movimientos de stock y funciones transaccionales para el checkout.
3. Sin esta migración, el catálogo funciona pero `POST /api/orders` responderá que el servicio no está preparado.

### 2.6 Migración 006 (SEGURIDAD DE REGISTRO)
1. Ejecutar `supabase/migrations/006_harden_auth_trigger.sql` después de la 005.
2. Esta migración fuerza que cada usuario nuevo nazca con rol `user`, aunque alguien manipule el metadata del registro.

**IMPORTANTE:** Si ves errores durante las migraciones:
- ❌ "relation X already exists" → Significa que ya corriste la migración. Ignora y continúa.
- ❌ "permission denied" → El usuario Supabase no tiene permisos. Contacta a Supabase support.

---

## ✅ PASO 3: CREAR STORAGE BUCKET

### 3.1 Crear bucket "product-images"
1. En Supabase Dashboard → Click **"Storage"** (lado izquierdo)
2. Click **"New bucket"** (botón azul)
3. Nombre: `product-images` (exacto, sin espacios)
4. ✅ **MARCA:** "Make bucket public" (checkbox)
5. Click **"Create bucket"**

Deberías ver "product-images" en la lista.

### 3.2 Copiar URL del bucket
1. Click en el bucket `product-images`
2. En la esquina superior derecha, click el icono **"Copiar URL"**
3. Guarda esta URL (la necesitarás en el `.env`):
   ```
   https://[tu-project-id].supabase.co/storage/v1/object/public/product-images
   ```

---

## ✅ PASO 4: CONFIGURAR POLÍTICAS RLS (Storage)

### 4.1 Crear política de lectura pública
1. En el bucket `product-images` → Tab **"Policies"**
2. Click **"New policy"** → **"For full customization"**
3. Nombre: `Enable public read access`
4. Operation: **SELECT**
5. Target roles: **public**
6. Expression (POQL): 
   ```sql
   true
   ```
7. Click **"Save policy"**

### 4.2 Crear política para admins (upload)
1. Click **"New policy"** → **"For full customization"**
2. Nombre: `Enable admin insert`
3. Operation: **INSERT**
4. Target roles: **authenticated**
5. Expression (POQL):
   ```sql
   (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'admin'
   ```
6. Click **"Save policy"**

### 4.3 Crear política para admins (delete)
1. Click **"New policy"** → **"For full customization"**
2. Nombre: `Enable admin delete`
3. Operation: **DELETE**
4. Target roles: **authenticated**
5. Expression (POQL):
   ```sql
   (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'admin'
   ```
6. Click **"Save policy"**

**Resultado:** 3 políticas en el bucket
- ✅ Cualquiera puede VER imágenes
- ✅ Solo admins pueden SUBIR imágenes
- ✅ Solo admins pueden BORRAR imágenes

---

## ✅ PASO 5: CONFIGURAR AUTH URLS

### 5.1 Ir a Authentication Settings
1. Supabase Dashboard → **"Authentication"** (lado izquierdo)
2. Click **"URL Configuration"** (submenu)

### 5.2 Agregar Redirect URLs
En la sección **"Redirect URLs"**, agregar estas URLs (una por línea):

**Para desarrollo local:**
```
http://localhost:3000/dashboard.html
http://localhost:3000/login.html
http://localhost:3000/reset-password.html
```

Pasos:
1. Click en el campo de texto
2. Pega cada URL
3. Click **"Save"**

**Para producción (cuando deploys):**
```
https://tudominio.com/dashboard.html
https://tudominio.com/login.html
https://tudominio.com/reset-password.html
```

### 5.3 Verificar Email Confirmation
En la misma página, en **"Email"** tab:
- ✅ Verifica que "Confirm email" esté HABILITADO
- ✅ El template de confirmación debe estar activo

---

## ✅ BONUS: CREAR PRIMER USUARIO ADMIN

### 6.1 Registrarse en la app
1. Ejecutar servidor:
   ```powershell
   npm start
   ```
2. Ir a http://localhost:3000/register.html
3. Crear cuenta con email y contraseña

### 6.2 Convertir a admin (en Supabase)
1. Supabase Dashboard → **"SQL Editor"** → **"New query"**
2. Ejecutar:
   ```sql
   UPDATE public.profiles
      SET role = 'admin'
    WHERE email = 'tu.email@ejemplo.com';
   ```
3. Click **"RUN"**
4. Logout y Login nuevamente
5. Deberías ver el panel de Admin en http://localhost:3000/admin

---

## 🎯 ORDEN RECOMENDADO DE EJECUCIÓN

1. **Instalar Node.js** (si es necesario) + `npm install` ← Haz primero
2. **Ejecutar migraciones SQL 001-004** en Supabase ← Haz segundo
3. **Crear bucket storage** ← Haz tercero
4. **Configurar RLS policies** ← Haz cuarto
5. **Configurar Auth URLs** ← Haz quinto
6. **Iniciar servidor y crear admin** ← Verifica que todo funciona

---

## ⚠️ CHECKLIST FINAL

Antes de declarar "100% funcional":

- [ ] `npm install` ejecutado sin errores
- [ ] 4 migraciones SQL completadas (sin "already exists" errors)
- [ ] Bucket `product-images` creado y público
- [ ] 3 políticas RLS en el bucket
- [ ] Redirect URLs configuradas
- [ ] Primer usuario admin creado
- [ ] Servidor corre: `npm start`
- [ ] Login funciona
- [ ] Panel admin carga sin errores
- [ ] Puedes crear un producto de prueba
- [ ] Imagen se sube correctamente

---

## 🆘 TROUBLESHOOTING

### npm install falla con error "package not found"
**Solución:** 
1. Eliminar carpeta `node_modules`: `rmdir node_modules -r`
2. Eliminar archivo `package-lock.json`: `del package-lock.json`
3. Reintentar: `npm install`

### Login falla con "relation profiles does not exist"
**Solución:** Las migraciones SQL no se ejecutaron. Vuelve al Paso 2.

### Storage upload falla con "permission denied"
**Solución:** Falta la política RLS o no estás logueado como admin. Verifica Paso 4.

### Servidor no inicia
**Solución:** 
1. Verificar que `.env` tenga credenciales Supabase válidas
2. Verificar que Node.js esté instalado: `node --version`
3. Ver logs: `npm start` (mostrará el error específico)

---

## 📞 NOTAS IMPORTANTES

- **Supabase está hospeado en cloud.** Los cambios son inmediatos.
- **`.env` ya tiene credenciales.** No necesitas agregarlas.
- **RLS es crítico.** Sin políticas correctas, cualquiera puede borrar datos.
- **Storage público = imagen visible en web.** Eso es intencional para productos.

¡Listo! Sigue estos 5 pasos y tu proyecto será 100% funcional. 🎉
