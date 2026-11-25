<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

Backend de Trackhive: API REST en NestJS con Prisma y PostgreSQL.

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

## Project setup

```bash
$ pnpm install
```

## Compile and run the project

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## Run tests

```bash
# unit tests
$ pnpm run test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ pnpm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).

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
