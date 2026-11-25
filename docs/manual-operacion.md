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
| EVERYTHING_AGENT_TOKEN | Token con el que el agente de Everything (HU-166) envía las carpetas a los endpoints de ingesta (HU-137). Al menos 32 caracteres: `openssl rand -hex 32`. El mismo valor va en `trackhive.token` de la configuración del agente (sección 10). Vacío: la sincronización está desactivada, esos endpoints responden 503 y la pantalla **Sincronización** lo indica con el botón «Sincronizar ahora» inactivo (HU-138) | | No |
| EVERYTHING_RUN_TIMEOUT_MINUTES | Minutos sin recibir páginas tras los que una corrida de sincronización vence con error, sin marcar nada como no encontrado | 30 | No (30) |

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
- Sincronización con *Everything*: el administrador la ve en **Sincronización** (`/admin/sincronizacion`, HU-138). Ahí aparecen la última sincronización (cuándo, cuántas carpetas, si terminó bien o con error y el motivo), la que está pedida o en curso y la última vez que el agente se comunicó. Cada corrida queda en la tabla `sync_runs` con su resultado. El agente guarda su propio log en el PC del CLENA (sección 10.3).

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

## 10. Agente de sincronización con Everything (HU-166)

El agente es un programa de consola, `trackhive-agente.exe`, que se instala en el PC del CLENA donde corre *Everything*. Una vez al día consulta el servidor HTTP de *Everything* en ese mismo PC y envía a Trackhive las carpetas de los fondos, para que el catálogo sepa qué materiales tienen copia digital (HU-137). Además, mientras la sesión está iniciada, pregunta a Trackhive cada minuto si un administrador pidió «Sincronizar ahora» y, si lo hizo, sincroniza en ese momento (HU-138). Solo hace conexiones **salientes** por HTTPS: Trackhive nunca se conecta al PC del CLENA, así que no hay que abrir puertos ni crear reglas de firewall de entrada (D-17 en [arquitectura.md](arquitectura.md)).

### 10.1 Requisitos en el PC del CLENA

- Windows 10 u 11 de 64 bits. No hace falta instalar Python ni nada más: el `.exe` lo lleva dentro.
- *Everything* instalado, con la carpeta de las copias digitales en su índice (la unidad `Z:` o la ruta de red; [everything-desarrollo.md](everything-desarrollo.md), sección 4) y abierto mientras se trabaja (lo normal es que arranque con Windows).
- Su **servidor HTTP** activado en **Herramientas → Opciones → Servidor HTTP**: «Habilitar servidor HTTP», escuchando solo en `127.0.0.1`, un puerto (por ejemplo `8081`), usuario y contraseña, y **sin** «Permitir la descarga de archivos».
- Salida a internet por HTTPS hacia la dirección de Trackhive.

### 10.2 Instalación

1. **Descargar el paquete.** En GitHub, **Actions → CI**, la última ejecución en `main`, artefacto `trackhive-agente`. Trae `trackhive-agente.exe`, `agente.example.toml` e `instalar-tarea.ps1`. También se puede construir en Windows ([agent/README.md](../agent/README.md)).
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
| `Trackhive no responde …` o `Trackhive respondió 502/503/504` | Reintentó con espera creciente (5, 10, 20 y 40 s). Si no lo logró, cerró con error o, si Trackhive siguió sin responder, la dejó abierta: Trackhive la vence a los `EVERYTHING_RUN_TIMEOUT_MINUTES` (30) sin marcar nada | Revisar la conexión a internet y que Trackhive esté arriba. Si el cierre responde 504 en un catálogo grande, el proxy del servidor necesita más tiempo de espera para `/api/v1/everything/` (HU-42) |
| `Trackhive rechazó el token del agente (401 …)` | Terminó sin reintentar | Poner en `trackhive.token` el `EVERYTHING_AGENT_TOKEN` del servidor |
| `La sincronización está desactivada en Trackhive` (503) | Terminó sin reintentar | Configurar `EVERYTHING_AGENT_TOKEN` en el servidor |
| `409 SYNC_RUN_ALREADY_RUNNING` | Terminó sin reintentar: ya hay una corrida en curso | Esperar a que termine. Una corrida cortada vence a los 30 minutos |
| `413 …` | Cerró con error: una página pasa de 500 resultados o 100 kB | Bajar `everything.page_size` |
| `No se pudo verificar el certificado de Trackhive` | No envió nada ni reintentó | Revisar el certificado del servidor (HU-42). Solo si lo emite una CA propia, poner su certificado raíz en `trackhive.ca_file` |
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
