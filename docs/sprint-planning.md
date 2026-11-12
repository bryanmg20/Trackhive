---
title: "Sprint Planning"
subtitle: "Trackhive · Planeación del Sprint 1"
version: "1.0"
date: "2026-11-12"
team: "Equipo Trackhive"
members: "Samuel Ricardo, Bryan Montoya, Alan Garcia, Alvaro Jimenez"
---

# Sprint Planning

Cada sprint dura 2 semanas. La sección se completa el día de la planeación.

## Sprint 1

- **Fecha de planeación:** 2026-11-01
- **Periodo del sprint:** 2026-11-01 a 2026-11-10
- **Milestone en GitHub:** [Sprint 1](https://github.com/bryanmg20/Trackhive/milestone/1) (vence 2026-11-12)
- **Asistentes:** Samuel Ricardo, Bryan Montoya, Alan Garcia, Alvaro Jimenez
- **Grabación:** [Planning Meeting, Sprint 1](https://uninorte-my.sharepoint.com/:v:/g/personal/sdricardo_uninorte_edu_co/IQCLgimGSgZgQKnMHfuxC-5XAZvnr5xnOyg06BmRGS7fokw?nav=eyJyZWZlcnJhbEluZm8iOnsicmVmZXJyYWxBcHAiOiJPbmVEcml2ZUZvckJ1c2luZXNzIiwicmVmZXJyYWxBcHBQbGF0Zm9ybSI6IldlYiIsInJlZmVycmFsTW9kZSI6InZpZXciLCJyZWZlcnJhbFZpZXciOiJNeUZpbGVzTGlua0NvcHkifX0&e=uA4Ejf)

### Objetivo del sprint

Dejar la base técnica del sistema (arquitectura, base de datos, CI y Docker) y un primer flujo completo de solicitudes y citas usable por los tres roles.

### Issues comprometidos

44 issues, 167 puntos. Responsable por usuario de GitHub.

| Issue | Historia | Puntos | Responsable |
|---|---|---|---|
| #1 | HU-01 Registro de usuario público | 3 | SRicardo05 |
| #2 | HU-02 Inicio de sesión con JWT | 5 | bryanmg20 |
| #3 | HU-03 Renovación de sesión (refresh token) | 3 | AlanSan25 |
| #4 | HU-04 Autorización por roles | 5 | bryanmg20 |
| #7 | HU-07 Listar y buscar material | 3 | bryanmg20 |
| #8 | HU-08 Actualizar estado de disponibilidad del material | 3 | bryanmg20 |
| #9 | HU-09 Registrar solicitud como usuario | 5 | doriada |
| #10 | HU-10 Registrar solicitud como personal | 3 | SRicardo05 |
| #11 | HU-11 Consultar mis solicitudes | 3 | AlanSan25 |
| #12 | HU-12 Listar y filtrar solicitudes (personal) | 5 | bryanmg20 |
| #13 | HU-13 Ver detalle de una solicitud | 3 | bryanmg20 |
| #14 | HU-14 Máquina de estados de la solicitud | 5 | AlanSan25 |
| #15 | HU-15 Cambiar estado de una solicitud | 5 | AlanSan25 |
| #16 | HU-16 Rechazar solicitud con motivo | 2 | AlanSan25 |
| #18 | HU-18 Agendar cita de consulta | 8 | bryanmg20 |
| #19 | HU-19 Vista de calendario | 8 | SRicardo05 |
| #20 | HU-20 Control de disponibilidad del material | 8 | SRicardo05 |
| #22 | HU-22 Servicio de envío de correo | 5 | AlanSan25 |
| #23 | HU-23 Notificar al solicitante en cada cambio de estado | 5 | AlanSan25 |
| #28 | HU-28 Navegación y rutas protegidas por rol | 5 | doriada |
| #29 | HU-29 Diseño responsive | 5 | doriada |
| #30 | HU-30 Accesibilidad básica | 3 | doriada |
| #31 | HU-31 Aviso de privacidad y consentimiento | 3 | SRicardo05 |
| #34 | HU-34 Estructura base con Clean Architecture | 5 | bryanmg20 |
| #35 | HU-35 Docker y docker-compose | 5 | doriada |
| #36 | HU-36 Modelo de datos, migraciones y semilla | 3 | AlanSan25 |
| #37 | HU-37 API versionada y documentada | 3 | SRicardo05 |
| #38 | HU-38 Endpoint de salud | 3 | doriada |
| #39 | HU-39 Integración continua | 8 | bryanmg20 |
| #43 | HU-34.1 Diagrama y documentación de arquitectura | 2 | SRicardo05 |
| #44 | HU-36.1 Diagrama entidad-relación | 2 | AlanSan25 |
| #45 | HU-34.2 Modelo de dominio | 2 | AlanSan25 |
| #47 | HU-1.1 Pantalla de registro | 2 | SRicardo05 |
| #48 | HU-2.1 Pantalla de inicio de sesión | 3 | bryanmg20 |
| #50 | HU-7.1 Pantalla de búsqueda de material | 3 | bryanmg20 |
| #61 | HU-35.1 Unificar el .env en la raíz del proyecto | 2 | bryanmg20 |
| #65 | HU-65 Acta de Inception, validación del backlog y evidencias Scrum | 3 | SRicardo05 |
| #67 | HU-67 Informes del modelo de dominio y de datos | 3 | doriada |
| #68 | HU-68 Arquitectura con modelo C4 | 5 | bryanmg20 |
| #70 | HU-70 README completo | 2 | doriada |
| #76 | HU-39.1 Mover el issue a In Progress al crear su rama | 2 | bryanmg20 |
| #84 | HU-3.1 Limpiar refresh tokens vencidos | 2 | AlanSan25 |
| #86 | nginx no reenvía /api al backend (405 en Docker) | 1 | SRicardo05 |
| #93 | HU-10.1 Pantalla para registrar solicitud como personal | 3 | SRicardo05 |

### Decisiones y acuerdos

- Se trabaja una rama por issue (`feat/<issue>-<slug>`) y cada PR cierra su issue con `Closes #n`.
- El alcance del sprint es el milestone [Sprint 1](https://github.com/bryanmg20/Trackhive/milestone/1); lo que no esté ahí va al Sprint 2.
- La arquitectura del backend sigue Clean Architecture con regla de dependencia estricta (decisión D-01 en `docs/arquitectura.md`).
- Prisma como ORM y PostgreSQL como base de datos; los cambios de esquema van por migración, nunca con `db push`.
- La API se publica bajo `/api/v1` y se documenta con Swagger.
- Los DTOs validan la forma y el dominio valida las reglas; el `ValidationPipe` global rechaza campos desconocidos.
- Se acuerdan tres dailies para la semana: 3, 4 y 7 de noviembre.
- Ningún dato real del CLENA entra al repositorio; las semillas son ficticias.

### Riesgos o dependencias

- El envío de correo depende de credenciales SMTP válidas; si fallan, las notificaciones quedan en la tabla de salida con reintentos.
- El modelo de datos bloquea las historias de solicitudes y citas: se prioriza en los primeros días del sprint.
- La validación del backlog por G6 (E2) depende de la disponibilidad del equipo de Introducción.
- El pipeline de CI necesita `prisma generate` antes de lint, pruebas y build.
- La foto y los videos de la visita viven en SharePoint; el repositorio solo guarda enlaces y documentos livianos.

---

## Sprint 2

- **Fecha de planeación:**
- **Periodo del sprint:**
- **Milestone en GitHub:**
- **Asistentes:**
- **Grabación:**

### Objetivo del sprint

### Issues comprometidos

| Issue | Historia | Puntos | Responsable |
|---|---|---|---|

### Decisiones y acuerdos

### Riesgos o dependencias

---

## Sprint 3

- **Fecha de planeación:**
- **Periodo del sprint:**
- **Milestone en GitHub:**
- **Asistentes:**
- **Grabación:**

### Objetivo del sprint

### Issues comprometidos

| Issue | Historia | Puntos | Responsable |
|---|---|---|---|

### Decisiones y acuerdos

### Riesgos o dependencias
