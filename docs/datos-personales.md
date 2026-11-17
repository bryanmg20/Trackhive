# Datos personales de Trackhive

## Alcance y estado de validación

Inventario de los datos existentes y de la caracterización solicitada en HU-73.
El CLENA confirmó que necesita los mismos campos de su formato de control de
asistencia. **La finalidad específica, los reportes que los usarán, sus
destinatarios y el plazo de conservación están pendientes de confirmar con el
CLENA.** Las finalidades de caracterización indicadas abajo son la propuesta del
issue; no constituyen una validación jurídica ni una autorización para cargar
datos reales. El entorno de demostración utiliza personas ficticias.

## Inventario y minimización

| Dato | Ubicación | Necesidad y finalidad | Obligatoriedad y minimización |
|---|---|---|---|
| Nombres y apellidos | `users`, `requesters` | Identificación y atención del solicitante | Primer nombre y apellido obligatorios; segundos nombres y apellidos opcionales |
| Correo electrónico | `users`, `requesters` | Acceso a la cuenta, identificación y avisos de solicitudes | Obligatorio en los flujos actuales |
| Hash de contraseña | `users` | Autenticación | Nunca se guarda la contraseña en claro ni se devuelve el hash |
| Hash del refresh token | `refresh_tokens` | Renovación y revocación de sesiones | Se almacena el hash y la fecha de expiración |
| Teléfono | `requesters` | Contacto alternativo del visitante | Opcional; no se pide en el registro público |
| Tipo y número de documento | `requesters` | Identificación del visitante; justificación específica pendiente en HU-32 | Opcionales |
| Tipo de solicitante e institución | `requesters` | Contexto de la consulta; justificación específica pendiente en HU-32 | Institución opcional; conservar revisión de HU-32 |
| Municipio o distrito | `requesters.municipality` | Caracterización territorial para la información que el CLENA reporta sobre sus asistentes; finalidad específica pendiente | Obligatorio para nuevos registros. Texto de hasta 120 caracteres. No se solicita dirección ni ubicación precisa |
| Rango de edad | `requesters.age_range` | Caracterización por edades; finalidad específica pendiente | Obligatorio para nuevos registros. Solo `0-5`, `6-11`, `12-17`, `18-28`, `29-59`, `60+`. No se solicita fecha de nacimiento |
| Grupo poblacional | `requesters.population_group` | Caracterización según el formato de asistencia; finalidad específica pendiente | Opcional. Una sola opción del catálogo o `PREFIERO_NO_RESPONDER`. Omitirlo guarda `NULL`; la preferencia explícita se conserva |
| Aceptación, fecha y versión del aviso | `users`, `requesters` | Constancia de aceptación | Registro público con casilla desmarcada por defecto y fecha del servidor. HU-73 actualiza el aviso a `1.1`; las aceptaciones históricas mantienen su versión |
| Solicitudes, citas, historial y correos | Tablas correspondientes | Prestación del servicio, trazabilidad y comunicación | No se agregan datos de caracterización a correos, JWT ni listados públicos |

## Catálogo de grupo poblacional

Opciones del formato proporcionadas por el equipo del proyecto, mostradas en
mayúsculas y sin numeración en registro, mostrador y perfil:

| Valor persistido | Etiqueta visible |
|---|---|
| `COMUNIDADES_NEGRAS_PALENQUERAS` | C. NEGRAS P/QUERAS |
| `PUEBLOS_INDIGENAS` | PUEBLOS INDÍGENAS |
| `DISCAPACIDAD` | POBLACIÓN EN SIT. DE DISCA. |
| `MIGRANTE` | MIGRANTE |
| `PUEBLOS_ROM` | PUEBLOS ROM |
| `VICTIMAS_DEL_CONFLICTO` | VÍCTIMAS DEL CONFLICTO |
| `COMUNIDADES_RURALES` | COMUNIDADES RURALES |
| `MADRES_CABEZA_DE_FAMILIA` | MADRES CABEZA DE FAMILIA |
| `PADRES_CABEZA_DE_FAMILIA` | PADRES CABEZA DE FAMILIA |
| `LGBTIQ_PLUS` | LGBTIQ+ |
| `PREFIERO_NO_RESPONDER` | PREFIERO NO RESPONDER |

## Captura, edición y acceso

- El registro público guarda cuenta y solicitante en una misma transacción.
- El personal recoge la caracterización cuando el visitante es nuevo. Las
  solicitudes siguientes reutilizan el solicitante sin sobrescribir esos datos.
- Cada usuario autenticado consulta y edita su caracterización en «Mi perfil».
  `GET` y `PATCH /api/v1/users/me/profile` toman el identificador del access token,
  sin `@Roles()` ni identificador de usuario enviado por el cliente.
- No se solicitan nuevamente estos campos al radicar una solicitud pública.
- Los registros anteriores quedan en `NULL`; no se inventa ni infiere información.
  Pueden completarse desde «Mi perfil».
- El grupo poblacional puede revelar información sensible. No debe añadirse a
  logs ni mensajes de error. La revisión con CLENA debe definir su tratamiento y
  necesidad, junto con las garantías aplicables a menores de edad.

## Pendientes relacionados

HU-32 debe completar la justificación de los campos históricos. La recolección
expresa del consentimiento de visitantes por personal sigue siendo una brecha
del flujo previo: actualmente se registra como aceptado al crear el visitante.
HU-73 no introduce una firma ni cambia esa constancia histórica. El tratamiento
de aceptaciones anteriores al aviso `1.1`, la conservación y la anonimización de
estos campos deben incluirse en la revisión con CLENA y en HU-33.
