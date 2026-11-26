# Manual de operación

> Para quien instala y mantiene el servidor de Trackhive. El uso diario está en
> el [manual de usuario](manual-usuario.md). No escriba secretos reales en este
> documento.

## 1. Requisitos

- Un servidor Linux de 64 bits (Ubuntu 22.04 o 24.04, por ejemplo) con al menos
  2 vCPU, 4 GB de RAM y 20 GB de disco libre. Construir las imágenes es lo que
  más memoria pide.
- Docker Engine 24 o superior con el plugin Docker Compose **2.24 o
  superior** (`docker compose version`). El comando antiguo `docker-compose`
  no sirve.
- Git, para descargar y actualizar el código.
- Un nombre de dominio cuyo registro DNS apunte a la IP pública del servidor,
  y los puertos **80 y 443** abiertos desde internet. El agente de *Everything*
  del CLENA llega a Trackhive por internet (D-24 en [arquitectura.md](arquitectura.md)).
- Salida hacia el servidor de correo (SMTP) que enviará las notificaciones.
- `certbot`, si el certificado lo emite Let's Encrypt (sección 4.2).

## 2. Levantar el sistema

[`docker-compose.yml`](../docker-compose.yml) es la configuración de
**producción**: PostgreSQL, backend y frontend. Solo el frontend publica sus
puertos: el 80, que redirige a HTTPS, y el 443. PostgreSQL y el backend solo
se alcanzan dentro de la red de Docker, y no se levantan Mailpit ni el mock de
*Everything*.

[`docker-compose.dev.yml`](../docker-compose.dev.yml) le agrega lo de
desarrollo: PostgreSQL en `127.0.0.1:POSTGRES_PORT`, la API en
`127.0.0.1:BACKEND_PORT`, Mailpit, el mock de *Everything* (perfil
`everything`) y el frontend por HTTP en `FRONTEND_PORT`, sin certificado. El
`.env` copiado de `.env.example` lo carga con
`COMPOSE_FILE=docker-compose.yml:docker-compose.dev.yml` y
`COMPOSE_PATH_SEPARATOR=:` (el mismo separador en Linux, macOS y Windows), así
que en desarrollo `docker compose up` levanta todo como siempre.

### 2.1 En el servidor (producción)

```bash
sudo git clone https://github.com/bryanmg20/Trackhive.git /opt/Trackhive
cd /opt/Trackhive
cp .env.example .env
chmod 600 .env
```

Edite el `.env` (sección 3):

1. Borre las líneas `COMPOSE_FILE` y `COMPOSE_PATH_SEPARATOR`, para que solo
   se use `docker-compose.yml`, y las de la sección «solo desarrollo» de la
   tabla de la sección 3.
2. `RUN_SEED=false`, para no cargar los datos ficticios.
3. Contraseñas y secretos nuevos y largos: `POSTGRES_PASSWORD`, `JWT_SECRET`
   y `JWT_REFRESH_SECRET` (`openssl rand -hex 32` para cada uno),
   `ADMIN_EMAIL` y `ADMIN_PASSWORD` (sección 8).
4. El servidor de correo real (`SMTP_*`, sección 9).
5. `EVERYTHING_AGENT_TOKEN`, si ya se va a instalar el agente (sección 10).

Compruebe que solo quedan los servicios de producción (si aparece `mailpit`,
el `.env` todavía tiene `COMPOSE_FILE`):

```bash
docker compose config --services   # postgres, backend y frontend
```

Ponga el certificado (sección 4) y levante:

```bash
docker compose up -d --build
docker compose ps        # postgres healthy; backend y frontend Up
```

Al arrancar, el backend aplica las migraciones, carga la semilla solo si
`RUN_SEED=true`, crea el administrador inicial si todavía no hay ninguno y
empieza a atender. Si falta una variable obligatoria, `docker compose` se niega
a levantar y dice cuál (`Missing ... in .env`). Si `ADMIN_PASSWORD` es corta, el
backend se detiene y lo dice en `docker compose logs backend`.

### 2.2 En desarrollo

```bash
cp .env.example .env
docker compose up -d --build
```

Frontend en `http://localhost:8080`, API en `http://localhost:3000`, Mailpit
en `http://localhost:8025` ([README](../README.md#puesta-en-marcha-con-docker)).
Un `.env` anterior a HU-42 debe agregar `COMPOSE_FILE`,
`COMPOSE_PATH_SEPARATOR`, `ADMIN_EMAIL` y `ADMIN_PASSWORD` como en
`.env.example`; `SEED_ADMIN_PASSWORD` ya no se usa.

## 3. Variables de entorno

El `.env` está en la raíz del repositorio, nunca se sube a Git y solo debe
poder leerlo el administrador del servidor (`chmod 600 .env`).

| Variable | Descripción | Ejemplo (ficticio) | Obligatoria |
|---|---|---|---|
| POSTGRES_DB | Nombre de la base de datos | trackhive | Sí |
| POSTGRES_USER | Usuario de PostgreSQL | trackhive | Sí |
| POSTGRES_PASSWORD | Contraseña de PostgreSQL. Con ella, `docker-compose.yml` arma la conexión del backend | (`openssl rand -hex 32`) | Sí |
| RUN_SEED | `true` carga los datos ficticios de demostración (usuarios, materiales, solicitudes) en cada arranque. En producción, `false` | false | Sí |
| ADMIN_EMAIL | Correo del administrador inicial. El backend lo crea al arrancar si no existe ningún ADMIN (sección 8) | coordinacion@clena.example | Sí |
| ADMIN_PASSWORD | Contraseña del administrador inicial. Con `RUN_SEED=false`, al menos 12 caracteres; si no, el backend no arranca. Solo se usa al crear la cuenta | | Sí |
| SEED_DEMO_PASSWORD | Contraseña de los usuarios ficticios de la semilla. Con `RUN_SEED=false` no se exige | 12345678 | Solo con `RUN_SEED=true` |
| JWT_SECRET | Secreto del access token. Cambiarlo cierra todas las sesiones | (`openssl rand -hex 32`) | Sí |
| JWT_REFRESH_SECRET | Secreto del refresh token, distinto del anterior | (`openssl rand -hex 32`) | Sí |
| SMTP_HOST | Servidor de correo. En desarrollo, `mailpit` | smtp.example.com | Sí |
| SMTP_PORT | Puerto del servidor de correo. Con 465 se usa TLS directo; con otro puerto, STARTTLS | 587 | Sí |
| SMTP_USER | Usuario del servidor de correo. Vacío si no pide inicio de sesión, como Mailpit | notificaciones@example.com | No |
| SMTP_PASSWORD | Contraseña del servidor de correo | | No |
| SMTP_FROM | Remitente de los correos | Trackhive <no-reply@example.com> | Sí |
| EVERYTHING_AGENT_TOKEN | Token con el que el agente de Everything (HU-166) envía las carpetas a los endpoints de ingesta (HU-137). Al menos 32 caracteres: se genera con `openssl rand -hex 32` y se rota como dice la sección 10.5. El mismo valor va en `trackhive.token` de la configuración del agente (sección 10). Vacío: la sincronización está desactivada, esos endpoints responden 503 y la pantalla **Sincronización** lo indica con el botón «Sincronizar ahora» inactivo (HU-138) | | No |
| EVERYTHING_RUN_TIMEOUT_MINUTES | Minutos sin recibir páginas tras los que una corrida de sincronización vence con error, sin marcar nada como no encontrado (HU-137) | 30 | No (30) |
| FRONTEND_TLS | `on`: nginx sirve HTTPS en el 443 con el certificado de `TLS_CERT_DIR` y la cabecera HSTS, y el 80 solo redirige. `off`: HTTP en el 80, para un proxy de la universidad que ya pone HTTPS (sección 4.4) o para emitir el primer certificado | on | No (on) |
| TLS_CERT_DIR | Carpeta del servidor con `fullchain.pem` y `privkey.pem` (sección 4) | ./deploy/tls | No (./deploy/tls) |
| COMPOSE_FILE, COMPOSE_PATH_SEPARATOR | Solo desarrollo: agregan `docker-compose.dev.yml`. En producción se borran | docker-compose.yml:docker-compose.dev.yml y `:` | Solo desarrollo |
| POSTGRES_PORT, BACKEND_PORT, FRONTEND_PORT | Solo desarrollo: puertos locales de PostgreSQL, la API y el frontend | 5432, 3000, 8080 | Solo desarrollo |
| EVERYTHING_USER, EVERYTHING_PASSWORD, EVERYTHING_MOCK_PORT | Solo desarrollo: el mock de Everything (HU-133). El backend no los usa | | No |
| DATABASE_URL | Solo desarrollo: la conexión de Prisma cuando el backend corre fuera de Docker. En Docker no se usa | | No |

Después de cambiar el `.env`, aplique el cambio con `docker compose up -d`
(recrea solo los contenedores afectados).

## 4. Despliegue y HTTPS

- **URL del despliegue:** (completar al desplegar en el servidor de la universidad, D-24)
- **Plataforma:** servidor de la universidad con Docker Compose (D-24).

El nginx del frontend escucha en el 443 con el certificado y envía
`Strict-Transport-Security: max-age=31536000`, sin `includeSubDomains`, porque
el dominio puede ser de la universidad. El 80 responde 301 hacia `https://`,
salvo `/.well-known/acme-challenge/`, que usa Let's Encrypt. El nginx espera
dos archivos en `TLS_CERT_DIR` (por defecto `deploy/tls/`, que Git ignora):

- `fullchain.pem`: el certificado del dominio seguido de los intermedios.
- `privkey.pem`: su clave privada (`chmod 600`).

Si faltan, el frontend no arranca y `docker compose logs frontend` dice
`cannot load certificate "/etc/nginx/tls/fullchain.pem"`.

### 4.1 Certificado de la universidad

Si la universidad entrega el certificado, copie el certificado con sus
intermedios como `deploy/tls/fullchain.pem` y la clave como
`deploy/tls/privkey.pem`, y levante (o recargue, sección 4.3). Antes de que
venza, repita la copia con el nuevo.

### 4.2 Certificado de Let's Encrypt (gratuito, se renueva solo)

1. Instale certbot (`sudo apt install certbot`).
2. Levante con HTTP, que ya responde el desafío de Let's Encrypt:

   ```bash
   FRONTEND_TLS=off docker compose up -d --build
   ```

3. Pida el certificado. `deploy/renovar-certificado.sh` lo copia a
   `deploy/tls/` y recarga nginx, ahora y en cada renovación. Siempre copia a
   `deploy/tls/`: con Let's Encrypt, deje `TLS_CERT_DIR` sin definir
   (reemplace el dominio y la ruta del repositorio):

   ```bash
   sudo certbot certonly --webroot -w /opt/Trackhive/deploy/acme-challenge \
     -d trackhive.example.edu.co \
     --deploy-hook /opt/Trackhive/deploy/renovar-certificado.sh
   ```

4. Pase a HTTPS: `docker compose up -d`. Ahora el frontend usa el certificado.
5. Compruebe la renovación: `sudo certbot renew --dry-run`. El temporizador de
   certbot (`systemctl list-timers | grep certbot`) la intenta dos veces al día
   y renueva 30 días antes del vencimiento; el *deploy hook* recarga nginx sin
   cortar el servicio.

### 4.3 Comprobar HTTPS

```bash
curl -sI http://trackhive.example.edu.co/solicitudes | grep -iE '^HTTP|^location'
# HTTP/1.1 301 Moved Permanently
# Location: https://trackhive.example.edu.co/solicitudes
curl -sI https://trackhive.example.edu.co/ | grep -i strict-transport-security
# strict-transport-security: max-age=31536000
curl -s https://trackhive.example.edu.co/api/v1/health
# {"status":"ok","database":"up"}
echo | openssl s_client -connect trackhive.example.edu.co:443 -servername trackhive.example.edu.co 2>/dev/null \
  | openssl x509 -noout -subject -enddate
```

`curl` sin `-k` falla si el certificado no es válido para el dominio. La
documentación de la API (Swagger, con todas las operaciones) queda en
`https://trackhive.example.edu.co/docs` y su OpenAPI en `/docs-json`, que se
puede importar en Postman. Para
cambiar el certificado sin reiniciar: `docker compose exec frontend nginx -s reload`.

**Agente de Everything:** desde el PC del CLENA (o cualquier equipo con
internet), la ingesta responde por HTTPS:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://trackhive.example.edu.co/api/v1/everything/sync-runs
# 401: llega y pide el token del agente. 503: falta EVERYTHING_AGENT_TOKEN en el servidor
```

`trackhive.url` del agente es `https://trackhive.example.edu.co` (sección 10.2).
El nginx espera hasta 300 s la respuesta de `/api/v1/everything/`, porque
cerrar una corrida actualiza todo el catálogo (D-24).

### 4.4 Si el proxy de la universidad pone el HTTPS

Si el alojamiento exige que el certificado lo ponga un proxy de la universidad
delante del servidor, use `FRONTEND_TLS=off` en el `.env`: nginx atiende HTTP
en el 80, sin certificado. Ese proxy debe:

- servir `https://` con un certificado válido y reenviar al puerto 80 del servidor;
- redirigir `http://` a `https://` y enviar `Strict-Transport-Security`;
- esperar al menos 300 s la respuesta de `/api/v1/everything/`.

Las comprobaciones de la sección 4.3 se hacen igual contra la URL pública. El
puerto 80 del servidor no debe quedar abierto a internet, solo al proxy: sin
eso, cualquiera llega por HTTP sin HSTS. Docker publica sus puertos por fuera
de las reglas normales del firewall (`ufw` no los filtra), así que la
restricción va en la cadena `DOCKER-USER` de iptables (reemplace la IP del
proxy y guarde la regla con `iptables-persistent` para que sobreviva al
reinicio):

```bash
sudo iptables -I DOCKER-USER -p tcp -m conntrack --ctorigdstport 80 ! -s 10.0.0.10 -j DROP
sudo iptables -I DOCKER-USER -p tcp -m conntrack --ctorigdstport 443 -j DROP
```

Nginx recibe del proxy la petición en HTTP, así que reenvía a la API
`X-Forwarded-Proto: http`. Hoy la API no lo usa.

### 4.5 Desplegar una nueva versión

```bash
cd /opt/Trackhive
git pull
docker compose up -d --build
docker compose ps
```

Las migraciones nuevas se aplican solas al arrancar el backend. Antes de
actualizar, haga un respaldo (sección 6).

## 5. Migraciones y datos semilla

- **Migraciones:** el backend ejecuta `prisma migrate deploy` cada vez que
  arranca, así que una versión nueva queda con su base al día. Para ver el
  estado: `docker compose exec backend prisma migrate status`.
- **Semilla de demostración:** con `RUN_SEED=true`, cada arranque carga los
  datos ficticios de `backend/prisma/seed.ts` (6 usuarios de personal y
  público, 34 materiales, 15 solicitudes y 4 citas). Es idempotente: no
  duplica nada. **No se usa en producción** (`RUN_SEED=false`).
- **Administrador inicial:** no es parte de la semilla; se crea en los dos
  modos (sección 8).

## 6. Respaldo y restauración de la base de datos

### Respaldo

```bash
mkdir -p ~/respaldos
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > ~/respaldos/trackhive-$(date +%F).dump
```

El archivo `.dump` (formato personalizado de `pg_dump`) trae todas las tablas
con sus datos, incluidos los datos personales de los solicitantes: guárdelo
con permisos restringidos (`chmod 600`) y una copia fuera del servidor.

**Frecuencia recomendada:** diaria, y siempre antes de actualizar. Con `cron`
(`crontab -e`), a las 2:00, conservando 30 días:

```cron
0 2 * * * cd /opt/Trackhive && docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$HOME/respaldos/trackhive-$(date +\%F).dump" && find "$HOME/respaldos" -name 'trackhive-*.dump' -mtime +30 -delete
```

Respalde también, aparte, el `.env` y el certificado de `deploy/tls/`.

### Restauración

```bash
docker compose stop backend
docker compose exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' \
  < ~/respaldos/trackhive-2026-11-25.dump
docker compose start backend
```

`--clean --if-exists` reemplaza las tablas actuales por las del respaldo. Para
revisar un respaldo sin tocar la base en uso, restáurelo en otra base:
`docker compose exec -T postgres sh -c 'createdb -U "$POSTGRES_USER" prueba_restauracion'`
y el mismo `pg_restore` con `-d prueba_restauracion`; al terminar, `dropdb`.

## 7. Monitoreo

- **Salud:** `GET /api/v1/health` responde `{"status":"ok","database":"up"}`,
  o `degraded` / `down` si la base no responde en 3 s. Sirve para un monitor
  externo cada pocos minutos.
- **Logs:** `docker compose logs -f backend` (y `frontend`, `postgres`). Docker
  los guarda mientras exista el contenedor; `docker compose logs --since 1h backend`
  muestra la última hora.
- **Contenedores:** `docker compose ps`. Todos tienen `restart: unless-stopped`,
  así que vuelven solos tras un fallo o un reinicio del servidor.
- **Certificado:** `sudo certbot certificates` muestra su vencimiento (sección 4.2).
- **Sincronización con *Everything*:** el administrador la ve en **Sincronización** (`/admin/sincronizacion`, HU-138). Ahí aparecen la última sincronización (cuándo, cuántas carpetas, si terminó bien o con error y el motivo), la que está pedida o en curso y la última vez que el agente se comunicó. Cada corrida queda en la tabla `sync_runs` con su resultado. El agente guarda su propio log en el PC del CLENA (sección 10.3).

## 8. Administrador inicial y cambio de contraseñas

**Administrador inicial.** El backend crea al arrancar la cuenta ADMIN con
`ADMIN_EMAIL` y `ADMIN_PASSWORD`, con `RUN_SEED=true` o `false`, **solo si no
existe ningún ADMIN**, activo o no. El log lo dice una vez:
`Initial administrator created from ADMIN_EMAIL`. Su nombre es «Administrador
Trackhive».

- En los arranques siguientes no hace nada: no cambia su contraseña aunque
  cambie `ADMIN_PASSWORD`, y no reactiva cuentas.
- Con `RUN_SEED=false`, `ADMIN_PASSWORD` debe tener al menos 12 caracteres,
  y se comprueba en cada arranque: si es más corta, el backend no arranca.
- Si `ADMIN_EMAIL` ya es de otra cuenta (de personal o pública), el backend
  no arranca y el log dice «Ya existe una cuenta con ese correo»: use otro correo.
- `ADMIN_PASSWORD` tiene que seguir en el `.env`, pero tras el primer arranque
  ya no se usa: para no dejar en el disco la contraseña real, reemplácela por
  otra cadena aleatoria de 12 caracteres o más (`openssl rand -hex 16`).
- El administrador crea luego las cuentas del personal desde **Usuarios**.

**Cambiar una contraseña** (la del administrador tras el primer arranque, o
la de cualquier cuenta que la olvidó). Trackhive todavía no tiene una pantalla
para eso; se hace en el servidor, desde la carpeta del repositorio:

```bash
IFS= read -rs NUEVA      # escriba la nueva contraseña (no se muestra) y Enter
HASH=$(printf '%s' "$NUEVA" | docker compose exec -T backend node -e \
  "let s = ''; process.stdin.on('data', (d) => (s += d)).on('end', () => require('argon2').hash(s).then((h) => process.stdout.write(h)))")
docker compose exec -T postgres sh -c \
  'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v hash="$0" -v email="$1"' \
  "$HASH" coordinacion@clena.example <<'SQL'
UPDATE users SET password_hash = :'hash', updated_at = now() WHERE lower(email) = lower(:'email');
UPDATE refresh_tokens SET revoked_at = now()
 WHERE revoked_at IS NULL AND user_id IN (SELECT id FROM users WHERE lower(email) = lower(:'email'));
SQL
unset NUEVA HASH
```

Debe responder `UPDATE 1` y luego `UPDATE n`. La contraseña se guarda solo como
hash argon2, y el segundo `UPDATE` cierra las sesiones abiertas de esa cuenta
(el access token vigente dura hasta 15 minutos). `UPDATE 0` significa que el
correo no existe.

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
  docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <<'SQL'
  SELECT r.tracking_code, n.delivery_status, n.attempts, n.last_error, n.scheduled_at, n.sent_at
    FROM notifications n JOIN requests r ON r.id = n.request_id
   ORDER BY n.created_at DESC LIMIT 20;
  SQL
  ```

- Para volver a enviar un correo `FALLIDA` después de corregir la configuración, en `psql` (`docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'`): `UPDATE notifications SET delivery_status = 'PENDIENTE', attempts = 0, scheduled_at = now() WHERE id = '<id>';`.

## 10. Agente de sincronización con Everything (HU-166)

El agente es un programa de consola, `trackhive-agente.exe`, que se instala en el PC del CLENA donde corre *Everything*. Una vez al día consulta el servidor HTTP de *Everything* en ese mismo PC y envía a Trackhive las carpetas de los fondos, para que el catálogo sepa qué materiales tienen copia digital (HU-137). Además, mientras la sesión está iniciada, pregunta a Trackhive cada minuto si un administrador pidió «Sincronizar ahora» y, si lo hizo, sincroniza en ese momento (HU-138). Solo hace conexiones **salientes** por HTTPS: Trackhive nunca se conecta al PC del CLENA, así que no hay que abrir puertos ni crear reglas de firewall de entrada (D-17 en [arquitectura.md](arquitectura.md)).

### 10.1 Requisitos en el PC del CLENA

- Windows 10 u 11 de 64 bits. No hace falta instalar Python ni nada más: el `.exe` lo lleva dentro.
- *Everything* instalado, con la carpeta de las copias digitales en su índice (la unidad `Z:` o la ruta de red; [everything-desarrollo.md](everything-desarrollo.md), sección 4) y abierto mientras se trabaja (lo normal es que arranque con Windows).
- Su **servidor HTTP** activado en **Herramientas → Opciones → Servidor HTTP**: «Habilitar servidor HTTP», escuchando solo en `127.0.0.1`, un puerto (por ejemplo `8081`), usuario y contraseña, y **sin** «Permitir la descarga de archivos».
- Salida a internet por HTTPS hacia la dirección de Trackhive.

### 10.2 Instalación

1. **Descargar el paquete.** En GitHub, **Actions → CI**, la última ejecución en `main`, artefacto `trackhive-agente`. Trae `trackhive-agente.exe`, `agente.example.toml` e `instalar-tarea.ps1`. También se puede construir en Windows ([agente.md](agente.md)).
2. **Copiarlo** a `C:\Trackhive\agente\`, con el usuario que trabaja en ese PC. Tiene que ser una carpeta en la que ese usuario pueda escribir: ahí quedan la configuración y el log.
3. **Configurarlo.** Copiar `agente.example.toml` como `agente.toml` y completarlo con el Bloc de notas, guardando en UTF-8. Las rutas y las contraseñas van entre comillas simples (`'Z:\Aha\…'`).

   | Clave | Qué poner |
   |---|---|
   | `everything.url`, `user`, `password` | Los del servidor HTTP de Everything, por ejemplo `'http://127.0.0.1:8081'`. Solo se acepta este mismo PC |
   | `everything.roots` | Las raíces de los fondos tal como las informa Everything: exactamente `base` + `root` de cada fondo de `backend/config/catalog-convention.json` en el servidor. En el CLENA, `base` deja de ser `C:\trackhive\docs_simulados` y pasa a ser `Z:\` o la ruta de red (`\\<servidor>\Multimedia`), según cómo indexe Everything; la raíz de notarías queda, por ejemplo, `'Z:\Aha\Fondo - Notarías\Notarías'`. **Una raíz que falte aquí deja todos sus materiales como «copia digital no encontrada».** Al revés, una raíz sin ninguna carpeta hace fallar cada corrida: un fondo que todavía no tiene carpetas no se pone. |
   | `trackhive.url` | La dirección de Trackhive, con `https://`. El agente verifica su certificado y se niega a arrancar con `http://`, salvo contra `localhost` en desarrollo |
   | `trackhive.token` | El mismo valor de `EVERYTHING_AGENT_TOKEN` en el `.env` del servidor (sección 3) |

   Las demás claves tienen valores por defecto que sirven: 30 s de espera por respuesta de Everything, 200 carpetas por página, hasta 5 minutos de espera a que Everything arranque, y 5 intentos hacia Trackhive. El archivo de ejemplo explica cada una.

4. **Proteger la carpeta**, porque `agente.toml` tiene el token y la contraseña de Everything. En PowerShell, desde `C:\Trackhive`, deja acceso solo al usuario, a los administradores y al sistema:

   ```powershell
   icacls .\agente /inheritance:r /grant:r "${env:USERDOMAIN}\${env:USERNAME}:(OI)(CI)M" "*S-1-5-32-544:(OI)(CI)F" "*S-1-5-18:(OI)(CI)F"
   ```

5. **Probarlo a mano.** En PowerShell:

   ```powershell
   cd C:\Trackhive\agente
   .\trackhive-agente.exe
   $LASTEXITCODE   # 0: corrida completa
   ```

   Muestra cada paso y termina con una línea como `Corrida … completa con 3 páginas: 117 carpetas hoja: …`. Si algo falla, dice por qué (sección 10.4).

6. **Programar las tareas.** La diaria, por defecto a las 12:00 (con `-Hora` se elige otra), y la que atiende «Sincronizar ahora»:

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\instalar-tarea.ps1            # o -Hora 13:30
   ```

   Crea dos tareas en la carpeta **Trackhive** del Programador de tareas:
   - **Sincronizar con Everything** (HU-166): se ejecuta una vez al día. Tiene marcada «**Ejecutar la tarea lo antes posible si se omitió un inicio programado**», así que si el PC estaba apagado a esa hora, sincroniza al encenderlo e iniciar sesión. El PC no necesita estar siempre encendido. Nunca corre dos veces a la vez y se detiene si pasa de una hora.
   - **Atender Sincronizar ahora** (HU-138): empieza al iniciar sesión y sigue mientras la sesión está iniciada (`trackhive-agente.exe --vigilar`). Pregunta a Trackhive cada minuto (`trackhive.poll_seconds`) si un administrador pidió «Sincronizar ahora» y, si lo hizo, sincroniza. No tiene límite de tiempo, y si el programa falla, Windows lo vuelve a iniciar (hasta 3 veces, cada minuto). El script la deja iniciada, sin cerrar sesión.
   - Las dos corren con ese usuario y solo mientras tiene la sesión iniciada, que es cuando Everything está abierto. No guardan ninguna contraseña, no necesitan permisos de administrador y no abren ninguna ventana.

7. **Comprobarla.** En el Programador de tareas (`taskschd.msc`), **Biblioteca → Trackhive**: clic derecho en la tarea, **Ejecutar**. Al terminar, la columna «Resultado de la última ejecución» muestra `(0x0)`. También desde PowerShell:

   ```powershell
   Start-ScheduledTask -TaskPath '\Trackhive\' -TaskName 'Sincronizar con Everything'
   (Get-ScheduledTaskInfo -TaskPath '\Trackhive\' -TaskName 'Sincronizar con Everything').LastTaskResult   # 0
   (Get-ScheduledTask -TaskPath '\Trackhive\' -TaskName 'Atender Sincronizar ahora').State                # Running
   ```

   Para comprobar la segunda, un administrador entra a Trackhive, abre **Sincronización** y pulsa «Sincronizar ahora». En menos de un minuto la pantalla pasa de «Pedida, esperando al agente» al resultado, y `logs\vigilancia.log` muestra la corrida.

### 10.3 Operación

- **Cada día**, a la hora programada (o al encender el PC si estaba apagado), el agente hace una sincronización completa y termina.
- **«Sincronizar ahora» (HU-138):** para sincronizar en otro momento, un administrador abre **Sincronización** en Trackhive, pulsa «Sincronizar ahora» y confirma. La sincronización queda pedida y la tarea **Atender Sincronizar ahora** la toma en el siguiente minuto. La pantalla muestra el resultado sola, sin recargar. Si el PC está apagado, la sincronización sigue pedida (la pantalla dice desde cuándo y cuándo se comunicó el agente por última vez) y se hace al encender el PC. Mientras hay una pedida o en curso, no se pide otra.
- **Resultado:** «Resultado de la última ejecución» de la tarea es el código de salida del agente: `0x0` corrida completa; `0x1` la sincronización falló (el motivo está en el log y, si la corrida alcanzó a iniciarse, en Trackhive); `0x2` la configuración está mal y no se conectó a nada.
- **Log:** `C:\Trackhive\agente\logs\agente.log` para la tarea diaria y `logs\vigilancia.log` para «Sincronizar ahora». Así las dos tareas nunca comparten un archivo, que Windows no dejaría rotar. Cada uno guarda 1 MB y los 5 archivos anteriores, y nunca escribe el token ni la contraseña. La vigilancia solo escribe lo que cambia: una sincronización pedida, que Trackhive no responde y que vuelve a responder. Una corrida normal:

  ```text
  2026-11-24 12:00:01 INFO Everything responde
  2026-11-24 12:00:01 INFO Corrida 654d5b3a-… iniciada en Trackhive
  2026-11-24 12:00:02 INFO Página 1 enviada: 124 carpetas (124 de 124 bajo Z:\Aha\Fondo - Notarías\Notarías)
  2026-11-24 12:00:02 INFO Corrida 654d5b3a-… completa con 3 páginas: 117 carpetas hoja: 0 materiales creados, 117 actualizados, 0 copias no encontradas y 11 para revisión
  ```

- **En Trackhive**, cada corrida queda en `sync_runs` con su estado (`OK` o `ERROR`), las carpetas recibidas y el motivo del error.

### 10.4 Qué pasa si algo falla

Una corrida que termina con error nunca marca materiales como «copia digital no encontrada»: eso solo lo hace una corrida completa (RN-27). La siguiente ejecución vuelve a sincronizar todo.

| En el log | Qué hizo el agente | Qué hacer |
|---|---|---|
| `Everything no responde en …: rechazó la conexión` | Esperó hasta `startup_wait_seconds` (5 min) por si estaba arrancando; luego cerró la corrida con error | Abrir Everything y revisar que su servidor HTTP esté activo con la dirección de `everything.url` |
| `Everything responde, pero aún no tiene carpetas bajo todas las raíces` | Recién abierto, Everything contesta antes de cargar todo su índice: lo esperó hasta `startup_wait_seconds` | Nada, si después sigue la corrida. Si no, ver la fila siguiente |
| `Everything no devolvió ninguna carpeta bajo <raíz>` | Cerró la corrida con error sin enviar esa raíz. Cerrarla completa habría dejado todo ese fondo como «copia digital no encontrada» | Revisar que la unidad de red esté conectada, que Everything la indexe (`Z:` o la ruta de red) y que la raíz en `everything.roots` esté bien escrita, igual a la ruta que muestra Everything |
| `Las carpetas bajo <raíz> cambiaron mientras se leían` | Cerró la corrida con error: alguien creó o borró carpetas mientras se leía esa raíz por páginas, y una podía saltarse | Nada: la siguiente ejecución sincroniza. Si pasa seguido, programar la tarea a una hora en que no se esté copiando material |
| `Everything no responde en …: no respondió en 30 s` | Cerró la corrida con error | Si pasa seguido (por ejemplo, mientras reindexa la unidad de red), subir `everything.timeout_seconds` |
| `Everything rechazó el usuario o la contraseña (401)` | Cerró la corrida con error, sin esperar | Corregir `everything.user` y `everything.password` |
| `Trackhive no responde …` o `Trackhive respondió 502/503/504` | Reintentó con espera creciente (5, 10, 20 y 40 s). Si no lo logró, cerró con error o, si Trackhive siguió sin responder, la dejó abierta: Trackhive la vence a los `EVERYTHING_RUN_TIMEOUT_MINUTES` (30) sin marcar nada | Revisar la conexión a internet y que Trackhive esté arriba. Si el cierre responde 504 en un catálogo grande, el proxy necesita más tiempo de espera para `/api/v1/everything/`: el nginx del frontend espera 300 s (sección 4.3); si hay un proxy de la universidad delante, también él (sección 4.4) |
| `Trackhive rechazó el token del agente (401 …)` | Terminó sin reintentar | Poner en `trackhive.token` el `EVERYTHING_AGENT_TOKEN` del servidor |
| `La sincronización está desactivada en Trackhive` (503) | Terminó sin reintentar | Configurar `EVERYTHING_AGENT_TOKEN` en el servidor |
| `409 SYNC_RUN_ALREADY_RUNNING` | Terminó sin reintentar: ya hay una corrida en curso | Esperar a que termine. Una corrida cortada vence a los 30 minutos |
| `413 …` | Cerró con error: una página pasa de 500 resultados o 100 kB | Bajar `everything.page_size` |
| `No se pudo verificar el certificado de Trackhive` | No envió nada ni reintentó | Revisar el certificado del servidor (sección 4.3): que no esté vencido y que `fullchain.pem` traiga los intermedios. Solo si lo emite una CA propia, poner su certificado raíz en `trackhive.ca_file` |
| `El agente no se ejecuta: …` (código 2) | No se conectó a nada | Corregir `agente.toml` según el mensaje: `https://`, token de 32 caracteres o más, raíces entre comillas simples… |
| El antivirus bloquea `trackhive-agente.exe` | — | Es un ejecutable sin firma digital que construye el CI. Agregar una exclusión para `C:\Trackhive\agente\` |
| En **Sincronización** la corrida sigue «Pedida, esperando al agente» y el agente lleva tiempo sin comunicarse | — | El PC del CLENA está apagado, sin sesión iniciada o sin internet: la corrida se hace al volver. Si el PC está encendido, revisar que la tarea **Atender Sincronizar ahora** esté `Running` (paso 7) y `logs\vigilancia.log` |
| `No se pudo preguntar a Trackhive si hay una sincronización pedida: …` (en `vigilancia.log`) | Sigue preguntando cada minuto; lo escribe una vez y, cuando Trackhive vuelve, `Trackhive responde de nuevo` | Lo mismo que para la tarea diaria según el motivo: internet, token o sincronización desactivada |
| `La tarea que inició al agente terminó: se deja de atender «Sincronizar ahora»` | La tarea se detuvo (se reinstaló o se terminó a mano) y el agente terminó con ella | Nada, si fue a propósito. Para volver a iniciarla: `Start-ScheduledTask -TaskPath '\Trackhive\' -TaskName 'Atender Sincronizar ahora'` |

### 10.5 Rotar el token

1. Generar uno nuevo con `openssl rand -hex 32` o, en PowerShell:

   ```powershell
   $b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); -join ($b | ForEach-Object { $_.ToString('x2') })
   ```

2. Ponerlo como `EVERYTHING_AGENT_TOKEN` en el `.env` del servidor y reiniciar el backend: `docker compose up -d backend`.
3. Ponerlo en `trackhive.token` de `agente.toml`. Entre los pasos 2 y 3 el agente recibe 401, así que conviene hacerlo lejos de la hora de la tarea.

### 10.6 Actualizar o desinstalar

- **Actualizar:** detener la vigilancia, que tiene el `.exe` en uso (`Stop-ScheduledTask -TaskPath '\Trackhive\' -TaskName 'Atender Sincronizar ahora'`), reemplazar `trackhive-agente.exe` por el nuevo y volver a ejecutar `instalar-tarea.ps1`, que vuelve a crear las dos tareas y deja la vigilancia iniciada. La configuración y los logs se conservan. Después de cambiar `agente.toml` también se vuelve a ejecutar el script, para que la vigilancia lea la configuración nueva.
- **Desinstalar:** `powershell -ExecutionPolicy Bypass -File .\instalar-tarea.ps1 -Quitar` (quita las dos tareas) y borrar la carpeta `C:\Trackhive\agente`.

## 11. Contactos y licencia

- Licencia y propiedad del código: (pendiente de definir con el CLENA y la universidad)
