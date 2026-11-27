# Frontend de Trackhive

Interfaz web de Trackhive en React, TypeScript y Vite. El código está en
[`frontend/`](../frontend/); las pantallas siguen el [mapa de pantallas y
wireframes](pantallas.md).

## Requisitos

- Node 24
- pnpm 11

## Comandos

```bash
pnpm install
pnpm dev      # Vite en http://localhost:5173
pnpm lint     # ESLint
pnpm test     # Vitest + Testing Library
pnpm build    # tsc -b && vite build
pnpm exec playwright install chromium  # una sola vez, para las pruebas e2e
pnpm test:e2e # Playwright: cada ruta de ROUTES a 360 px
pnpm test:e2e:docker # Con Docker activo: pruebas de integración a través de localhost:8080
```

## Rutas

| Ruta | Pantalla | Acceso |
| --- | --- | --- |
| `/registro` | Registro de investigadores (HU-47) | Público |
| `/login` | Inicio de sesión | Público |
| `/mi-perfil` | Consultar y editar caracterización (HU-73) y eliminar la cuenta (HU-33) | Cualquier rol autenticado |
| `/materiales` | Buscador de material (HU-7.1); el personal va a `/personal/materiales` | `PUBLICO` |
| `/solicitudes/nueva` | Solicitud del usuario público (HU-10) | `PUBLICO` |
| `/mis-solicitudes` | Mis solicitudes: estado de cada una (HU-11) | `PUBLICO` |
| `/personal/materiales` | Archivo: estado del material (HU-08), entregas y devoluciones (HU-72) y elegir material para registrar una solicitud (#109) | `PERSONAL`/`ADMIN` |
| `/personal/solicitudes/nueva` | Registrar solicitud a nombre de un visitante (HU-93) | `PERSONAL`/`ADMIN` |
| `/solicitudes` | Listar y filtrar solicitudes (HU-12) | `PERSONAL`/`ADMIN` |
| `/solicitudes/:id` | Detalle de una solicitud, cambio de estado y agendar cita (HU-13, HU-15, HU-18) | `PERSONAL`/`ADMIN` |
| `/calendario` | Calendario de citas (HU-142, WF-11) | `PERSONAL`/`ADMIN` |
| `/reportes/material-mas-solicitado` | Material más solicitado | `PERSONAL`/`ADMIN` |
| `/reportes/tiempos-de-atencion` | Tiempos de atención (HU-25) | `ADMIN` |
| `/admin/usuarios` | Gestión de usuarios del personal: crear, editar, desactivar y activar (HU-05) | `ADMIN` |
| `/admin/capacidad-sala` | Capacidad diaria de la sala de lectura | `ADMIN` |
| `/admin/sincronizacion` | Sincronización con Everything: última sincronización, contacto del agente y «Sincronizar ahora» (HU-138) | `ADMIN` |

Las rutas del usuario público viven dentro de `ProtectedRoute`; cualquier otro
rol o una sesión vencida redirige a `/login`. Las rutas de personal viven dentro
de `StaffRoute`; si el rol no es `PERSONAL`
ni `ADMIN`, redirigen a `/materiales` o a `/login`. Las rutas de administración
viven dentro de `AdminRoute`: un `PERSONAL` vuelve a `/solicitudes`, un
`PUBLICO` a `/materiales` y sin sesión a `/login`. Cualquier otra ruta lleva a la pantalla
inicial del rol (`/materiales` para `PUBLICO`, `/solicitudes` para el
personal) o, sin sesión, a `/login`.

## API

### Caracterización y perfil (HU-73)

El registro público solicita municipio o distrito y rango de edad una sola vez.
Grupo poblacional es opcional y usa las once opciones del formato del CLENA,
en mayúsculas y sin numeración. El personal recoge los mismos datos al registrar
un visitante nuevo y los reutiliza en sus siguientes solicitudes.

«Mi perfil» (`/mi-perfil`) está disponible para todos los roles autenticados.
Carga y guarda la caracterización mediante `GET` y `PATCH /api/v1/users/me/profile`.
Los solicitantes anteriores pueden completar sus campos vacíos desde esa
pantalla. Las solicitudes públicas no vuelven a pedirlos.

Verificación con API y base de datos reales a través de Nginx:

```bash
# Desde la raíz, usando el .env existente y la semilla de demostración:
docker compose up -d --build
cd frontend
pnpm exec playwright test --config playwright.docker.config.ts
```

La prueba crea una cuenta pública ficticia, un visitante y solicitudes locales.
Usa `personal1@example.com` con contraseña `public12345678`, o `SEED_DEMO_PASSWORD` del proceso.
Comprueba registro, precarga, edición persistida, reutilización sin repetir los
campos y 401 sin token. Deja una captura de «Mi perfil» en `test-results/`.
El catálogo y la finalidad pendiente de confirmar con CLENA están en
[`docs/datos-personales.md`](datos-personales.md).

### Actualización automática de solicitudes (HU-12.1, #141)

El listado del personal (`/solicitudes`, #141) se actualiza cada 30 segundos
mientras la pestaña está visible, y al volver a la pestaña o enfocar la ventana.
Las consultas conservan los filtros aplicados, el orden y la página actual;
la tabla permanece visible durante la actualización, sin restablecer el scroll.
Si falla la conexión, se conservan los últimos resultados y se vuelve a intentar
en la siguiente actualización. No se usan WebSocket ni SSE.

La prueba de polling de `test:e2e:docker` requiere la semilla de demostración
(`RUN_SEED=true`), al menos dos páginas de solicitudes y Chromium instalado.
Usa `personal1@example.com`, con contraseña `public12345678` o la variable
`SEED_DEMO_PASSWORD` del proceso que ejecuta la prueba. Crea una solicitud
ficticia en la base local y comprueba una actualización real de 30 segundos,
sin simular la API.

En desarrollo, Vite reenvía las peticiones `/api` a `http://localhost:3000`
(ver `vite.config.ts`). En el despliegue con Docker, nginx reenvía `/api/`,
`/docs` y `/docs-json` al servicio `backend:3000` (ver `nginx/locations.conf`), así que
no hace falta definir `VITE_API_URL` en `docker compose`. En producción nginx
sirve HTTPS en el 443 con HSTS y redirige el 80 (`nginx/https.conf`); con
`FRONTEND_TLS=off`, como en `docker-compose.dev.yml`, sirve HTTP en el 80
(`nginx/http.conf`). Ver el manual de operación, sección 4. Para desplegar el
frontend separado del backend, defina `VITE_API_URL` con el origen de la API
(ver `.env.example`); si se omite, se usan rutas relativas.

El registro consume `POST /api/v1/users` con este cuerpo:

```json
{
  "firstName": "Ana",
  "middleName": "María",
  "lastName": "Pérez",
  "secondLastName": "Gómez",
  "email": "ana@mail.com",
  "password": "secret123",
  "municipality": "Barranquilla",
  "ageRange": "18-28",
  "populationGroup": "PREFIERO_NO_RESPONDER",
  "acceptedPrivacy": true,
  "privacyPolicyVersion": "1.1"
}
```

`middleName` y `secondLastName` son opcionales: si quedan vacíos en el
formulario, no se envían. Cada nombre admite hasta 40 caracteres.

La confirmación de contraseña es solo del cliente y no se envía. La aceptación
del aviso y su versión se validan en cliente y servidor; el backend guarda la
fecha de aceptación. El aviso vigente es la versión
`1.1`, con fecha de vigencia 16 de noviembre de 2026 (ver
`src/features/auth/register/privacy-policy.ts`). Se espera `201` en éxito; los
errores usan el formato uniforme del backend
(`{ statusCode, code, message, details?, timestamp, path }`). Los `details`
por campo se muestran junto al campo correspondiente y un `409` o
`EMAIL_ALREADY_EXISTS` se muestra en el campo de correo.

### Registro de solicitudes del personal (HU-93)

La pantalla `/personal/solicitudes/nueva` usa los dos endpoints de HU-10:

- `GET /api/v1/requesters/by-email?email=...` busca al solicitante. Un `404`
  (`REQUESTER_NOT_FOUND`) no es un error de pantalla: habilita los campos de
  contacto para una persona nueva.
- `POST /api/v1/requests/on-behalf` registra la solicitud y devuelve el
  `trackingCode`.

Si el solicitante existe, se envía `{ email, userId? }` y sus datos no se
vuelven a pedir. Si no existe, se envían `email`, `firstName` y `lastName`
obligatorios, más los datos opcionales de contacto. Los materiales solo se
eligen en `/personal/materiales`, que envía `?materiales=<id1>,<id2>` y los
conserva en el estado de navegación. El personal ya no usa `/materiales`: si lo
abre, se redirige a `/personal/materiales`, y el menú del personal no muestra
«Buscar material». La regla de anticipación de la fecha deseada no se
duplica en React: el mensaje de `INVALID_DESIRED_DATE` se muestra junto al
campo de fecha tal como lo devuelve el backend.

### Mis solicitudes (HU-11)

La pantalla `/mis-solicitudes` consume `GET /api/v1/requests/mine`
(`@Roles('PUBLICO')`; el personal y el administrador reciben `403`). El backend
toma al usuario del access token, así que la URL no lleva ningún identificador:
solo acepta `status`, `sort` (`registeredAt` o `desiredDate`), `order`, `page` y
`limit`. Cualquier otro parámetro, como los filtros del personal, responde
`400`. Cada solicitud trae `trackingCode`, `registeredAt`, `status`,
`desiredDate`, `deliveryMode`, `materials` y `rejectionReason` (HU-16; `null`
salvo en las rechazadas), sin el nombre ni el correo del solicitante.

La pantalla muestra el código de seguimiento, la fecha de radicación (en hora
de Bogotá), el material, la fecha deseada y el estado, y bajo una solicitud
rechazada, el motivo que escribió el personal (HU-16); filtra por estado,
ordena y pagina de 10 en 10. Se llega desde «Mis solicitudes» en la barra del
buscador `/materiales` (solo para `PUBLICO`) y desde el enlace «Ver mis
solicitudes» al radicar una solicitud.

### Agendar cita de consulta (HU-18)

La tarjeta «Agendar cita» aparece solo cuando `allowedTransitions` incluye
**Agendada**, es decir, en una solicitud Disponible con entrega presencial.
Muestra la fecha que pidió el solicitante y el campo empieza en ella; el
personal la puede cambiar. Se elige el día (sin hora) y se llama a `POST /api/v1/requests/:id/appointments`
con `{ date }`. La confirmación muestra el día, el horario de atención de ese
día (lunes a viernes 8:00–17:00, sábados 9:00–13:00), el solicitante y el
material. Un domingo lo rechaza el backend y su mensaje se muestra en la
tarjeta. **Agendada** no aparece en «Cambiar estado»: solo se alcanza
agendando.

### Cambiar estado de una solicitud (HU-15)

El detalle `/solicitudes/:id` trae `allowedTransitions`: los estados a los que
la solicitud puede pasar según la máquina de estados del backend (HU-14). La
tarjeta «Cambiar estado» muestra solo esas opciones, así que la regla no se
duplica en React. Desde **Agendada** las opciones se leen «El solicitante
asistió» (pasa a Atendida) y «El solicitante no asistió» (vuelve a
Disponible). En un estado final (Cerrada o Rechazada) no hay opciones.

**Rechazada (HU-16)** se ofrece cuando la máquina de estados lo permite (desde
Recibida o En búsqueda). Al elegirla, el campo de comentario pasa a «Motivo del
rechazo (obligatorio)». Si queda vacío o en blanco, la pantalla muestra el
error junto al campo, le da el foco y no llama a la API. El backend también lo
impide (`400 REJECTION_REASON_REQUIRED`) y la base de datos lo refuerza con un
CHECK. El motivo se envía como `comment`, se guarda en `rejection_reason` y en
el historial, y el detalle lo muestra en «Motivo del rechazo» sin recargar.

Al guardar se llama a `PATCH /api/v1/requests/:id/status` con
`{ status, comment? }`; el comentario es opcional (máximo 500 caracteres) y no
se envía si queda vacío. La respuesta trae el nuevo `status`, sus
`allowedTransitions` y el registro guardado en el historial (`statusChange`,
con fecha, hora y responsable), que la pantalla muestra como confirmación en
hora de Bogotá sin volver a cargar la solicitud. Un `409` (transición no
permitida u otra persona la cambió primero) muestra el mensaje del backend y
deja el estado como estaba.

**Disponible directo (HU-139):** una solicitud **Recibida** con entrega digital
cuyo material ya tiene copia digital consultable recibe del backend
`allowedTransitions: ['DISPONIBLE', 'RECHAZADA']`, así que la tarjeta ofrece
Disponible (con la pista «El material ya tiene copia digital…») y no En
búsqueda. La pantalla no decide nada: solo muestra lo que manda la entidad.
Cada material del detalle dice «Copia digital: Sí/No» (`hasDigitalCopy`).

### Gestión de usuarios del personal (HU-05)

`/admin/usuarios` solo la abre `ADMIN`, y el menú muestra «Usuarios» solo a ese
rol. Ocultarla no es un permiso: el backend responde `403` a `PERSONAL` y a
`PUBLICO` en los tres endpoints.

- **Listado:** `GET /api/v1/users/staff` con `q` (nombre o correo), `role`
  (`PERSONAL` o `ADMIN`), `active` (`true` o `false`), `sort` (`lastName`,
  `firstName`, `email`, `role`, `createdAt`), `order`, `page` y `limit`. Por
  defecto ordena por apellido ascendente, con 10 cuentas por página.
- **Crear:** «Crear cuenta del personal» abre el formulario y llama a
  `POST /api/v1/users/staff` con los cuatro campos del nombre, el correo y la
  contraseña inicial (mínimo 8 caracteres). No se envía rol: el backend crea
  siempre una cuenta `PERSONAL` activa. El administrador le entrega la
  contraseña a la persona por un canal seguro.
- **Editar:** cambia nombres y correo con `PATCH /api/v1/users/staff/:id`. El
  rol y la contraseña no se editan: ninguna cuenta pasa de `PERSONAL` a
  `ADMIN`.
- **Desactivar y activar:** «Desactivar» pide confirmación y envía
  `{ active: false }`; «Activar» envía `{ active: true }` sin confirmar. Una
  cuenta desactivada conserva sus solicitudes y su historial.

Los errores del backend se muestran tal como llegan: los de validación junto a
cada campo y los demás en la tarjeta (por ejemplo, `409 EMAIL_ALREADY_EXISTS` o
`409 CANNOT_CHANGE_OWN_ACCESS` cuando el administrador intenta desactivar su
propia cuenta).

### Sincronización con Everything (HU-138)

`/admin/sincronizacion` (WF-14) solo la abre `ADMIN`, y el menú muestra
«Sincronización» solo a ese rol. El backend responde `403` a `PERSONAL` y a
`PUBLICO` en sus dos endpoints.

- **Estado:** `GET /api/v1/everything/sync-status` trae si la integración está
  activa (`enabled`), la corrida pedida o en curso (`currentRun`, con `expired`
  si el agente la abandonó), la última que terminó (`lastRun`) y la última vez
  que el agente se comunicó (`agentLastContactAt`). Las fechas se muestran como
  «hace 15 minutos» y, al lado, en hora de Bogotá (`sync-times.ts`).
- **Sincronizar ahora:** el botón pide confirmación y llama a
  `POST /api/v1/everything/sync-requests`. Si la pantalla ya muestra una
  corrida pedida o en curso, no llama a la API y avisa que no se pidió otra. Si
  la pantalla estaba desactualizada, el `409` del backend
  (`SYNC_RUN_ALREADY_REQUESTED` o `SYNC_RUN_ALREADY_RUNNING`) muestra el mismo
  aviso. Con la integración desactivada, el botón está inactivo.
- **Actualización:** como la bandeja (HU-12.1), vuelve a pedir el estado al
  volver a la pestaña. Lo hace cada 5 s mientras hay una corrida pedida o en
  curso, y cada 30 s si no, así que el resultado nuevo aparece sin recargar
  cuando el agente termina. Se anuncia en una región `status`.

## Accesibilidad

- Los tokens de `src/styles/global.css` mantienen al menos 4.5:1 para texto y
  3:1 para el borde de los controles. `src/styles/global.a11y.spec.ts` verifica
  esos contrastes y que el tamaño base sea escalable.
- `:root` usa `font-size: 100%` y las pantallas usan `rem`/`clamp`, de modo que
  el texto respeta el tamaño configurado por la persona usuaria y el zoom del
  navegador.
- Los formularios usan etiquetas visibles asociadas con `htmlFor`, un foco
  visible global y el orden natural del DOM para recorrerlos con Tab.
- `pnpm lint` incluye `eslint-plugin-jsx-a11y`. El CI ejecuta ese lint en cada
  PR del frontend, y cada pantalla nueva debe conservar etiquetas y operación
  con teclado (Definition of Done).

## Diseño responsive (HU-29)

- `src/features/layout/AppLayout.tsx` es el contenedor compartido de las
  pantallas con sesión: marca, menú (`SiteNav`), encabezado y el contenedor del
  contenido. Las pantallas nuevas deben usarlo en vez de crear su propio
  `shell`/`topbar`/`main`. El registro, el inicio de sesión y las pantallas sin
  menú conservan `AuthLayout`, que también es un layout compartido.
- Los breakpoints se declaran una sola vez en `src/styles/global.css`:
  `--bp-mobile: 480px` y `--bp-tablet: 900px`. Los CSS Modules solo pueden usar
  esos anchos en sus `@media`; `src/styles/breakpoints.spec.ts` falla si aparece
  otro valor.
- `e2e/responsive.spec.ts` abre cada ruta de `ROUTES` a 360 px, simula las
  llamadas a `/api/v1/**` y falla si `scrollWidth` supera el ancho del viewport.
  También redimensiona la ventana y comprueba que los enlaces del menú no se
  corten. El CI ejecuta `pnpm test:e2e` en cada PR.
- **Definition of Done:** toda pantalla nueva debe ser usable a 360 px sin
  desplazamiento horizontal y pasar la prueba e2e de `ROUTES`.

## Pruebas

### Exportación CSV (HU-27)

Ambos reportes ofrecen **Exportar CSV** solo a ADMIN. Se envía el access token
a su endpoint `/api/v1/reports/<reporte>/export` usando los filtros aplicados,
no los cambios pendientes de aplicar. El ranking incluye el límite seleccionado.
El botón se deshabilita durante la carga del reporte y la descarga; errores de
red, permisos o sesión se muestran sin descargar un archivo inválido. La URL
temporal del archivo se libera después de iniciar la descarga.

`ExportReportButton.spec.tsx` y `api/export-report.spec.ts` cubren autorización
visible, filtros aplicados frente a borradores, teclado, descarga y errores.
`e2e/report-export.spec.ts` guarda descargas reales del navegador y comprueba
sus bytes UTF-8, nombre y filtros a 360 px. El e2e del backend compara el archivo
con los datos JSON sobre PostgreSQL real y comprueba 401/403.

Con Docker iniciado desde la raíz con `docker compose up -d --build`, ejecutar
desde `frontend` `pnpm test:e2e:docker report-export.spec.ts`. Usa el
administrador inicial (`ADMIN_EMAIL` / `ADMIN_PASSWORD`, por defecto local
`admin@example.com` y `admin12345678`) y las cuentas demo de personal y público
(`SEED_DEMO_PASSWORD`, por defecto local `public12345678`).
No crea solicitudes. Guarda los CSV y capturas de ambas pantallas en
`test-results/` usando el frontend servido por nginx en `localhost:8080`.

### Tiempos de atención (HU-25)

La ruta `/reportes/tiempos-de-atencion` y su entrada de menú son exclusivas de
ADMIN. Usa `GET /api/v1/reports/attention-times` y muestra promedio total,
promedio por estado y tamaño de cada muestra. Filtra por radicación en Bogotá;
los estados omitidos se excluyen y se distingue «Sin datos» de «0 s».

`AttentionTimesPage.spec.tsx` cubre permisos, filtros, rango inválido, teclado,
muestras, cero, ausencia de datos y recuperación de errores. Las pruebas de API
cubren fechas, errores y unidades de duración. Playwright comprueba el flujo y
la pantalla a 360 px. Para la verificación completa:

```bash
pnpm test -- --pool=threads --maxWorkers=2
pnpm lint
pnpm build
pnpm test:e2e
```

Con `docker compose up -d --build` iniciado desde la raíz, ejecutar desde
`frontend` `pnpm test:e2e:docker attention-times.spec.ts`. Usa el administrador
inicial (`ADMIN_EMAIL`, por defecto `admin@example.com`) y las cuentas demo de
personal/público para comprobar los 403, sin crear solicitudes. Guarda capturas
de escritorio y móvil en `test-results/`. Usa las contraseñas `ADMIN_PASSWORD` y
`SEED_DEMO_PASSWORD` del entorno de la prueba (por defecto local: `admin12345678` y `public12345678`).

### Disponible directo con copia digital (HU-139)

Con `docker compose up -d --build` iniciado desde la raíz y la semilla
(`RUN_SEED=true`), ejecutar desde `frontend`
`pnpm test:e2e:docker direct-availability.spec.ts`. Con `personal1@example.com`
crea tres solicitudes digitales ficticias para `publico1@example.com`: una con
material con copia (uno en restauración), otra con material no consultable y
otra con material sin copia. Comprueba en `localhost:8080` que solo la primera
ofrece Disponible en vez de En búsqueda, la pasa a Disponible, revisa el
historial y el correo en Mailpit (`localhost:8025`), y que la API responde 409
a Disponible en las otras dos. Guarda capturas en `test-results/`.

### Indicador de copia digital y carpeta para Everything (HU-140)

Con `docker compose up -d --build` iniciado desde la raíz y la semilla
(`RUN_SEED=true`), ejecutar desde `frontend`
`pnpm test:e2e:docker digital-copy-indicator.spec.ts`. Verifica a través de
Nginx (`http://localhost:8080`) que `/api/v1/materials` y
`/api/v1/requests/:id` nunca devuelven `digitalPath`, que el personal ve en
`/personal/materiales` y `/solicitudes/:id` «Copia digital: Sí/No», solo el
nombre de la carpeta en Everything y el aviso «Para revisión» cuando aplica, y
que el usuario público solo ve «Sí · Disponible en digital» o «No» en
`/materiales`, sin enlaces ni botones para abrir o descargar archivos.

### Sincronización con Everything (HU-138)

Con `docker compose up -d --build` iniciado desde la raíz y la semilla, ejecutar
desde `frontend`:

```bash
set -a; . ../.env; set +a   # SEED_*_PASSWORD y EVERYTHING_AGENT_TOKEN
pnpm test:e2e:docker everything-sync.spec.ts
```

A través de Nginx (`localhost:8080`), comprueba que `PERSONAL` y `PUBLICO`
reciben `403` en los dos endpoints y que la pantalla de `ADMIN` recibe su
estado del backend. Con `EVERYTHING_AGENT_TOKEN`, la prueba también hace de
agente: pide «Sincronizar ahora» en la pantalla, ve «Pedida, esperando al
agente» y el aviso al pulsar de nuevo, y luego toma la corrida y la cierra con
error, para no cambiar el catálogo. La pantalla muestra sola el resultado
nuevo. Sin el token, esa segunda prueba se omite. Guarda capturas en
`test-results/`.

### Calendario legible (HU-142)

El mes muestra hasta tres citas por día y «+N más» abre un diálogo con todas
las citas de ese día que coinciden con los filtros. Se abre con Enter o
Espacio, mantiene el foco dentro del diálogo y se cierra con Escape o «Cerrar».
Las filas del mes conservan su altura. Hasta 900 px se presenta una agenda
agrupada por fecha, con todas las citas visibles.

Cada día indica su ocupación respecto a la capacidad provisional de 15
(pendiente de HU-20.1, #74). Desde 12 se avisa «Cerca del límite» y desde 15,
«Límite». La ocupación excluye canceladas y no depende de los filtros; la lista
de citas sí los respeta. Se recorren las páginas de `/api/v1/appointments`
para cargar los días de la cuadrícula completos, incluidos los días contiguos
de otros meses. Un error de carga permite reintentar y evita mostrar cifras
parciales.

Para verificar:

```bash
pnpm test -- --pool=threads --maxWorkers=2
pnpm lint
pnpm build
pnpm test:e2e
```

Desde la raíz, iniciar `docker compose up -d --build`. Después, desde
`frontend`, ejecutar:

```bash
pnpm test:e2e:docker calendar.spec.ts
```

Esta última prueba usa `http://localhost:8080`, la API real a través de nginx
y la cuenta demo `personal1@example.com`. Requiere el seed y la contraseña
`SEED_DEMO_PASSWORD` (por defecto local `public12345678`). Crea cuatro solicitudes y sus
citas en una fecha futura; conserva los registros para revisión manual y
adjunta sus identificadores al reporte. Guarda capturas del mes, del diálogo
y de la agenda móvil en `test-results/`. Las pruebas del navegador también
comprueban días de 12 y 15 citas, altura uniforme, navegación con teclado y
ausencia de desplazamiento horizontal a 360 px.

`pnpm test` ejecuta Vitest con jsdom y Testing Library. Las pruebas de la
pantalla cubren etiquetas, errores por campo que conservan lo escrito,
contraseñas que no coinciden, aviso de privacidad obligatorio con versión
visible, detalles `400`, correo duplicado `409`, fallo de red, confirmación con
navegación manual y redirección automática. La API se simula con
`vi.stubGlobal('fetch', ...)`.

`MyRequestsPage.spec.tsx` cubre las columnas pedidas por HU-11, el motivo bajo
una solicitud rechazada (HU-16), la fecha de radicación en hora de Bogotá, la
URL de `/requests/mine`, la redirección de `PERSONAL`, `ADMIN` y visitantes a
`/login`, el filtro por estado, el orden, la paginación, los dos mensajes de
lista vacía, la sesión vencida y el fallo de red.

`RequestDetailPage.spec.tsx` cubre, además del detalle (HU-13), la acción de
cambiar estado (HU-15): solo aparecen las transiciones válidas, «asistió» y «no
asistió» desde Agendada, ningún cambio en estados finales, el cuerpo enviado con
y sin comentario, la confirmación con fecha, hora y responsable, el nuevo estado
en la cabecera, los errores `409` y `403`, y el uso solo con teclado. Para HU-16
cubre que Rechazada aparece solo cuando es válida, que el campo pasa a «Motivo
del rechazo (obligatorio)», que un motivo vacío o en blanco muestra el error y
no llama a la API, el cuerpo enviado al rechazar, el motivo visible en el detalle
y el error `400` del backend. `api/change-request-status.spec.ts` cubre la
petición `PATCH`. Para HU-18 cubre que Agendada no se ofrece en «Cambiar
estado», el agendamiento con su confirmación y el nuevo estado, la fecha deseada
visible y precargada, el error de domingo, la fecha vacía y que la tarjeta no
aparece fuera de Disponible presencial; `api/schedule-appointment.spec.ts` cubre
la petición `POST`.

`StaffMaterialsPage.spec.tsx` cubre, además del cambio de estado (HU-08), que
el personal marque materiales y llegue a
`/personal/solicitudes/nueva?materiales=<id1>,<id2>` con ellos cargados (#109).
`MaterialSearchPage.spec.tsx` cubre que `PERSONAL` y `ADMIN` se redirigen a
`/personal/materiales`.

`StaffNewRequestPage.spec.tsx` cubre la búsqueda de solicitante encontrado y
nuevo, los enlaces para elegir o cambiar material hacia `/personal/materiales`, los cuerpos enviados en cada caso, el error de fecha del backend junto al
campo, los detalles por campo anidado (`requester.firstName`), el código de
seguimiento y la sesión vencida. `StaffRoute.spec.tsx` y
`MaterialSearchPage.spec.tsx` cubren la protección por rol y la navegación del
personal al destino correcto.

## Estructura

```text
frontend/
├── src/
│   ├── App.tsx          # rutas (las de ROUTES en routes.ts) y sus guardas por rol
│   ├── main.tsx         # router de datos (useBlocker) que envuelve <App />
│   ├── assets/          # logos de CLENA y Uninorte y la fuente Inter
│   ├── features/        # una carpeta por funcionalidad: pantallas, api/, CSS Modules y pruebas al lado
│   │   ├── auth/        # registro, inicio de sesión, sesión y guardas por rol
│   │   ├── layout/      # AppLayout, PageHeader, título de la pestaña y diálogos modales
│   │   ├── navigation/  # menú por rol, foco al cambiar de ruta, filtros en la URL y aviso de cambios sin guardar
│   │   ├── materials/   # buscador público, archivo del personal, entregas e historial de custodia
│   │   ├── requests/    # solicitudes, detalle, citas, calendario y capacidad de la sala
│   │   ├── reports/     # material más solicitado y tiempos de atención
│   │   ├── users/       # gestión de usuarios del personal
│   │   ├── everything/  # sincronización con Everything
│   │   ├── profile/     # Mi perfil y eliminar la cuenta
│   │   ├── brand/       # logos institucionales
│   │   └── pending/     # marcador temporal de antes de HU-12; ninguna ruta lo usa
│   ├── styles/          # tokens, breakpoints y estilos globales
│   └── test/            # configuración de Vitest y Testing Library
├── e2e/                 # Playwright: responsive a 360 px y pruebas contra Docker
└── nginx/               # HTTPS (producción) o HTTP (desarrollo) y proxy hacia la API
```
