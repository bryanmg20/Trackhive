# Backend de Trackhive

API REST en NestJS con Prisma y PostgreSQL. El código está en [`backend/`](../backend/) y sigue la Clean Architecture descrita en [arquitectura.md](arquitectura.md) (D-25).

## Comandos

Desde `backend/`, con PostgreSQL y Mailpit levantados (ver el [README](../README.md#desarrollo-local-sin-docker)):

```bash
pnpm install
pnpm exec prisma generate
pnpm db:migrate
pnpm db:seed
pnpm start:dev     # API en http://localhost:3000, Swagger en /docs
pnpm lint:check
pnpm test          # unitarias, incluida la prueba de arquitectura
pnpm test:e2e      # contra PostgreSQL, en la base <POSTGRES_DB>_e2e
pnpm build
```

## API

- Prefijo global: `/api/v1`. Las rutas sin prefijo responden 404.
- Swagger UI: `http://localhost:3000/docs`. Documento OpenAPI: `http://localhost:3000/docs-json`.
- Validación global con `ValidationPipe` (`whitelist` y `forbidNonWhitelisted`). Los DTOs de entrada usan `class-validator` y `@ApiProperty` para reflejarse en Swagger.
- Todos los errores usan el mismo formato:

  ```json
  {
    "statusCode": 400,
    "code": "VALIDATION_ERROR",
    "message": "La petición contiene datos inválidos",
    "details": [
      { "field": "email", "messages": ["El correo no tiene un formato válido"] }
    ],
    "timestamp": "2026-11-04T15:00:00.000Z",
    "path": "/api/v1/users"
  }
  ```

  `code` es estable (por ejemplo `INVALID_EMAIL`) y `details` solo aparece en errores de validación.

- Cada endpoint nuevo debe validar su entrada con un DTO y documentarse en Swagger (`@ApiTags`, `@ApiOperation`, `@Api*Response`) dentro de su propia HU.
- Endpoint de referencia: `POST /api/v1/users` (`UsersModule`).

## Tiempos de atención (HU-25)

`GET /api/v1/reports/attention-times?from=2026-11-01&to=2026-11-30`
requiere access token y `@Roles('ADMIN')`. Sin sesión responde 401; PERSONAL
y PUBLICO reciben 403. `from` y `to` son opcionales, fechas `YYYY-MM-DD`
validadas por DTO; un rango invertido o una fecha inválida responde 400.

El rango selecciona solicitudes por **radicación**, con ambos días incluidos
en Bogotá (UTC−5). El total es el promedio entre `registered_at` y la primera
entrada a Atendida del historial inmutable,
incluyendo solicitudes que después se cerraron, y sin recortar la duración al
final del periodo. Es tiempo transcurrido, no horas hábiles. Solicitudes sin
entrada a Atendida ni fecha `attended_at` no participan. Se prioriza el historial
inmutable; solo si un dato antiguo carece de esa entrada se usa su `attended_at`
guardado. No se inventan transiciones intermedias para completar historiales.

La respuesta contiene `from`, `to`, `completedRequests`, `averageSeconds` y
`states` (`state`, `requestCount`, `averageSeconds`). Para Recibida, En búsqueda,
Disponible y Agendada se calcula la permanencia hasta Atendida usando el
historial ordenado por fecha e ID. Las visitas repetidas al mismo estado se
suman por solicitud antes de promediar. Una solicitud que omitió un estado no
participa en su denominador. Sin observaciones se devuelve `null`, no cero;
una transición instantánea sí tiene duración cero. No se envían identidades,
notas, materiales ni historiales individuales.

La consulta agrega los datos en PostgreSQL en una sola sentencia de lectura.
No introduce migraciones, tablas, índices ni reglas nuevas de persistencia.

Verificación desde `backend`:

```bash
pnpm exec prisma generate
pnpm test -- --runInBand attention-times
pnpm test:e2e -- --runInBand attention-times-flow
```

La prueba e2e usa exclusivamente una base terminada en `_e2e`, con migraciones
reales. Inserta historiales de ejemplo sin modificar filas de auditoría y
verifica promedio total, estados omitidos, visitas repetidas, duración cero,
fechas de Bogotá, solicitudes cerradas y accesos 401/403. Comprueba las filas
guardadas y que lecturas o errores no alteren solicitudes, historial ni outbox.
También radica, atiende y cierra una solicitud a través de la API real.

## Exportación de reportes (HU-27)

Solo ADMIN puede descargar estos archivos:

- `GET /api/v1/reports/most-requested-materials/export?from=2026-11-01&to=2026-11-30&limit=20`.
- `GET /api/v1/reports/attention-times/export?from=2026-11-01&to=2026-11-30`.

Reutilizan los DTOs, casos de uso, fechas de radicación de Bogotá y cálculos de
sus reportes JSON. El ranking conserva el límite y el orden consultados. Se
consulta nuevamente el reporte con esos criterios al exportar. Ambos endpoints
declaran `@Roles('ADMIN')`: PERSONAL y PUBLICO reciben 403 y sin sesión, 401.
Los filtros inválidos reciben 400 antes de generar el archivo. Swagger documenta
la descarga binaria `text/csv`.

La respuesta usa `Content-Disposition: attachment`, nombre de archivo con el
periodo, UTF-16LE con BOM, comas y finales de registro CRLF. La primera línea `sep=,`
indica a Excel el separador para abrir cada dato en su columna, independientemente
del separador regional. Los lectores CSV genéricos deben omitir esa línea.
Las comillas se duplican
y cada celda va entre comillas; se conservan acentos y saltos de línea dentro
del texto. Los textos que podrían interpretarse como fórmulas de hoja de cálculo
se prefijan con apóstrofo. No se exportan datos personales ni identificadores
internos. Los promedios se expresan en segundos; vacío significa sin observaciones,
mientras que `0` conserva una duración real de cero. Un ranking vacío descarga
solo sus encabezados; el periodo y el límite siguen identificados en el nombre.

Verificar con `pnpm test -- --runInBand 'csv|export-report'` y
`pnpm test:e2e -- --runInBand report-export-flow`. El flujo usa PostgreSQL
aislado, compara CSV con los reportes JSON y comprueba permisos, filtros,
caracteres especiales, archivos vacíos y ausencia de escrituras durante la
consulta y sus errores. No requiere migración ni cambios al esquema.

## Supresión de cuenta (HU-33)

`DELETE /api/v1/users/me/profile`, con access token y `{ "confirmation": true }`,
responde 204. Sin sesión devuelve 401; confirmación ausente/falsa o campos ajenos
se rechazan con 400. No usa `@Roles()` y toma el titular exclusivamente del token.
Swagger documenta la operación. Aplicar la migración con `pnpm db:migrate` antes
de arrancar el backend actualizado; Docker la aplica con su arranque habitual.

`PrismaAccountErasure` coordina una transacción serializable y mapeadores de
infraestructura para supresión. La excepción al historial inmutable permite solo
limpiar comentarios en el alcance verificado por el trigger; conserva los datos
para ranking y tiempos. Triggers impiden modificar identidades ya suprimidas.
La autenticación consulta el estado de la cuenta en cada petición para invalidar
access tokens previos, además de eliminar todos sus refresh tokens.

Pruebas de flujo y rollback con PostgreSQL:
`pnpm test:e2e -- --runInBand --testPathPatterns=account-erasure-flow`.
Para la integración desde nginx: en frontend,
`pnpm test:e2e:docker account-erasure.spec.ts` después de
`docker compose up -d --build`; crea y suprime solo una cuenta ficticia de prueba.

### Ajustes de revisión HU-33

- La última cuenta ADMIN activa no puede suprimirse: 409 `LAST_ADMIN_CANNOT_BE_DELETED`, comprobado dentro de la transacción.
- Prisma `P2034` devuelve 409 `ACCOUNT_ERASURE_CONFLICT`; no hay supresión parcial y el usuario puede reintentar.
- Borrar PERSONAL/ADMIN conserva las notificaciones ajenas, incluidas pendientes; solo neutraliza el comentario del actor en texto/HTML. Los avisos propios sí se borran.
- Cambio global de autenticación: el guard consulta la cuenta en PostgreSQL por cada petición autenticada. Desactivadas y suprimidas reciben 401 inmediatamente, incluso con JWT vigente. Detalles y coste de la lectura en D-12 de `docs/arquitectura.md`.
- Las fichas no vinculadas por `requesters.user_id` no se suprimen por mera coincidencia de correo/documento: véase el límite y la verificación de titularidad en `docs/datos-personales.md`.

La limpieza de avisos ajenos escribe lotes de hasta 500 filas con un único
`UPDATE ... FROM (VALUES ...)` parametrizado por lote, dentro de la transacción.
No ejecuta un UPDATE por notificación. El mapeador elimina también las apariciones
restantes del comentario y sus variantes escapadas en HTML si cambia la plantilla;
las pruebas incluyen el generador real del correo y formatos alternativos.
Los conflictos nativos de SQL (40001/40P01, cuando Prisma los envuelve en P2010)
se traducen al mismo 409 de reintento que P2034; otros errores SQL no se ocultan.
