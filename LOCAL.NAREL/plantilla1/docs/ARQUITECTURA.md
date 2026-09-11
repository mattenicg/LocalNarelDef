# Arquitectura del Sistema - SaaS Comercial Base

## Stack Tecnologico Elegido

### Backend: Node.js + Express
- **Node.js**: Runtime JavaScript asincrono, ideal para APIs con alto volumen de peticiones concurrentes. Ecosistema npm maduro y amplia comunidad.
- **Express**: Framework web minimalista, flexible y maduro. Permite arquitectura modular con middlewares. Fácil de aprender y mantener.

### Base de Datos: SQLite (multi-tenant) con better-sqlite3
- **SQLite**: Base de datos relacional sin servidor, fichero unico. Sin costes de infraestructura, backups triviales (copiar fichero), rendimiento excelente para cargas medias (< 100K peticiones/dia).
- **better-sqlite3**: Driver SQLite sincrono para Node.js. Mas rapido que paquetes asincronos, API sencilla, soporte de transacciones y prepared statements nativos.
- **Modelo Multi-tenant**: Todos los registros incluyen `tenant_slug` para aislar datos de cada cliente. Un unico fichero de base de datos sirve a múltiples inquilinos con filtros obligatorios en todas las consultas.

### Autenticacion: JWT (jsonwebtoken + bcryptjs)
- **JWT (JSON Web Token)**: Tokens stateless sin almacenamiento en servidor. Ideal para APIs REST y despliegues multi-instancia. Se valida con firma HMAC.
- **bcryptjs**: Hash de contraseñas con salt automatico y factor de coste configurable (12 rounds). Evita almacenar claves en texto plano.
- **Flujo**: Login valida credenciales -> devuelve JWT con `user_id`, `tenant_slug` y `rol` -> cliente envia token en cabecera `Authorization: Bearer <token>` -> middleware `autenticar()` valida y adjunta datos al request.

### Inteligencia Artificial: IA en backend con RAG por cliente
- **OpenAI API**: Integración via endpoint `/chat/completions`. Modelo por defecto `gpt-4o-mini` (bajo coste + buena calidad).
- **RAG (Retrieval-Augmented Generation)**: Cada tenant dispone de su propia base de conocimiento (embeddings almacenados en SQLite o vector store segun escalado). Antes de responder al usuario, se recuperan fragmentos relevantes del conocimiento del cliente y se inyectan en el prompt, garantizando respuestas ajustadas al negocio de cada inquilino.
- **Rate limit por cliente**: Variable `IA_MAX_MENSAJES_POR_HORA` evita abusos y controla gasto. Limites por tenant almacenados en Redis o tabla de contadores.
- **Tokens maximos**: `IA_MAX_TOKENS=500` controla longitud de respuesta y coste por consulta.

### Seguridad de entrada: express-validator + xss-clean + dompurify + jsdom
- **express-validator**: Validacion declarativa de body/query/params (formatos email, longitudes, rangos). Sanitizacion basica.
- **xss-clean**: Middleware que limpia propiedades XSS en req.body, req.query, req.params.
- **dompurify + jsdom**: Sanitizacion de HTML/Markdown renderizado por usuario (ej: descripciones de productos, comentarios). Elimina scripts, eventos inline y payloads peligrosos.

### Rate limiting: express-rate-limit
- Limita peticiones por IP a rutas sensibles (login, registro, IA). Previene fuerza bruta y abusos.
- Configuraciones por ruta: login (5 intentos / 15 min), IA (según `IA_MAX_MENSAJES_POR_HORA`), resto (1000 req / 15 min).

### Logging: winston + morgan
- **winston**: Logger estructurado con niveles (error/warn/info/debug). Multiples transportes: consola, ficheros rotativos por fecha/tamaño (`logs/error.log`, `logs/combined.log`). Formato JSON para parseo por ELK/Grafana Loki.
- **morgan**: Middleware HTTP logger. Registra cada peticion (metodo, ruta, status, duracion, IP). Integrado con winston via stream personalizado.

### Variables de entorno y configuracion: dotenv
- Fichero `.env` (ignorado por git) centraliza toda configuracion: puerto, DB, JWT, credenciales IA, CORS. `.env.example` documenta variables requeridas.

### CORS: cors
- Middleware que restringe origenes permitidos via `ORIGIN_PERMITIDO`. Soporta credenciales y preflight OPTIONS.

### Headers de seguridad: helmet
- Coleccion de middlewares que establecen headers HTTP seguros:
  - Content-Security-Policy
  - X-Frame-Options: DENY
  - X-Content-Type-Options: nosniff
  - Strict-Transport-Security (produccion)
  - Referrer-Policy
  - X-XSS-Protection: 0 (deprecated, CSP lo reemplaza)

---

## Estructura de Directorios (recomendada)

```
saas-comercial-base/
├── src/
│   ├── index.js              # Punto de entrada Express
│   ├── config/
│   │   ├── database.js       # Conexion SQLite
│   │   ├── logger.js         # Winston config
│   │   ├── jwt.js            # Firma/verificacion JWT
│   │   └── ia.js             # Cliente OpenAI
│   ├── middleware/
│   │   ├── auth.js           # autenticar(), requerirRol()
│   │   ├── tenant.js         # filtro tenant_slug obligatorio
│   │   └── rateLimit.js      # limites por ruta
│   ├── routes/
│   │   ├── auth.routes.js    # /api/auth (login, register)
│   │   ├── usuarios.routes.js
│   │   └── ia.routes.js      # /api/ia/chat (con RAG)
│   ├── controllers/
│   ├── services/
│   │   └── rag.service.js    # Embeddings + retrieval
│   └── database/
│       ├── schema.sql        # Tablas (incluye tenant_slug en todas)
│       └── seed.js           # Admin + tenants demo
├── data/                     # SQLite
├── logs/                     # Winston logs
├── uploads/                  # Archivos usuario
├── docs/
├── package.json
├── .env.example
└── .gitignore
```

---

## Decisiones Clave

1. **SQLite vs PostgreSQL**: Se elige SQLite para reducir complejidad operativa en fase inicial. Si el proyecto escala > 10 inquilinos activos o necesita busquedas complejas, migrar a PostgreSQL es directo (capa de repositorio desacoplada recomendada).
2. **Multi-tenant por columna vs schema separado**: `tenant_slug` en cada tabla es el equilibrio optimo. Aislamiento por filtros en middleware. Facil backup individual (WHERE tenant_slug = X export).
3. **IA en backend, nunca en frontend**: Clave OpenAI NUNCA viaja al navegador. Todo prompt se construye y valida en servidor. Se evita exposicion de secreto y se fuerza el contexto RAG del cliente.
4. **Sin ORM pesado**: better-sqlite3 + SQL escrito a mano evita dependencias complejas y optimiza consultas. Se recomienda capa de repositorio (services/) para encapsular SQL.
