# Trackhive · Frontend

Interfaz web de Trackhive (React + TypeScript + Vite). Cubre el registro de
investigadores (HU-47), el inicio de sesión, el buscador de material (HU-7.1),
la gestión del estado del material (HU-08) y el registro de solicitudes del
personal a nombre de un visitante (HU-93).

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
| `/personal/materiales`           | Estado del material (HU-08)                                | `PERSONAL`/`ADMIN` |
| `/personal/solicitudes/nueva`    | Registrar solicitud a nombre de un visitante (HU-93)       | `PERSONAL`/`ADMIN` |
| `/solicitudes`                   | Marcador de posición de solicitudes                        | Público          |

Las rutas de personal viven dentro de `StaffRoute`; si el rol no es `PERSONAL`
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
