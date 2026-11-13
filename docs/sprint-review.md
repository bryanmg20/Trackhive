---
title: "Sprint Review"
subtitle: "Trackhive · Review del Sprint 1 con el equipo de Introducción (G6)"
version: "1.0"
date: "2026-11-12"
team: "Equipo Trackhive"
members: "Samuel Ricardo, Bryan Montoya, Alan Garcia, Alvaro Jimenez"
---

# Sprint Review

Demo del incremento ante el equipo de Introducción (G6), grabada, con la retroalimentación registrada.

## Sprint 1

- **Fecha:** 2026-11-10
- **Asistentes Backend:** Samuel Ricardo, Bryan Montoya, Alan Garcia, Alvaro Jimenez
- **Asistentes G6:** Alejandro Suarez, Leonardo Romero, Angelo Foliaco, Santiago Hernandez
- **Grabación:** [Review Sprint 1](https://uninorte-my.sharepoint.com/:v:/g/personal/sdricardo_uninorte_edu_co/IQDLIWBA53e0Q7S9-GSQtJKMASQ0e6i5CyGhjkFx0o4xG50?nav=eyJyZWZlcnJhbEluZm8iOnsicmVmZXJyYWxBcHAiOiJPbmVEcml2ZUZvckJ1c2luZXNzIiwicmVmZXJyYWxBcHBQbGF0Zm9ybSI6IldlYiIsInJlZmVycmFsTW9kZSI6InZpZXciLCJyZWZlcnJhbFZpZXciOiJNeUZpbGVzTGlua0NvcHkifX0&e=5VMHMF)

### Incremento presentado

Se demostró el primer MVP de la solución: autenticación con JWT y roles, material consultable, solicitudes para usuario público y personal, citas de consulta, notificaciones por correo, API versionada con Swagger y despliegue con Docker.

| Historia / issue | PR fusionado | Estado de la demo |
|---|---|---|
| #1 Registro de usuario público | PR #63 | Mostrado |
| #2 Inicio de sesión con JWT | PR #79 | Mostrado |
| #3 Renovación de sesión (refresh token) | PR #80 | Mostrado |
| #4 Autorización por roles | PR #81 | Mostrado |
| #7 Listar y buscar material | PR #89 | Mostrado |
| #8 Actualizar estado de disponibilidad del material | PR #99 | Mostrado |
| #9 Registrar solicitud como usuario | PR #91 | Mostrado |
| #10 Registrar solicitud como personal | PR #98 | Mostrado |
| #11 Consultar mis solicitudes | PR #103 | Mostrado |
| #12 Listar y filtrar solicitudes (personal) | PR #100 | Mostrado |
| #13 Ver detalle de una solicitud | PR #102 | Mostrado |
| #14 Máquina de estados de la solicitud | PR #78 | Mostrado |
| #15 Cambiar estado de una solicitud | PR #107 | Mostrado |
| #16 Rechazar solicitud con motivo | PR #108 | Parcial: falta historial de estados (#17) |
| #18 Agendar cita de consulta | PR #110 | Mostrado |
| #19 Vista de calendario | PR #115 | Mostrado |
| #20 Control de disponibilidad del material | PR #121 | Mostrado |
| #22 Servicio de envío de correo | PR #88 | Mostrado |
| #23 Notificar al solicitante en cada cambio de estado | PR #113 | Mostrado |
| #28 Navegación y rutas protegidas por rol | PR #104 | Mostrado |
| #30 Accesibilidad básica | PR #118 | Mostrado |
| #31 Aviso de privacidad y consentimiento | PR #105 | Mostrado |
| #34 Estructura base con Clean Architecture | PR #56 | Mostrado |
| #35 Docker y docker-compose | PR #60 | Mostrado |
| #36 Modelo de datos, migraciones y semilla | PR #58 | Mostrado |
| #37 API versionada y documentada | PR #59 | Mostrado |
| #38 Endpoint de salud | PR #85 | Mostrado |
| #39 Integración continua | PR #57 | Mostrado |
| #43 Diagrama y documentación de arquitectura | PR #52 y PR #53 | Documentación entregada |
| #44 Diagrama entidad-relación | PR #55 | Documentación entregada |
| #45 Modelo de dominio | PR #54 | Documentación entregada |
| #47 Pantalla de registro | PR #82 | Mostrado |
| #48 Pantalla de inicio de sesión | PR #92 | Mostrado |
| #50 Pantalla de búsqueda de material | PR #94 | Mostrado |
| #61 Unificar el .env en la raíz | PR #62 | Mostrado |
| #76 Mover el issue a In Progress al crear su rama | PR #77 | Automatización mostrada |
| #84 Limpiar refresh tokens vencidos | PR #87 | Mostrado |
| #86 nginx no reenvía /api al backend | PR #90 | Mostrado |
| #93 Pantalla para registrar solicitud como personal | PR #101 | Mostrado |

> #29 diseño responsive, #68 arquitectura C4 y #70 README se cerraron el 2026-11-12 (PR #122, #123 y #124), después de esta reunión: se registran en la evidencia siguiente.

### Retroalimentación de G6

| Comentario | Quién lo dijo | Acción (issue creado) |
|---|---|---|
| Aprobaron los avances y estuvieron de acuerdo con los alcances planteados en la reunión y con la demostración del primer MVP de la solución. | Equipo G6: Alejandro Suarez, Leonardo Romero, Angelo Foliaco, Santiago Hernandez | Sin cambios de alcance; se mantiene el backlog acordado |
| Confirmación del alcance: el CLENA recibe solicitudes por correo y el personal las registra, y el usuario público también puede radicarlas por la página. | Equipo G6 | Sin issue nuevo; queda registrado en el acta de inception (#65) |

### Cambios al backlog tras la review

- Se unificaron las pantallas de material del personal (#109, PR #111) y se quitaron entradas de menú que no correspondían al rol (#112, PR #116; #119, PR #120).
- Quedan abiertos para los siguientes sprints: #17 historial de estados, #21 reprogramar o cancelar cita, #24 plantillas de correo, #25–#27 reportes, #32 datos mínimos, #33 eliminar mi cuenta, #40 y #41 pruebas, #42 despliegue y manuales, #46 wireframes, #49 formulario de material, #5 y #6 gestión de usuarios y registro de material, y #67 informes del modelo de dominio y de datos.
- Se difirió el diseño responsive a la revisión de HU-29, que se cerró el 12 de noviembre con el PR #123.
