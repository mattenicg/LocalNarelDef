# Guia de Despliegue - SaaS Comercial Base

## Requisitos del Servidor

- **Sistema Operativo**: Ubuntu 22.04 LTS (recomendado), Debian 12 o Windows Server 2022.
- **Node.js**: >= 18.x LTS (20.x LTS recomendado).
- **npm**: >= 9.x.
- **RAM**: Minimo 1 GB (2 GB recomendado para uso con IA).
- **Disco**: Minimo 5 GB SSD (SQLite + logs + uploads).
- **Dominio**: (Opcional pero recomendado) apuntado al servidor con SSL via Let's Encrypt.

---

## Paso 1: Preparar el entorno

### Ubuntu/Debian
```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs build-essential sqlite3 curl git ufw nginx
node -v && npm -v
```

### Verificar compilacion better-sqlite3
better-sqlite3 requiere herramientas de build. En Debian/Ubuntu el paquete `build-essential` cubre las dependencias nativas.

---

## Paso 2: Clonar y configurar el proyecto

```bash
cd /var/www
sudo git clone <URL_REPOSITORIO> saas-comercial-base
cd saas-comercial-base
sudo npm ci --omit=dev
```

### Variables de entorno

Copiar plantilla y editar con valores reales:

```bash
cp .env.example .env
sudo nano .env
```

**Valores obligatorios en produccion**:

| Variable                  | Descripcion                                              | Ejemplo produccion                          |
|---------------------------|----------------------------------------------------------|---------------------------------------------|
| `PUERTO`                  | Puerto interno Express                                   | `3000`                                      |
| `DB_PATH`                 | Ruta absoluta recomendada                                | `/var/www/saas-comercial-base/data/app.db`  |
| `JWT_SECRET`              | Min 64 chars aleatorios (generar con `openssl rand -hex 64`) | `a1b2c3...f4e5d6`                           |
| `ADMIN_DEFAULT_EMAIL`     | Email superadmin inicial                                 | `admin@tuempresa.com`                       |
| `ADMIN_DEFAULT_PASSWORD`  | Min 12 chars, mayus+minus+numero+simbolo                 | `CambiaAhora123!`                           |
| `OPENAI_API_KEY`          | Clave real de plataforma OpenAI                          | `sk-proj-xxxx...`                           |
| `OPENAI_MODEL`            | Modelo preferido (coste/calidad)                         | `gpt-4o-mini`                               |
| `IA_MAX_TOKENS`           | Max tokens en respuestas IA                              | `500`                                       |
| `IA_MAX_MENSAJES_POR_HORA`| Limite por tenant cada hora                              | `20`                                        |
| `ORIGIN_PERMITIDO`        | Dominio frontend (sin barra final)                       | `https://app.tucliente.com`                 |
| `NODE_ENV`                | `production` para habilitar optimizaciones               | `production`                                |

### Verificar configuración y arrancar

```bash
npm run preflight -- --strict
npm start
```

El flujo principal usa PostgreSQL. SQLite legacy queda desactivado con `LEGACY_SQLITE_ENABLED=false`; no ejecutes el seed SQLite salvo que también instales `better-sqlite3` y necesites esas rutas antiguas.

### Mercado Pago Card Payment Brick

En Dokploy agregá estas variables al servicio de la aplicación:

| Variable | Uso |
|---|---|
| `PAYMENT_PROVIDER=mercadopago` | Habilita la opción Tarjeta con Mercado Pago |
| `MERCADO_PAGO_PUBLIC_KEY` | Clave pública para el Brick del navegador |
| `MERCADO_PAGO_ACCESS_TOKEN` | Token privado usado únicamente por Express |
| `MERCADO_PAGO_WEBHOOK_SECRET` | Firma de notificaciones de Mercado Pago |
| `MERCADO_PAGO_LOCALE=es-AR` | Idioma del formulario |
| `MERCADO_PAGO_STATEMENT_DESCRIPTOR=NAREL LOCAL` | Descripción visible en el pago |
| `ORIGIN_PERMITIDO=https://tu-dominio.com` | Origen HTTPS permitido |

En el panel de Mercado Pago configurá `https://tu-dominio.com/api/payments/mercadopago/webhook` como URL de notificaciones. Probá primero con credenciales `TEST-`; para producción reemplazalas por `APP_USR-`. No subas `.env` a GitHub ni copies el access token en HTML/JavaScript.

El backend recalcula el total y el stock desde PostgreSQL, usa `Idempotency-Key`, persiste solo metadatos no sensibles del pago y libera stock si la tarjeta es rechazada. Los números de tarjeta, CVV y token del Brick no se guardan.

---

## Paso 3: Opcion A - Gestion de proceso con PM2 (recomendado)

PM2 gestiona reinicios por caida, logs centralizados, cluster mode y auto-arranque al boot.

### Instalar PM2 global
```bash
sudo npm install -g pm2
pm2 -v
```

### Iniciar aplicacion
```bash
cd /var/www/saas-comercial-base
pm2 start src/server.js --name narel-local
pm2 save
pm2 startup systemd
```

Copiar el comando que devuelve `pm2 startup` y ejecutarlo para activar el arranque al reinicio.

### Comandos utiles PM2
```bash
pm2 status                   # Ver procesos
pm2 logs saas-comercial      # Ver logs en tiempo real
pm2 restart saas-comercial   # Reiniciar
pm2 reload saas-comercial    # Reinicio sin downtime (cluster)
pm2 stop saas-comercial      # Detener
pm2 monit                    # Monitor recursos
```

### (Opcional) Cluster mode para multi-core
```bash
pm2 start src/server.js --name narel-local -i max
```

---

## Paso 3: Opcion B - Systemd (sin dependencias extra)

Crear unidad systemd:

```bash
sudo nano /etc/systemd/system/saas-comercial.service
```

Contenido:
```ini
[Unit]
Description=SaaS Comercial Base - API Express
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/saas-comercial-base
EnvironmentFile=/var/www/saas-comercial-base/.env
ExecStart=/usr/bin/node src/server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Habilitar y arrancar:
```bash
sudo systemctl daemon-reload
sudo systemctl enable saas-comercial
sudo systemctl start saas-comercial
sudo systemctl status saas-comercial
```

Ver logs:
```bash
sudo journalctl -u saas-comercial -f
```

---

## Paso 4: Nginx como reverse proxy + SSL

Nginx gestiona SSL, compresion gzip, cache estatica y limites de tamano.

### Crear sitio Nginx
```bash
sudo nano /etc/sites-available/saas-comercial
```

```nginx
server {
    listen 80;
    server_name app.tudominio.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name app.tudominio.com;

    ssl_certificate     /etc/letsencrypt/live/app.tudominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.tudominio.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Habilitar sitio y SSL via Let's Encrypt
```bash
sudo ln -s /etc/nginx/sites-available/saas-comercial /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d app.tudominio.com
```

---

## Paso 5: Politica de backups SQLite

SQLite es un unico fichero. Estrategia recomendada **backup en caliente seguro**:

### Script de backup (`/root/scripts/backup-saas.sh`)
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/saas-comercial"
DB_PATH="/var/www/saas-comercial-base/data/app.db"
FECHA=$(date +%Y%m%d-%H%M%S)

mkdir -p $BACKUP_DIR

# Backup seguro usando sqlite3 .backup (bloquea brevemente, no corrompe)
sqlite3 $DB_PATH ".backup $BACKUP_DIR/app-$FECHA.db"

# Comprimir
gzip $BACKUP_DIR/app-$FECHA.db

# Retener 30 dias
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete

# Copia a almacenamiento remoto (opcional: s3/rclone)
# rclone copy $BACKUP_DIR/app-$FECHA.db.gz s3:tus-backups/saas/

echo "Backup completado: app-$FECHA.db.gz"
```

Hacer ejecutable y programar en crontab cada 6 horas:
```bash
chmod +x /root/scripts/backup-saas.sh
crontab -e
# Anadir:
0 */6 * * * /root/scripts/backup-saas.sh >> /var/log/saas-backup.log 2>&1
```

### Restaurar backup
```bash
# Detener app
pm2 stop saas-comercial
# Descomprimir
gunzip -k /var/backups/saas-comercial/app-20240101-120000.db.gz
# Reemplazar DB
cp /var/backups/saas-comercial/app-20240101-120000.db /var/www/saas-comercial-base/data/app.db
chown www-data:www-data /var/www/saas-comercial-base/data/app.db
# Reiniciar
pm2 start saas-comercial
```

---

## Checklist Post-Despliegue

- [ ] `NODE_ENV=production` confirmado
- [ ] `JWT_SECRET` >= 64 chars aleatorios (no el de example)
- [ ] Admin inicial puede acceder y cambiar contraseña
- [ ] `pm2 status` o `systemctl status` muestra la app activa
- [ ] Nginx responde por HTTPS, redirige HTTP->HTTPS
- [ ] `data/app.db` permisos `640` y propietario `www-data`
- [ ] `logs/` y `uploads/` con permisos de escritura para `www-data`
- [ ] Primer backup manual ejecutado sin errores
- [ ] UFW/Firewall: solo puertos 22, 80, 443 abiertos
- [ ] Ruta `/api/health` responde OK con status 200
