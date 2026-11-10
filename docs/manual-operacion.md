# Manual de operación

> Estado: pendiente (Sprint 3). El CLENA debe poder operar el sistema sin el equipo.

## 1. Requisitos

- Docker y docker-compose
- (Versiones, recursos mínimos del servidor)

## 2. Levantar el sistema

```bash
git clone <url-del-repo>
cp .env.example .env   # completar los valores
docker-compose up -d
```

## 3. Variables de entorno

| Variable | Descripción | Ejemplo (ficticio) | Obligatoria |
|---|---|---|---|
| DATABASE_URL | Conexión a PostgreSQL | | Sí |
| JWT_SECRET | Secreto del access token | | Sí |
| JWT_REFRESH_SECRET | Secreto del refresh token | | Sí |
| SMTP_HOST | Servidor de correo. En desarrollo, `mailpit` | smtp.example.com | Sí |
| SMTP_PORT | Puerto del servidor de correo. Con 465 se usa TLS directo; con otro puerto, STARTTLS | 587 | Sí |
| SMTP_USER | Usuario del servidor de correo. Vacío si no pide inicio de sesión, como Mailpit | notificaciones@example.com | No |
| SMTP_PASSWORD | Contraseña del servidor de correo | | No |
| SMTP_FROM | Remitente de los correos | Trackhive <no-reply@example.com> | Sí |

No escribir secretos reales en este documento.

## 4. Despliegue

- URL desplegada:
- Plataforma:
- Cómo desplegar una nueva versión:

## 5. Migraciones y datos semilla

(Cómo ejecutarlas.)

## 6. Respaldo y restauración de la base de datos

### Respaldo
```bash
# comando de pg_dump
```

### Restauración
```bash
# comando de pg_restore o psql
```

Frecuencia recomendada y dónde se guardan los respaldos:

## 7. Monitoreo

- Endpoint de salud: `/health`
- Dónde ver los logs:

## 8. Usuarios iniciales y cambio de contraseñas

## 9. Solución de problemas comunes

### Comprobar el envío de correos

1. Iniciar sesión como administrador y llamar a `POST /api/v1/notifications/test-email`, desde Swagger (`/docs`) o con el access token en `Authorization: Bearer <token>`.
2. El correo de prueba llega al correo de ese administrador. Con la configuración de desarrollo no se envía de verdad: queda en Mailpit, en `http://localhost:8025`.
3. Si la respuesta es 502 `MAIL_DELIVERY_FAILED`, el servidor de correo no aceptó el correo o no responde. El motivo exacto aparece en los logs del backend (`docker compose logs backend`). Hay que revisar las variables `SMTP_*`.

Para enviar correos reales con una cuenta de Gmail, la cuenta necesita la verificación en dos pasos y una **contraseña de aplicación** (Cuenta de Google → Seguridad → Contraseñas de aplicaciones). Con ella: `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER` igual al correo de la cuenta, `SMTP_PASSWORD` igual a la contraseña de aplicación (16 letras, sin espacios) y `SMTP_FROM="Trackhive <ese mismo correo>"`. Gmail siempre envía desde la cuenta con la que se inicia sesión. Después de cambiar el `.env`, reiniciar el backend: `docker compose up -d backend`.

### Correos al solicitante en cada cambio de estado (HU-23)

- Cada cambio de estado guarda su correo en la tabla `notifications` en estado `PENDIENTE`, y el backend lo envía en los 10 segundos siguientes. Si el servidor de correo falla, la solicitud conserva su nuevo estado.
- Si el envío falla, el log del backend muestra una línea `ERROR [SendPendingNotificationsUseCase] Could not send the email <id> of request <radicado> (attempt n of 5): <motivo>. Next attempt at <fecha>`. El correo se reintenta a los 1, 5, 15 y 60 minutos. Al quinto fallo queda `FALLIDA` y no se reintenta más.
- Para ver el estado de los correos:

  ```bash
  docker compose exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
    "SELECT r.tracking_code, n.delivery_status, n.attempts, n.last_error, n.scheduled_at, n.sent_at
       FROM notifications n JOIN requests r ON r.id = n.request_id
      ORDER BY n.created_at DESC LIMIT 20;"
  ```

- Para volver a enviar un correo `FALLIDA` después de corregir la configuración: `UPDATE notifications SET delivery_status = 'PENDIENTE', attempts = 0, scheduled_at = now() WHERE id = '<id>';`.

## 10. Contactos y licencia

- Licencia y propiedad del código: (pendiente de definir con el CLENA y la universidad)
