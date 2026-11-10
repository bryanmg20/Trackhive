# Trackhive · Frontend

Interfaz web de Trackhive (React + TypeScript + Vite). Cubre el registro de
investigadores (HU-47), el inicio de sesión, el buscador de material (HU-7.1),
la gestión del estado del material (HU-08), el registro de solicitudes del
personal a nombre de un visitante (HU-93), el listado de solicitudes del
personal (HU-12), el detalle de una solicitud con la acción de cambiar su
estado (HU-13 y HU-15) y «Mis solicitudes» del usuario público (HU-11).

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
```

## Rutas

| Ruta                             | Pantalla                                                   | Acceso           |
| -------------------------------- | ---------------------------------------------------------- | ---------------- |
| `/registro`                      | Registro de investigadores                                 | Público          |
| `/login`                         | Inicio de sesión                                           | Público          |
| `/materiales`                    | Buscador de material (HU-7.1)                              | Autenticado      |
| `/solicitudes/nueva`             | Solicitud del usuario público (HU-10)                      | `PUBLICO`        |
| `/mis-solicitudes`               | Mis solicitudes: estado de cada una (HU-11)                | `PUBLICO`        |
| `/personal/materiales`           | Estado del material (HU-08)                                | `PERSONAL`/`ADMIN` |
| `/personal/solicitudes/nueva`    | Registrar solicitud a nombre de un visitante (HU-93)       | `PERSONAL`/`ADMIN` |
| `/solicitudes`                   | Listar y filtrar solicitudes (HU-12)                       | `PERSONAL`/`ADMIN` |
| `/solicitudes/:id`               | Detalle de una solicitud, cambio de estado y agendar cita (HU-13, HU-15, HU-18) | `PERSONAL`/`ADMIN` |

Las rutas del usuario público viven dentro de `ProtectedRoute`; cualquier otro
rol o una sesión vencida redirige a `/login`. Las rutas de personal viven dentro
de `StaffRoute`; si el rol no es `PERSONAL`
ni `ADMIN`, redirigen a `/materiales` o a `/login`. Cualquier otra ruta redirige
a `/registro`.

## API

En desarrollo, Vite reenvía las peticiones `/api` a `http://localhost:3000`
(ver `vite.config.ts`). En el despliegue con Docker, nginx reenvía `/api/`,
`/docs` y `/docs-json` al servicio `backend:3000` (ver `nginx.conf`), así que
no hace falta definir `VITE_API_URL` en `docker compose`. Para desplegar el
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
  "password": "secret123"
}
```

`middleName` y `secondLastName` son opcionales: si quedan vacíos en el
formulario, no se envían. Cada nombre admite hasta 40 caracteres.

La confirmación de contraseña es solo del cliente y no se envía. La casilla del
aviso de privacidad también se valida en el cliente y tampoco se envía: el
backend todavía no persiste el consentimiento. El aviso vigente es la versión
`1.0`, con fecha de vigencia 7 de noviembre de 2026 (ver
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
eligen en `/materiales`, que envía `?materiales=<id1>,<id2>` y los conserva en
el estado de navegación. La regla de anticipación de la fecha deseada no se
duplica en React: el mensaje de `INVALID_DESIRED_DATE` se muestra junto al
campo de fecha tal como lo devuelve el backend.

### Mis solicitudes (HU-11)

La pantalla `/mis-solicitudes` consume `GET /api/v1/requests/mine`
(`@Roles('PUBLICO')`; el personal y el administrador reciben `403`). El backend
toma al usuario del access token, así que la URL no lleva ningún identificador:
solo acepta `status`, `sort` (`registeredAt` o `desiredDate`), `order`, `page` y
`limit`. Cualquier otro parámetro, como los filtros del personal, responde
`400`. Cada solicitud trae `trackingCode`, `registeredAt`, `status`,
`desiredDate`, `deliveryMode` y `materials`, sin el nombre ni el correo del
solicitante.

La pantalla muestra el código de seguimiento, la fecha de radicación (en hora
de Bogotá), el material, la fecha deseada y el estado; filtra por estado,
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
Disponible). **Rechazada** no se ofrece todavía porque exige motivo: HU-16 la
agrega a esta misma acción. En un estado final (Cerrada o Rechazada) no hay
opciones.

Al guardar se llama a `PATCH /api/v1/requests/:id/status` con
`{ status, comment? }`; el comentario es opcional (máximo 500 caracteres) y no
se envía si queda vacío. La respuesta trae el nuevo `status`, sus
`allowedTransitions` y el registro guardado en el historial (`statusChange`,
con fecha, hora y responsable), que la pantalla muestra como confirmación en
hora de Bogotá sin volver a cargar la solicitud. Un `409` (transición no
permitida u otra persona la cambió primero) muestra el mensaje del backend y
deja el estado como estaba.

## Estado y alcance

- **HU-01 integrado:** el `POST /api/v1/users` acepta `firstName`,
  `middleName`, `lastName`, `secondLastName` (issue #96), `email` y
  `password`, guarda la contraseña como hash y responde `409` si el correo ya
  existe.
- **HU-31 (aviso de privacidad):** la pantalla exige aceptar el aviso antes de
  enviar el formulario. El texto real, la versión y la fecha de vigencia están
  en `src/features/auth/register/privacy-policy.ts` y
  `PrivacyConsent.tsx`. **Pendiente:** el backend aún no recibe ni guarda la
  aceptación, la fecha y la versión.
- **HU-46 no disponible:** el wireframe no está en `docs/`, así que el diseño
  se derivó de los criterios de aceptación y de los tokens actuales del repo.
- **HU-48 no disponible:** `/login` es un marcador temporal; al registrarse se
  redirige allí con un aviso y el correo registrado.
- **HU-93 integrado:** la pantalla de mostrador permite buscar al solicitante,
  elegir materiales en el buscador de HU-7.1, registrar la solicitud y mostrar
  el comprobante con el código de seguimiento. No modifica el backend.

## Pruebas

`pnpm test` ejecuta Vitest con jsdom y Testing Library. Las pruebas de la
pantalla cubren etiquetas, errores por campo que conservan lo escrito,
contraseñas que no coinciden, aviso de privacidad obligatorio con versión
visible, detalles `400`, correo duplicado `409`, fallo de red, confirmación con
navegación manual y redirección automática. La API se simula con
`vi.stubGlobal('fetch', ...)`.

`MyRequestsPage.spec.tsx` cubre las columnas pedidas por HU-11, la fecha de
radicación en hora de Bogotá, la URL de `/requests/mine`, la redirección de
`PERSONAL`, `ADMIN` y visitantes a `/login`, el filtro por estado, el orden, la
paginación, los dos mensajes de lista vacía, la sesión vencida y el fallo de red.

`RequestDetailPage.spec.tsx` cubre, además del detalle (HU-13), la acción de
cambiar estado (HU-15): solo aparecen las transiciones válidas, «asistió» y «no
asistió» desde Agendada, Rechazada no se ofrece, ningún cambio en estados
finales, el cuerpo enviado con y sin comentario, la confirmación con fecha, hora
y responsable, el nuevo estado en la cabecera, los errores `409` y `403`, y el
uso solo con teclado. `api/change-request-status.spec.ts` cubre la petición
`PATCH`. Para HU-18 cubre que Agendada no se ofrece en «Cambiar estado», el
agendamiento con su confirmación y el nuevo estado, la fecha deseada visible y
precargada, el error de domingo, la
fecha vacía y que la tarjeta no aparece fuera de Disponible presencial;
`api/schedule-appointment.spec.ts` cubre la petición `POST`.

`StaffNewRequestPage.spec.tsx` cubre la búsqueda de solicitante encontrado y
nuevo, los cuerpos enviados en cada caso, el error de fecha del backend junto al
campo, los detalles por campo anidado (`requester.firstName`), el código de
seguimiento y la sesión vencida. `StaffRoute.spec.tsx` y
`MaterialSearchPage.spec.tsx` cubren la protección por rol y la navegación del
personal al destino correcto.

## Estructura

```text
src/
  features/auth/
    api/            # cliente de registro y errores tipados
    components/     # AuthLayout y TextField accesibles
    login/          # marcador de posición de /login
    register/       # pantalla, esquema Zod y pruebas
  styles/           # tokens y estilos globales
  test/             # configuración de Testing Library
```
