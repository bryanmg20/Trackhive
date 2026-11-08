# Trackhive · Frontend

Interfaz web de Trackhive (React + TypeScript + Vite). Por ahora cubre la
pantalla de registro de investigadores (HU-47) y un marcador de posición para
el inicio de sesión.

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

| Ruta        | Pantalla                                         |
| ----------- | ------------------------------------------------ |
| `/registro` | Registro de investigadores (pantalla principal)  |
| `/login`    | Marcador de posición de inicio de sesión (HU-48) |

Cualquier otra ruta redirige a `/registro`.

## API

En desarrollo, Vite reenvía las peticiones `/api` a `http://localhost:3000`
(ver `vite.config.ts`). Para desplegar el frontend separado del backend, defina
`VITE_API_URL` con el origen de la API (ver `.env.example`); si se omite, se
usan rutas relativas.

El registro consume `POST /api/v1/users` con este cuerpo:

```json
{ "fullName": "Ana Pérez", "email": "ana@mail.com", "password": "secret123" }
```

La confirmación de contraseña es solo del cliente y no se envía. La casilla del
aviso de privacidad también se valida en el cliente y tampoco se envía: el
backend todavía no persiste el consentimiento. El aviso vigente es la versión
`1.0`, con fecha de vigencia 7 de noviembre de 2026 (ver
`src/features/auth/register/privacy-policy.ts`). Se espera `201` en éxito; los
errores usan el formato uniforme del backend
(`{ statusCode, code, message, details?, timestamp, path }`). Los `details`
por campo se muestran junto al campo correspondiente y un `409` o
`EMAIL_ALREADY_EXISTS` se muestra en el campo de correo.

## Estado y alcance

- **HU-01 integrado:** el `POST /api/v1/users` acepta `fullName`, `email` y
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

## Pruebas

`pnpm test` ejecuta Vitest con jsdom y Testing Library. Las pruebas de la
pantalla cubren etiquetas, errores por campo que conservan lo escrito,
contraseñas que no coinciden, aviso de privacidad obligatorio con versión
visible, detalles `400`, correo duplicado `409`, fallo de red, confirmación con
navegación manual y redirección automática. La API se simula con
`vi.stubGlobal('fetch', ...)`.

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
