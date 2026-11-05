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

La confirmación de contraseña es solo del cliente y no se envía. Se espera
`201` en éxito; los errores usan el formato uniforme del backend
(`{ statusCode, code, message, details?, timestamp, path }`). Los `details`
por campo se muestran junto al campo correspondiente y un `409` o
`EMAIL_ALREADY_EXISTS` se muestra en el campo de correo.

## Estado y bloqueo

- **HU-01 pendiente:** el `POST /api/v1/users` actual solo acepta `email`, no
  valida contraseña y guarda un `fullName` vacío. Enviar el cuerpo planeado
  devuelve `400` porque el `ValidationPipe` usa `forbidNonWhitelisted`. La
  pantalla queda implementada contra el contrato esperado y sus pruebas
  simulan la API con `fetch`; no se debe afirmar que la integración real está
  completa hasta que HU-01 se implemente.
- **HU-46 no disponible:** el wireframe no está en `docs/`, así que el diseño
  se derivó de los criterios de aceptación.
- **HU-48 no disponible:** `/login` es un marcador temporal; al registrarse se
  redirige allí con un aviso y el correo registrado.

## Pruebas

`pnpm test` ejecuta Vitest con jsdom y Testing Library. Las pruebas de la
pantalla cubren etiquetas, errores por campo que conservan lo escrito,
contraseñas que no coinciden, detalles `400`, correo duplicado `409`, fallo de
red, confirmación con navegación manual y redirección automática. La API se
simula con `vi.stubGlobal('fetch', ...)`.

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
