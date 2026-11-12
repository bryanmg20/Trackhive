# Evidencias

Los videos y archivos pesados **no se suben al repositorio**; se enlazan aquí.

## Grabaciones de ceremonias y reuniones (Microsoft Teams)

| Fecha | Reunión / ceremonia | Sprint | Enlace a la grabación | Asistentes | Issues / PRs relacionados |
|---|---|---|---|---|---|
| 2026-10-28 | Reunión inicial con G6 | Inception | https://uninorte-my.sharepoint.com/:v:/g/personal/sdricardo_uninorte_edu_co/IQAPT1bjPG6iS5qzZ-p361TjAdQxAtizY0W8F_lSoA6xnFk?nav=eyJyZWZlcnJhbEluZm8iOnsicmVmZXJyYWxBcHAiOiJPbmVEcml2ZUZvckJ1c2luZXNzIiwicmVmZXJyYWxBcHBQbGF0Zm9ybSI6IldlYiIsInJlZmVycmFsTW9kZSI6InZpZXciLCJyZWZlcnJhbFZpZXciOiJNeUZpbGVzTGlua0NvcHkifX0&e=GEebUB | Samuel Ricardo, Bryan Montoya, Alan Garcia, Alvaro Jimenez, Alejandro Suarez, Leonardo Romerom, Angelo Foliaco y Santiago Hernandez | Backlog #1–#42 (creados el mismo día, 22:41); #43, #44, #45 con PR #52, #53, #54, #55 (28–30 oct); #46–#50 creados el 29 oct |
| 2026-11-01 | Planning Meeting | Sprint 1 | https://uninorte-my.sharepoint.com/:v:/g/personal/sdricardo_uninorte_edu_co/IQCLgimGSgZgQKnMHfuxC-5XAZvnr5xnOyg06BmRGS7fokw?nav=eyJyZWZlcnJhbEluZm8iOnsicmVmZXJyYWxBcHAiOiJPbmVEcml2ZUZvckJ1c2luZXNzIiwicmVmZXJyYWxBcHBQbGF0Zm9ybSI6IldlYiIsInJlZmVycmFsTW9kZSI6InZpZXciLCJyZWZlcnJhbFZpZXciOiJNeUZpbGVzTGlua0NvcHkifX0&e=uA4Ejf | Samuel Ricardo, Bryan Montoya, Alan Garcia y Alvaro Jimenez | #34 (PR #56, merge 1 nov 21:20); #39 (PR #57, merge 3 nov) |
| 2026-11-10 | Review Sprint | Sprint 1 | https://uninorte-my.sharepoint.com/:v:/g/personal/sdricardo_uninorte_edu_co/IQDLIWBA53e0Q7S9-GSQtJKMASQ0e6i5CyGhjkFx0o4xG50?nav=eyJyZWZlcnJhbEluZm8iOnsicmVmZXJyYWxBcHAiOiJPbmVEcml2ZUZvckJ1c2luZXNzIiwicmVmZXJyYWxBcHBQbGF0Zm9ybSI6IldlYiIsInJlZmVycmFsTW9kZSI6InZpZXciLCJyZWZlcnJhbFZpZXciOiJNeUZpbGVzTGlua0NvcHkifX0&e=5VMHMF | Samuel Ricardo, Bryan Montoya, Alan Garcia, Alvaro Jimenez, Alejandro Suarez, Leonardo Romerom, Angelo Foliaco y Santiago Hernandez | 41 PRs (PR #58–#121) y 41 issues cerrados entre el 4 y el 10 de nov; cierre del Sprint 1. Detalle por día abajo |

### Detalle de issues y PRs por reunión

Criterio de asignación: un issue o PR se asocia a la reunión cuya ventana (esa reunión hasta la siguiente) contiene su fecha de creación o de merge. Los números corresponden a `bryanmg20/Trackhive`.

**Reunión inicial con G6 (2026-10-28, Inception)**

- No se fusionó ningún PR ese día. La sesión con G6 fue de levantamiento de requisitos: la salida inmediata fue el backlog inicial, con los issues #1–#42 creados esa misma noche a las 22:41.
- Los entregables de Inception llegaron entre el 29 y el 30 de octubre: #43 diagrama y documentación de arquitectura (PR #52 y PR #53), #45 modelo de dominio (PR #54) y #44 diagrama entidad-relación (PR #55).
- El 29 de octubre se sumaron los issues de interfaz: #46 wireframes, #47 pantalla de registro, #48 pantalla de inicio de sesión, #49 formulario de material y #50 búsqueda de material.

**Planning Meeting (2026-11-01, Sprint 1)**

- La reunión definió el alcance del Sprint 1 y el reparto de historias; la ejecución arranca ese mismo día.
- #34 estructura base con Clean Architecture (PR #56, merge el 1 de noviembre a las 21:20), junto con el scaffold de NestJS, Prisma y Vite.
- #39 integración continua (PR #57, merge el 3 de noviembre).

**Review Sprint (2026-11-10, Sprint 1)**

En esta ventana se concentró la ejecución del Sprint 1: 41 PRs fusionados y 41 issues cerrados. De los PRs, 38 aportan contenido y 3 solo sincronizan ramas (#83, #106, #114).

- **4 de noviembre:** #36 modelo de datos, migraciones y semilla (PR #58); #37 API versionada y documentada con Swagger (PR #59); #35 Docker y docker-compose (PR #60).
- **5 de noviembre:** #61 unificación del .env (PR #62).
- **6 de noviembre:** #1 registro de usuario público (PR #63); #76 mover el issue a In Progress al crear la rama (PR #77). También se cerraron #66, #69 y #71 sin PR asociado (quedan como pendientes de justificar o reabrir si aplica).
- **7 de noviembre:** #14 máquina de estados (PR #78), #2 inicio de sesión con JWT (PR #79), #3 refresh token (PR #80), #4 autorización por roles (PR #81), #47 pantalla de registro (PR #82) y #38 endpoint de salud (PR #85).
- **8 de noviembre:** #7 listar y buscar material (PR #89), #22 servicio de correo (PR #88), #84 limpieza de refresh tokens vencidos (PR #87), #86 nginx reenviando `/api` (PR #90) y #48 pantalla de inicio de sesión (PR #92).
- **9 de noviembre:** #8 estado de disponibilidad del material (PR #99), #9 registrar solicitud como usuario (PR #91), #10 registrar solicitud como personal (PR #98), #12 listar y filtrar solicitudes (PR #100), #50 pantalla de búsqueda de material (PR #94), #93 registrar solicitud como personal desde la interfaz (PR #101) y #96 separar nombres y apellidos (PR #97).
- **10 de noviembre:** #11 consultar mis solicitudes (PR #103), #13 detalle de solicitud (PR #102), #15 cambio de estado (PR #107), #16 rechazo con motivo (PR #108), #18 agendar cita (PR #110), #19 vista de calendario (PR #115), #20 control de disponibilidad (PR #121), #23 notificación de cambio de estado (PR #113), #28 rutas protegidas por rol (PR #104), #30 accesibilidad básica (PR #118), #31 aviso de privacidad y consentimiento (PR #105), #109 unificación de pantallas de material (PR #111), #112 quitar «Registrar solicitud» del menú (PR #116) y #119 quitar «Nueva solicitud» del menú (PR #120).

Todo lo fusionado o cerrado después de esta reunión (11 y 12 de noviembre: #29, #68, #70, #75, #95 y PR #122–#127) queda para la siguiente evidencia.

## Material recibido de G6

| Fecha | Material (foto, video, documento) | Enlace | Recibido de |
|---|---|---|---|
| 2026-10-30 | informe proporcionado por los estudiantes de primer semestre tras su visita al clena | https://uninorte-my.sharepoint.com/:b:/g/personal/sdricardo_uninorte_edu_co/IQBM9byALHfTQ6kVF5vY8bkEASzBFEJ2XoA7RwOHic0m0yc?e=8WB0FS | Informe Final Equipo 6 CLENA |

