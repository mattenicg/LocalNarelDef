# SaaS Comercial Base - Plantilla

> Tienda Narel Local con backend Node.js + Express, PostgreSQL, autenticación propia y almacenamiento persistente local.

## ¿Que es esta plantilla?

Una base **lista para producción** que ahorra semanas de trabajo repetitivo al construir un SaaS de facturación, CRM, gestión comercial o cualquier herramienta B2B con multiples clientes. En lugar de empezar de cero cada vez, la plantilla ya resuelve:

- Registro y autenticacion de usuarios **con roles por inquilino**
- Aislamiento de datos entre clientes (multi-tenant por `tenant_slug`)
- Panel administrativo por tenant y superadmin global
- Chat de **Inteligencia Artificial con memoria y conocimiento especifico por cliente** via RAG
- Validacion de entradas, limpieza XSS y proteccion frente a inyecciones
- Rate limiting por IP y por tenant (evita gasto excesivo en IA)
- Logging estructurado con Winston (consola + archivos rotativos)
- Configuracion por variables de entorno (`.env`)
- Checkout con pagos manuales y Mercado Pago Card Payment Brick opcional
- Webhook firmado e idempotencia para actualizar pagos de forma segura
- Documentacion completa de arquitectura, despliegue y seguridad
- Script de seed inicial con usuario admin por defecto

## Stack Resumido

| Capa                | Tecnologia                                                                        |
|---------------------|-----------------------------------------------------------------------------------|
| Runtime             | Node.js 20 LTS                                                                    |
| Framework API       | Express 4.x                                                                       |
| Base de datos       | PostgreSQL mediante `pg`                                                          |
| Auth                | Sesiones HttpOnly propias + bcryptjs                                               |
| Validaciones        | express-validator                                                                 |
| Seguridad HTTP      | helmet, cors, xss-clean, dompurify, express-rate-limit                            |
| Logs                | winston + morgan                                                                  |
| IA                  | OpenAI API (gpt-4o-mini por defecto) + RAG personalizado por tenant              |
| Configuracion       | dotenv (.env)                                                                     |

## Primeros Pasos (Desarrollo Local)

```bash
# 1. Copiar variables de entorno y editar a gusto
cp .env.example .env
# Editá PostgreSQL, SMTP y credenciales del admin...

# 2. Instalar dependencias
npm install

# 3. Crear esquema PostgreSQL + administrador inicial
npm run seed

# 4. Iniciar servidor en modo desarrollo (recarga automatica)
npm run dev
```

El servidor arranca en `http://localhost:3000` (o el puerto que hayas puesto en `.env`).
Acceso inicial con el email y password definidos en `ADMIN_DEFAULT_EMAIL` / `ADMIN_DEFAULT_PASSWORD`.

## Estructura Rapida

```
saas-comercial-base/
├── src/              # Logica de la aplicacion (backend)
├── src/db/postgres-schema.sql # Esquema PostgreSQL autocreable
├── logs/             # Winston logs rotativos - ignorado en git
├── uploads/          # Archivos subidos por usuarios - ignorado en git
├── docs/
│   ├── ARQUITECTURA.md   # Decisiones tecnicas y estructura detallada
│   ├── DEPLOY.md         # Desplegar en VPS con PM2/Systemd + Nginx + SSL
│   └── SEGURIDAD.md      # Medidas y checklist de seguridad
├── package.json
├── .env.example      # Plantilla de variables
└── README.md
```

## ¿Que incluye la Seguridad por Defecto?

- **Contraseñas hasheadas** con bcrypt (nunca texto plano)
- **Sesiones opacas** almacenadas como hashes en PostgreSQL
- **CORS restringido** solo a `ORIGIN_PERMITIDO`
- **Rate limit** en login (5 intentos / 15 min)
- **Rate limit por tenant** en chat de IA (20 msg/hora configurable)
- **Sanitizacion XSS** de todas las entradas (xss-clean + dompurify)
- **Consultas parametrizadas** en todas las consultas PostgreSQL
- **Headers de seguridad** via helmet (CSP, HSTS, X-Frame-Options...)
- **Logs sin datos sensibles** (JWT, passwords, API keys jamas se registran)

## Personalizacion Rapida del SaaS

1. **Modelo de negocio**: Modifica las tablas en `src/database/schema.sql` y re-ejecuta seed
2. **Dominio/Branding**: Cambia `ORIGIN_PERMITIDO`, nombre de proyecto en `package.json`
3. **Planes y limites**: Amplia tabla `tenants` con columnas `plan`, `limite_usuarios`, `limite_ia_mes` y añade middleware que valide segun tenant
4. **Conocimiento IA por cliente**: Implementa tu cargador de documentos (PDF/Word/Web) en `src/services/rag.service.js`
5. **Frontend**: La plantilla es **solo backend**. Enlaza tu React/Vue/Next apuntando `ORIGIN_PERMITIDO` a tu dominio y autentica con cabecera `Authorization: Bearer <token>`

## Documentacion Adicional

- **[docs/ARQUITECTURA.md](docs/ARQUITECTURA.md)** - Explicacion detallada de cada decision tecnica
- **[docs/DEPLOY.md](docs/DEPLOY.md)** - Guia paso a paso para desplegar en VPS Ubuntu con PM2 + Nginx + Let's Encrypt, incluyendo script de backups SQLite
- **[docs/SEGURIDAD.md](docs/SEGURIDAD.md)** - Matriz de roles, proteccion de ataques comunes, plan de respuesta a incidentes y checklist mensual/trimestral

## Comandos NPM Disponibles

| Comando         | Accion                                              |
|-----------------|-----------------------------------------------------|
| `npm start`     | Arrancar en modo produccion                         |
| `npm run dev`   | Arrancar en desarrollo con recarga automatica (nodemon) |
| `npm run seed`  | Ejecutar seed (crear tablas + admin + demo tenants) |
| `npm run lint`  | Analisis estatico con ESLint                        |
| `npm test`      | Ejecutar tests Jest con coverage                    |

## Roadmap de Mejoras Sugeridas

- [ ] Añadir Refresh Token (DB + revocacion) con cookie HttpOnly
- [ ] Migracion de SQLite a PostgreSQL (si escala > 50 tenants activos)
- [ ] Conciliación automática y reportes avanzados de pagos Mercado Pago
- [ ] Panel superadmin: ver tenants activos, consumo IA, facturacion
- [ ] Notificaciones email (Nodemailer + Sendgrid/Mailgun)
- [ ] Tests de integracion E2E (Supertest) + CI/CD (GitHub Actions)
- [ ] Internacionalizacion i18n

## Licencia

MIT - Uso libre para proyectos propios o comerciales.
