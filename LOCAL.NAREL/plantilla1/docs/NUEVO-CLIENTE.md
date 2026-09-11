# 🆕 Guía: Crear un nuevo cliente (tenant) en la plantilla SaaS

> Versión 1.0 — Plantilla SaaS Comercial Base

## 🎯 Forma rápida (recomendada): Panel Admin

1. Iniciá sesión en `/admin/login.html` con tus credenciales de admin.
2. Andá a **Dashboard** → Card **"+ Cliente nuevo (completo)"** o a la sección **Clientes** → **"Generar completo"**.
3. Completá el formulario con estos datos (todos se pueden editar después):

   | Campo | Ejemplo: Tienda de ropa "Narel Flows" |
   |---|---|
   | **Slug (URL)** | `narel-flows` ⚠️ (sólo minúsculas, guiones, números — NO se puede cambiar fácil luego) |
   | **Nombre** | `Narel Flows` |
   | **WhatsApp** | `549343425944325` (sin + ni espacios: [país][código área][numero]) |
   | **Email de contacto** | `hola@narelflows.com` |
   | **Dirección** | `San Martín, 2029` |

4. Confirmar. En **< 1 segundo** se crean automáticamente:
   - ✅ Registro en tabla `tenants`
   - ✅ Config por defecto (colores neutros, horarios 9-18 lunes a viernes)
   - ✅ 4 servicios de ejemplo (después los editás)
   - ✅ 3 FAQ de ejemplo
   - ✅ 2 entradas de knowledge base para IA
   - ✅ URL lista: **`http://localhost:3000/narel-flows/`**

5. Ahora en la lista **Clientes**, clickeá **Editar** (el ícono lápiz) sobre el nuevo cliente y completá a gusto:

   ### 📋 Tab 1 — Info general
   - Nombre, slug (si es primera vez), WhatsApp, email, dominio (si va a tener uno propio, ej: `narelflows.com`), dirección, link Google Maps `ubicacion_url`.

   ### 🎨 Tab 2 — Colores + Meta (identidad visual)
   - **Colores**: 3 pickers:
     - `--color-primario`: color de marca principal (botones CTA)
     - `--color-secundario`: acento secundario
     - `--color-acento`: detalle brillante (bordes, badges)
   - **URLs**: logo (grande), favicon (32x32 svg/png), meta title (60 chars), meta description (160 chars), OG image para compartir (1200x630px).

   ### 🕒 Tab 3 — Horarios
   Para cada día de la semana activá/desactivá "Abierto" y elegí horario apertura/cierre.

   ### 🔗 Tab 4 — Redes
   Instagram, Facebook, TikTok, sitio web (todos opcionales).

6. **Guardar** → listo. Andá a **Servicios** del tenant (botón 🧰 en Clientes) y agregá/cargá los servicios reales. Hacé lo propio con **Galería**, **FAQ** y **Knowledge IA**.

---

## 🛠️ Forma manual (directo en SQLite)

Si preferís poblar datos programáticamente (ej: migración desde otra base):

```javascript
// ejemplo en Node REPL:
require('dotenv').config();
const { db } = require('./src/db');
const bcrypt = require('bcryptjs');

const tx = db.transaction(() => {
  const info = db.prepare(`INSERT INTO tenants (slug, nombre, dominio, whatsapp, email_contacto, created_at)
    VALUES (@slug, @nombre, @dominio, @whatsapp, @email, strftime('%s','now')*1000)`).run({
      slug: 'narel-flows',
      nombre: 'Narel Flows',
      dominio: 'narelflows.com',
      whatsapp: '549343425944325',
      email: 'hola@narelflows.com'
    });
  const tenantId = info.lastInsertRowid;

  db.prepare(`INSERT INTO tenant_config (tenant_id, json, created_at) VALUES (?, ?, strftime('%s','now')*1000)`)
    .run(tenantId, JSON.stringify({
      color_principal: '#111827', color_secundario: '#ffffff', color_acento: '#FFB703',
      logo_url: '', favicon_url: '',
      meta_title: 'Narel Flows — Tienda Oficial',
      meta_description: 'La fusión perfecta entre danza y deporte. Indumentaria urbana original.',
      og_image_url: '',
      direccion: 'San Martín, 2029',
      ubicacion_url: 'https://maps.app.goo.gl/...',
      horarios: {
        lunes:{abierto:true,de:"09:00",a:"18:00"},
        martes:{abierto:true,de:"09:00",a:"18:00"},
        miercoles:{abierto:true,de:"09:00",a:"18:00"},
        jueves:{abierto:true,de:"09:00",a:"18:00"},
        viernes:{abierto:true,de:"09:00",a:"18:00"},
        sabado:{abierto:true,de:"09:00",a:"13:00"},
        domingo:{abierto:false}
      },
      redes: { ig: 'https://instagram.com/narel_flows', fb: '', tiktok: '', web: '' }
    }));
});
tx();
console.log('✅ Cliente creado. ID:', tenantId);
```

---

## 🔌 Conectar un dominio propio

1. En el DNS del dominio del cliente, crear 2 registros:
   ```
   narelflows.com        A   <IP-DEL-SERVER>
   www.narelflows.com    CNAME  narelflows.com
   ```
2. En Nginx (ver `docs/DEPLOY.md`) configurar un `server_name narelflows.com www.narelflows.com` y que el `proxy_pass` incluya el header `X-Tenant: narel-flows`. El middleware `requireTenant` del backend ya lee `x-tenant`, `tenant_slug` header, el pathname `/narel-flows/...` o el subdominio.
3. En el admin editar el tenant y completar el campo **Dominio** = `narelflows.com`. Así el server en `src/server.js` matchhea por dominio e inyecta el tenant correcto sin slug en la URL.

---

## 🧪 Check list post-creación

- [ ] Abrir `http://localhost:3000/<slug>`: ¿cambia el title del tab? ¿los colores se aplican (inspeccionar --color-primario en DevTools)?
- [ ] ¿WhatsApp flotante abre wa.me con el número correcto?
- [ ] ¿Servicios se ven en #/servicios? ¿precios formateados?
- [ ] ¿Formulario Contacto envía y devuelve link WhatsApp? (Revisar Admin → Forms)
- [ ] ¿Chat IA responde con fallback heurístico (sin key) o con OpenAI (con key)?
- [ ] ¿Galería #/galeria abre lightbox?
- [ ] ¿FAQ dinámico en #/contacto?
- [ ] ¿Sitemap.xml y robots.txt alcanzables?
- [ ] ¿Schema.org JSON-LD visible en view-source:?

---

## 🔁 ¿Cómo duplicar el proyecto para un nuevo cliente?

**NO hay que duplicar código.** La plantilla es SaaS multi-tenant:
- Misma instancia de servidor Node, mismo código fuente
- Mismo archivo `data/app.db` (todos los clientes en tablas separadas por `tenant_id`)
- Cada cliente tiene su propio dominio/subdominio/slug
- 1 sola vez pagás el hosting / VPS → ∞ clientes

Si en algún momento necesitas escalar por encima de ~500 tenants, migrás a PostgreSQL (columnas ya compatibles) y agregás un balanceador por delante.

---

## 💾 Datos que usa el frontend de un cliente

Todo lo trae de `/api/public/:slug/config`:

```jsonc
{
  "tenant": { "id":1, "slug":"narel-flows", "nombre":"Narel Flows", "whatsapp":"549...", "email_contacto":"...", "dominio":"..." },
  "config": {
    "color_principal":"#0a0a0a", "color_secundario":"#ffffff", "color_acento":"#FFB703",
    "logo_url":"", "favicon_url":"",
    "meta_title":"...", "meta_description":"...", "og_image_url":"",
    "direccion":"...", "ubicacion_url":"...",
    "horarios":{ "lunes":{...} },
    "redes":{ "ig":"", "fb":"", "tiktok":"", "web":"" }
  }
}
```

Cuanto más completo esté el admin, mejor el frontend.
