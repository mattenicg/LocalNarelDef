# Seguridad - SaaS Comercial Base

## Sumario de Medidas Implementadas

| Area                   | Medidas aplicadas                                                              |
|------------------------|--------------------------------------------------------------------------------|
| Autenticacion          | JWT firmado con HMAC-SHA256, bcrypt coste 12, sesiones sin estado              |
| Autorizacion           | Roles por tenant, middleware `requerirRol`, filtro `tenant_slug` obligatorio   |
| Datos sensibles        | Variables en `.env` (nunca en git), bcrypt en passwords, no logs de secrets    |
| Inputs                 | express-validator, xss-clean, dompurify para HTML                              |
| Cabeceras HTTP         | helmet (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)                    |
| Rate limit             | express-rate-limit por IP/ruta (login, IA, general)                            |
| CORS                   | Lista blanca via `ORIGIN_PERMITIDO`, credenciales seguras                      |
| Logs                   | winston: logs audit, NO loguear JWT ni passwords (campos sensibles eliminados) |
| Base de datos          | Prepared statements de better-sqlite3 (sin inyeccion SQL)                      |
| Archivos subidos       | Carpeta `uploads/` fuera de rutas publicas, validacion de tipos y tamano       |
| Dependencias           | `npm audit` en CI, versiones fijadas, sin --force                              |

---

## Autenticacion y Sesiones

### JWT Seguro
- **Algoritmo**: HS256 (HMAC) asimetrico no requerido en fases iniciales. Para multi-servidor, pasar a RS256 con par de claves.
- **Tiempo de vida recomendado**:
  - Access Token: 15 minutos
  - Refresh Token: 7 dias (almacenado en DB, revocable)
- **Envio al cliente**: Usar cookie `HttpOnly; Secure; SameSite=Strict` en lugar de `localStorage` para mitigar XSS.
- **Rotacion de secret**: Si `JWT_SECRET` se compromete, cambiarlo invalida TODOS los tokens activos. Preparar flujo de logout masivo.

### Passwords via bcryptjs
- Factor de coste 12 por defecto (recomendado >= 10).
- **Politica de contraseñas** a implementar en frontend + backend:
  - Minimo 12 caracteres
  - Al menos 1 mayuscula, 1 minuscula, 1 numero, 1 simbolo
  - Blacklist de claves comunes (password, 123456, qwerty...) via libreria `common-password-checker`.

---

## Autorizacion Multi-Tenant

### Filtro tenant_slug OBLIGATORIO
NUNCA depender solo del frontend para enviar `tenant_slug`. El middleware extrae `tenant_slug` DEL TOKEN JWT y lo fuerza en todas las consultas:

```
req.tenant = { slug: jwt_payload.tenant_slug }
```

Capa de repositorio incluye automaticamente `WHERE tenant_slug = ?` en SELECT/UPDATE/DELETE.
**Error frecuente**: Olvidar filtro en consultas JOIN -> agrupar por slug.

### Matriz de roles (ejemplo base)
| Rol            | Permisos tipicos                                                        |
|----------------|-------------------------------------------------------------------------|
| `superadmin`   | Gestiona tenants globales, sistema, backups                             |
| `admin_tenant` | Gestiona usuarios, plan, facturacion, IA de SU unico tenant            |
| `usuario`      | Acceso a datos y funcionalidades de su tenant sin administracion       |

Middleware `requerirRol('admin_tenant')` se aplica por ruta.

---

## Proteccion Frente a Ataques Comunes

### 1. Inyeccion SQL
- **Solo prepared statements**: better-sqlite3 obliga a `db.prepare(sql).run(params)`. Nunca concatenar strings.
- **Prohibido**: `SELECT * FROM users WHERE email = '${req.body.email}'`
- **Recomendado**: `db.prepare('SELECT * FROM users WHERE email = ?').get(req.body.email)`

### 2. Cross-Site Scripting (XSS)
- Nivel 1: `xss-clean` limpia req.body/query/params al entrar.
- Nivel 2: Validacion `express-validator` con `escape()` en campos de texto.
- Nivel 3: Cualquier HTML de usuario se sanitiza con `dompurify` ANTES de guardar y ANTES de renderizar.
- Nivel 4 (defensa en profundidad): Content-Security-Policy:
  ```
  default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self';
  ```

### 3. Cross-Site Request Forgery (CSRF)
- Si usas cookies HttpOnly para JWT, HABILITAR CSRF token (doble submit cookie o libreria `csurf`).
- Si usas `Authorization: Bearer` desde localStorage: CSRF no aplica por Same-Origin-Policy del fetch.
- Siempre `SameSite=Strict` en cookies.

### 4. Fuerza Bruta en Login
- Rate limit especifico: `5 intentos / 15 min / IP`.
- Tras 5 fallos, delay exponencial o captcha (hCaptcha).
- Bloquear cuenta (temporalmente) tras 10 fallos del mismo email (no solo IP).

### 5. Abuso de endpoints de IA
- Rate limit **por tenant** (no solo IP) via `IA_MAX_MENSAJES_POR_HORA`.
- Guardar cada llamada con tokens consumidos y coste estimado. Dashboard de gasto para admins.
- Longitud maxima de prompt usuario: 4000 chars.
- Prompt injection: instrucciones del sistema con delimitadores `### User message starts ###` y validaciones.

---

## Configuracion de Servidor

### Permisos de ficheros (produccion)
```bash
# Propiedad general
sudo chown -R root:root /var/www/saas-comercial-base
# Carpetas que escriben node
sudo chown -R www-data:www-data data/ logs/ uploads/
# Restringir permisos
chmod 750 data/ logs/ uploads/
chmod 640 data/app.db
chmod 600 .env
```

### Firewall (UFW)
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp comment 'SSH'
sudo ufw allow 80/tcp comment 'HTTP'
sudo ufw allow 443/tcp comment 'HTTPS'
sudo ufw enable
sudo ufw status verbose
```

### Headers de seguridad adicionales (Nginx)
```nginx
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
```

---

## Pagos con Mercado Pago

- El navegador usa Card Payment Brick para tokenizar la tarjeta; Narel Local no captura PAN, CVV ni vencimiento.
- `MERCADO_PAGO_ACCESS_TOKEN` y `MERCADO_PAGO_WEBHOOK_SECRET` viven solo en variables del backend/Dokploy.
- El servidor recalcula importes y stock desde PostgreSQL; nunca confía en el total enviado por el navegador.
- Los pagos usan `Idempotency-Key` para evitar cobros duplicados al reintentar una solicitud.
- El webhook valida `x-signature` con HMAC antes de consultar el pago y actualizar la orden.
- La base guarda únicamente `mp_payment_id`, referencia externa, estado, detalle, medio e installments; no guarda el token de tarjeta.
- Las respuestas públicas omiten la clave de idempotencia y no devuelven credenciales.
- Para pruebas usar exclusivamente credenciales y tarjetas sandbox de Mercado Pago.

## Auditoria y Respuesta a Incidentes

### Logs obligatorios (ya gestionados por winston)
Cada entrada de log incluye:
- Timestamp ISO
- Nivel (error/warn/info)
- Mensaje
- Contexto: `tenant_slug`, `user_id`, `request_id`
- Stack trace completo en `error`
- **NUNCA incluir**: token JWT, password, API keys, tarjetas, datos sensibles.

### Monitorizacion de eventos criticos (alertar por email/Slack)
- Login exitoso superadmin
- 5+ login fallidos en 5 min
- Excepciones no capturadas (uncaughtException)
- Rate limit alcanzado en endpoint IA
- Creacion/eliminacion de tenants o usuarios admin
- Cambio de `JWT_SECRET` o variables sensibles

### Plan de respuesta a brecha de seguridad
1. **Contener**: PM2 stop / nginx maintenance. Desconectar si es necesario.
2. **Evaluar alcance**: Revisar logs `logs/error.log` y journalctl. Identificar vector.
3. **Rotar secretos inmediatamente**:
   - `JWT_SECRET` (cierra todas las sesiones)
   - `OPENAI_API_KEY` (panel OpenAI)
   - Passwords de admin en DB
4. **Notificar**: Clientes afectados (GDPR: 72h max), autoridades si corresponde.
5. **Documentar**: Informe post-mortem con causa, impacto, medidas correcctoras.
6. **Prevenir**: Parche, auditar dependencias, añadir tests de seguridad.

---

## Checklist Regular de Seguridad

### Mensual
- [ ] Ejecutar `npm audit --production` y resolver `high`/`critical`.
- [ ] Verificar tamaño de `logs/` y rotacion.
- [ ] Probar restore del ultimo backup.
- [ ] Revisar usuarios administradores activos en todos los tenants.

### Trimestral
- [ ] Rotar `JWT_SECRET` y `ADMIN_DEFAULT_PASSWORD`.
- [ ] Auditoria manual de endpoints criticos (auth, IA, pagos).
- [ ] Actualizar Node.js a ultima LTS parcheada.
- [ ] Pentest basico o herramienta automatizada (OWASP ZAP).
