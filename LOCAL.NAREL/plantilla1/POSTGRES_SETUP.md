# Despliegue PostgreSQL + Docker

## Requisitos

- VPS Hostinger con Ubuntu 22.04/24.04.
- Docker Engine y Docker Compose plugin.
- Dominio apuntando al VPS.

## Configuración

1. Copiá `.env.example` como `.env`.
2. Cambiá `POSTGRES_PASSWORD`, `ADMIN_DEFAULT_PASSWORD` y `ORIGIN_PERMITIDO`.
3. Definí `ADMIN_DEFAULT_EMAIL` y `ADMIN_DEFAULT_PASSWORD` para crear el primer administrador.
4. Para recuperación real por email, configurá `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` y `PASSWORD_RESET_URL` con el dominio final.
5. No subas `.env` a GitHub.

## Arranque

```bash
docker compose up -d --build
```

La aplicación queda disponible en el puerto `3000`. PostgreSQL solo es accesible dentro de la red privada de Docker; no se publica ningún puerto `5432`.

## Logs y estado

```bash
docker compose ps
docker compose logs -f app
docker compose logs -f db
```

## Backup

Backup comprimido:

```bash
docker compose exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > backup-$(date +%F).dump
```

Restauración:

```bash
cat backup-YYYY-MM-DD.dump | docker compose exec -T db pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists
```

El volumen `postgres_data` conserva la base entre reinicios. El volumen `app_uploads` conserva las imágenes subidas.

## Dominio y HTTPS

Creá un registro DNS `A` para el dominio apuntando a la IP del VPS. Para producción se recomienda poner Nginx o Caddy delante de Docker, terminar HTTPS allí y reenviar al puerto `3000`. No expongas PostgreSQL a Internet.

## Mercado Pago en Dokploy

El checkout mantiene transferencia, efectivo y WhatsApp. Para habilitar la tarjeta con Mercado Pago, cargá en Dokploy las siguientes variables del servicio `app`:

```env
PAYMENT_PROVIDER=mercadopago
MERCADO_PAGO_PUBLIC_KEY=APP_USR-... o TEST-...
MERCADO_PAGO_ACCESS_TOKEN=APP_USR-... o TEST-...
MERCADO_PAGO_WEBHOOK_SECRET=...
MERCADO_PAGO_LOCALE=es-AR
MERCADO_PAGO_STATEMENT_DESCRIPTOR=NAREL LOCAL
ORIGIN_PERMITIDO=https://tu-dominio.com
```

`MERCADO_PAGO_ACCESS_TOKEN` y `MERCADO_PAGO_WEBHOOK_SECRET` son secretos y nunca deben entrar al frontend ni a Git. La única variable que se publica al navegador es `MERCADO_PAGO_PUBLIC_KEY`, mediante `/api/config/public`.

Después de desplegar por HTTPS, configurá en Mercado Pago el webhook:

```text
https://tu-dominio.com/api/payments/mercadopago/webhook
```

Usá credenciales `TEST-` para sandbox y credenciales `APP_USR-` en producción. Reiniciá/redeployá el servicio después de cambiar variables para que el esquema PostgreSQL agregue las columnas de pago y el backend recargue la configuración.

## Estructura PostgreSQL

El esquema se crea automáticamente desde `src/db/postgres-schema.sql` al arrancar e incluye:

- `profiles` y `user_sessions` para usuarios, roles y sesiones únicas.
- `products` para el catálogo y stock.
- `promo_banners`, `promotions` y `promotion_products`.
- `orders`, `order_items` y `stock_movements`.

El checkout usa una transacción PostgreSQL con bloqueo `FOR UPDATE`, recalcula precios desde la base y descuenta stock de forma atómica.
