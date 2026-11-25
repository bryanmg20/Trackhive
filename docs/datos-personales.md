# Datos personales de Trackhive

## Alcance y criterio de minimización (HU-32)

Inventario revisado el 25 de noviembre de 2026 contra los formularios, DTOs,
mapeadores y modelo de persistencia de esta rama. Incluye datos que introduce
una persona, datos derivados de su atención y datos recibidos de Everything.
No basta con que un campo sea opcional: debe tener una finalidad concreta,
una fuente y destinatarios delimitados. No se debe reutilizar para otra finalidad
sin revisar este inventario y el aviso correspondiente.

Las justificaciones operativas siguientes explican el uso de los campos
existentes; **no significan que el CLENA haya confirmado todas las finalidades**.
El CLENA confirmó los campos de caracterización de su formato de asistencia,
pero siguen pendientes la finalidad específica de sus reportes, los destinatarios,
la conservación y las garantías para datos sensibles y menores. No se inventan
plazos ni se presenta esa validación como terminada. La demostración usa personas
ficticias. Este documento no sustituye el aviso ni la aceptación del titular.

## Inventario de captura directa

### Cuenta, identidad y contacto

| Dato y ubicación | Dónde se solicita | Justificación operativa | Obligatoriedad y alternativa mínima | Quién lo consulta |
|---|---|---|---|---|
| Primer nombre y primer apellido (`users`, `requesters`) | Registro público; alta de visitante por personal; alta/edición de cuentas del personal | Identificar a la persona en la atención y asociar correctamente su cuenta y solicitudes | Obligatorios al crear una persona; reutilizar el solicitante existente en solicitudes siguientes | Titular en sus vistas; personal y ADMIN para atención; cuentas del personal administradas por ADMIN |
| Segundo nombre y segundo apellido (`users`, `requesters`) | Los mismos formularios de alta y edición de cuentas | Diferenciar homónimos cuando el primer nombre y apellido no bastan | Opcionales; no exigir nombres adicionales ni completar con valores inventados | Mismos destinatarios que el nombre principal |
| Correo (`users.email`, `requesters.email`) | Registro, inicio de sesión, alta/edición de personal y búsqueda/alta de visitante | Autenticar cuentas; localizar un solicitante existente sin volver a capturarlo; enviar avisos de su solicitud | Obligatorio en los flujos actuales, también en mostrador aunque la columna histórica admita NULL; no pedir un segundo correo | Titular; personal/ADMIN en atención; proveedor SMTP al enviar avisos; cuentas de personal solo ADMIN |
| Contraseña y confirmación | Registro, inicio de sesión y creación de cuenta de personal | Proteger el acceso; la confirmación en registro detecta errores de escritura | La confirmación no se envía ni persiste; la contraseña se transforma en hash, no se muestra ni se devuelve | Titular introduce su clave; ADMIN asigna la clave inicial del personal; solo autenticación utiliza el hash |
| Teléfono (`requesters.phone`) | Alta de visitante por personal | Contacto alternativo para coordinar la atención cuando sea necesario | Opcional; el correo es el canal existente. No se pide en registro público ni al radicar una nueva solicitud del mismo titular | Personal y ADMIN al consultar al solicitante |
| Tipo y número de documento (`requesters.document_type`, `document_number`) | Datos adicionales de alta por personal | Distinguir visitantes homónimos y evitar duplicar su registro cuando se utiliza identificación documental; el par tiene unicidad en la base de datos | Opcionales; se puede atender con nombre y correo. No pedir copia, fotografía, fecha de expedición ni documento como requisito general. CLENA debe confirmar cuándo es necesario usar este identificador adicional | Personal y ADMIN en la consulta de solicitante; no se incluyen en el ranking ni en tiempos de atención |
| Tipo de solicitante (`requesters.requester_type`) | Datos adicionales de mostrador | Contextualizar la atención como ciudadano, estudiante, docente, investigador o entidad sin pedir una descripción biográfica | Se puede omitir; el flujo usa `CIUDADANO` por defecto. Ese valor no prueba una declaración del titular ni debe interpretarse como caracterización confirmada | Personal y ADMIN |
| Institución (`requesters.institution`) | Datos adicionales de mostrador | Identificar la entidad vinculada a una consulta institucional, cuando el visitante aporta esa vinculación | Opcional; dejar vacía en consultas personales. No pedir cargo, matrícula, carné ni prueba de afiliación. El uso estadístico adicional debe confirmarse con CLENA | Personal y ADMIN |
| Aceptación del aviso; fecha y versión (`users`, `requesters`) | Casilla de registro público; constancia del flujo de mostrador | Conservar evidencia de qué aviso se aceptó y cuándo | Casilla pública desmarcada por defecto; fecha del servidor y versión vigente, sin firma manuscrita ni imagen de firma. La constancia automática de mostrador es una brecha, descrita más adelante | Titular ve el aviso; backend conserva la constancia; acceso técnico autorizado para soporte/revisión |

### Caracterización (HU-73)

| Dato | Justificación operativa | Captura y minimización | Acceso y estado de confirmación |
|---|---|---|---|
| Municipio o distrito (`requesters.municipality`) | Agrupar territorialmente las personas atendidas, conforme al formato de asistencia solicitado | Obligatorio para nuevos registros públicos y visitantes; hasta 120 caracteres. No pedir barrio, dirección, coordenadas ni ubicación precisa | Titular en «Mi perfil»; personal/ADMIN en búsqueda de solicitante. Finalidad específica del reporte pendiente de CLENA |
| Rango de edad (`requesters.age_range`) | Agrupar la atención por tramos de edad sin guardar fecha de nacimiento ni edad exacta | Obligatorio para nuevos registros: `0-5`, `6-11`, `12-17`, `18-28`, `29-59`, `60+` | Mismos destinatarios; no inferirlo del documento. Garantías para menores pendientes de confirmar |
| Grupo poblacional (`requesters.population_group`) | Caracterización con el catálogo del formato de asistencia solicitado por CLENA | Opcional; una opción, omisión (`NULL`) o `PREFIERO_NO_RESPONDER`. No exigir certificados ni explicaciones; puede revelar datos sensibles | Titular y personal/ADMIN en consulta de solicitante. Necesidad específica, destinatarios de reportes y garantías pendientes de CLENA; no incorporar a JWT, correos ni listados públicos |

Se capturan una sola vez y se reutilizan al radicar; el titular puede editar la
caracterización en «Mi perfil». Los registros históricos sin información quedan
en NULL hasta que se completen, sin inferencias. El perfil toma el usuario de la
sesión y no permite seleccionar otro titular por identificador enviado por cliente.
La edición actual de perfil comprende caracterización, no identidad ni contacto.

### Solicitudes, agenda, materiales y textos libres

| Dato | Fuente y justificación | Minimización y destinatarios |
|---|---|---|
| Materiales seleccionados y referencias escritas (`request_items`, `request_references`) | Radicación pública y por personal; identificar qué se quiere consultar, incluso si no figura en catálogo. Las referencias incluyen tipo, notaría, año, escritura o descripción según el material | Vinculados a su solicitante, revelan intereses de consulta. Solo titular en sus solicitudes y personal/ADMIN para tramitar; no pedir nombres de terceros si basta código o referencia documental |
| Motivo de consulta (`requests.reason`) | Formularios de radicación; orientar la búsqueda y respuesta a la necesidad de consulta | Obligatorio en el flujo actual (10–2000 caracteres); describir el material o necesidad sin historia personal, salud, afiliaciones ni documentos. Titular y personal/ADMIN en el detalle |
| Descripción de requerimiento (`requests.requirement_description`) | API de radicación; precisar un requerimiento adicional que no cubre el motivo | Opcional; no duplicar identidad o contacto. Aunque no haya control visible en una pantalla, la API admite este dato y queda inventariado |
| Fecha deseada y modalidad (`desired_date`, `delivery_mode`) | Radicación; coordinar consulta presencial o digital y orientar su tramitación | Solo día, sin dirección de domicilio; no pedir horarios detallados ni una nueva identificación. Titular y personal/ADMIN |
| Fecha de cita, reprogramación, cancelación y asistencia (`appointments`, historial) | Agenda operada por personal/ADMIN; reservar capacidad y registrar si se prestó la atención | Citas por día, sin franjas horarias. La asistencia y sus cambios son datos del servicio asociados al titular, no un perfil de comportamiento. Calendario de atención para personal/ADMIN |
| Comentario de estado o rechazo; comentarios de reprogramación/cancelación | Formularios de atención; explicar una decisión o cambio y mantener trazabilidad | Comentarios opcionales salvo motivo de rechazo; hasta 500 caracteres. No son necesariamente notas internas: el rechazo se comunica al solicitante y el historial tiene vistas para el titular; limitar el texto a información apta para él |
| Observaciones de entrega y devolución (`material_loans.delivery_notes`, `return_notes`) | Personal al prestar y recibir material; registrar incidencias de custodia | Opcionales, hasta 500 caracteres; describir el material y la incidencia, sin añadir datos sensibles del visitante. Personal y ADMIN en gestión de préstamos |
| Motivo de cambio de estado de material (`materials.status_change_reason`) | Personal/ADMIN; explicar disponibilidad, restauración o restricción del material | Texto operativo, no biografía ni datos del solicitante; vinculado al autor del cambio para trazabilidad |
| Autor, editor, título y colección del catálogo (`materials`) | Metadatos del fondo; identificar y encontrar el material. Autor o editor pueden identificar personas naturales | No confundir datos bibliográficos con identidad del solicitante. La búsqueda autenticada devuelve estos campos a PUBLICO, PERSONAL y ADMIN; no colocar información privada de visitantes en títulos o colecciones |
| Búsquedas por nombre/correo/documento; filtros y términos de catálogo | Consulta de solicitantes, usuarios y materiales; localizar registros ya existentes y reducir duplicados | No constituyen una finalidad nueva ni deben convertirse en una lista de contactos. El acceso depende del endpoint; no registrar valores de búsqueda personales innecesariamente en logs |

## Datos generados por el servicio

| Dato y ubicación | Justificación | Minimización y acceso |
|---|---|---|
| Hash de contraseña (`users.password_hash`) | Verificar credenciales sin persistir la clave en claro | No devolverlo en API, correos, logs ni exportaciones |
| Access token; hash y fechas del refresh token (`refresh_tokens`) | Autenticar, renovar y revocar sesiones | Tokens son secretos; no incluir caracterización. No guardarlos en evidencias. El refresh token se persiste como hash; no afirmar que el access token es anónimo |
| Identificadores de cuenta/solicitante y vínculos de solicitud | Asociar atención y aplicar autorización al titular correcto | Los genera el servidor o reutiliza un registro; no pedirlos como un dato personal adicional al usuario |
| Rol, activo y último inicio de sesión (`users`) | Controlar permisos, desactivar acceso y administrar cuentas del personal | Solo ADMIN gestiona cuentas de personal; la sesión usa el rol para autorización. No pedir información de caracterización al crear una cuenta de personal |
| Radicado, fechas de creación/actualización/atención/cierre y anonimización | Seguimiento del trámite y cálculo de tiempos; constancia de procesos técnicos | No son campos para que el visitante los complete; se asocian a su atención. La existencia de `anonymized_at` no prueba que haya un proceso automático de anonimización |
| Tipo, canal de origen, finalidad operativa, prioridad, estado, fecha comprometida y versión de solicitud | Clasificar y coordinar el trámite, calcular compromisos y controlar actualizaciones concurrentes | Metadatos del servicio vinculados al titular; no justifican crear otro cuestionario personal. Su uso en reportes debe ser agregado |
| Notas históricas de solicitud o ítem (`requests.notes`, `request_items.note`) | Conservar observaciones de tramitación de registros existentes | La existencia de estas columnas no autoriza ampliar los formularios; si se incorpora su captura, justificar la necesidad y revisar su visibilidad, sin duplicar motivo, identidad o contacto |
| Identificador del personal que crea, atiende, cambia estados, agenda, entrega/devuelve, cambia capacidad o solicita sincronización | Atribuir operaciones y resolver incidencias | Datos personales del personal; no agregar perfiles ni identificadores externos. Los historiales se exponen según sus permisos; no prometer anonimato de quien realiza una acción |
| Notificaciones: correo destinatario, estado, intentos, error y fechas (`notifications`) | Enviar avisos y detectar fallos/reintentos | Acceso técnico autorizado y proveedor SMTP para el envío; no añadir caracterización ni documento. Un error puede contener datos personales: no copiar mensajes completos a issues o capturas |
| Sincronización: solicitante, fechas, estado, conteo y error (`sync_runs`, `sync_agent`) | Auditar la sincronización y saber si el agente está disponible | Pantalla y endpoints de administración para ADMIN; el agente usa su credencial propia. No usar errores para publicar rutas, nombres personales o secretos |
| Reportes agregados y CSV | Compartir cantidades y tiempos de atención con dirección | Sin nombres, correos, documentos ni caracterización del solicitante. CSV solo ADMIN; el título del material sí se exporta en el ranking y debe revisarse si contiene datos de terceros |

## Everything: datos personales indirectos y visibilidad

### Origen y finalidad

Un nombre como `ACTA-2024-001_Perez.pdf` contiene un apellido aunque nadie lo
escriba en un formulario de Trackhive. Se trata como dato personal potencial de
un tercero; el hecho de estar en un archivo del fondo no autoriza a usarlo como
dato de un solicitante ni a publicarlo. Lo mismo aplica a nombres de carpetas,
títulos derivados y rutas que incluyan una persona o un directorio de usuario.

La finalidad operativa de la integración es localizar y asociar copias digitales
al catálogo y conocer su disponibilidad. No extraer apellidos para crear perfiles,
no inferir identidad, edad o grupo poblacional, ni leer contenido de documentos
para enriquecer la cuenta. Trackhive no abre ni descarga los archivos del fondo.

### Qué hace hoy esta rama

| Dato recibido o derivado | Tratamiento actual | Quién puede verlo |
|---|---|---|
| `name`, `path`, tipo, tamaño y modificación de resultados de Everything | El agente transmite la página y `EverythingPageMapper` la valida; el mapper puede recibir archivos y carpetas | Agente/backend y operadores autorizados del origen durante la integración, no una API de listado de archivos para usuarios |
| Nombre de archivo con apellido, como el ejemplo anterior | `SyncPageMapper` descarta resultados `file` antes de persistir las páginas; no se crea un material por cada archivo ni se conserva aquí una lista de sus nombres | No se muestra como nombre de copia digital en las pantallas actuales; tampoco se envía a PUBLICO como dato de archivo |
| Rutas de carpetas | `sync_run_pages.folders` conserva rutas y modificación mientras se completa la corrida; al cerrarla se eliminan sus páginas. La carpeta hoja se asocia a `materials.digital_path` | Acceso interno de sincronización y persistencia; la ruta completa no forma parte del DTO de material ni del detalle de solicitud |
| Código, título, colección y tipo derivados de carpetas | Se guardan como metadatos del catálogo. No existe una garantía general de eliminación de nombres personales contenidos en las etiquetas de origen | La búsqueda autenticada, incluido PUBLICO, puede ver título y colección. El ranking y su CSV pueden reproducir el título. Revisar el nombre de origen y las reglas del catálogo antes de sincronizar información identificable |
| Motivo de revisión y estado/error de corrida | Permiten detectar códigos repetidos, convención inválida o fallos; no justifican difundir rutas o datos personales | Pantalla de sincronización para ADMIN; las respuestas operativas del agente siguen su autenticación propia |

**La ausencia de `digital_path` en la respuesta no garantiza que un título o una
colección no contenga un apellido.** Tampoco el descarte de archivos convierte
toda la integración en anónima. El responsable del origen debe revisar los
metadatos a sincronizar; una excepción requiere revisión, no asumir que todos
los nombres del índice son aptos para el catálogo compartido.

### Regla de minimización para HU-140 y cambios futuros

Cuando se implemente o modifique el indicador de copia digital, el PR debe
comprobar esta separación, además de revisar los títulos y colecciones:

| Destinatario | Información de copia permitida |
|---|---|
| PUBLICO autenticado | Solo disponibilidad («disponible en digital»); sin nombre de archivo, apellido derivado ni ruta |
| PERSONAL y ADMIN | Disponibilidad y, cuando sea necesario para localizar la copia en Everything, solo el nombre base; `ACTA-2024-001_Perez.pdf` puede revelar el apellido y debe limitarse a esa atención |
| Backend/agente y operadores técnicos autorizados | Ruta para asociar la copia y sincronizar, sin convertirla en respuesta de API, enlace, descarga, log o evidencia compartida |

Esta tabla es el criterio para HU-140, no una afirmación de que el indicador por
rol ya exista. No enviar al público un nombre y ocultarlo solo con CSS. No mandar
ruta completa, unidad de disco ni enlace al archivo a los clientes. Los ejemplos
y evidencias deben ser ficticios y no contener rutas o nombres reales.

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

## Formularios y trazabilidad de la revisión

| Formulario o entrada | Datos cubiertos por este inventario | Fuente de verificación |
|---|---|---|
| Registro público | Identidad, correo, contraseña/confirmación, caracterización y aceptación | [RegisterPage](../frontend/src/features/auth/register/RegisterPage.tsx), [esquema](../frontend/src/features/auth/register/register-schema.ts) |
| Inicio de sesión | Correo y contraseña | [LoginPage](../frontend/src/features/auth/login/LoginPage.tsx) |
| Mi perfil | Identidad/correo de lectura y edición de caracterización de la sesión | [perfil](../frontend/src/features/profile/ProfilePage.tsx), [mapeador](../backend/src/requests/application/mappers/my-profile-response.mapper.ts) |
| Registro por personal | Correo de búsqueda, datos del visitante nuevo, solicitud y referencias | [pantalla](../frontend/src/features/requests/StaffNewRequestPage.tsx), [DTO de solicitante](../backend/src/requests/application/dto/requester-request.dto.ts) |
| Radicar solicitud pública | Selección, referencias, motivo, fecha y modalidad; la API también admite descripción de requerimiento | [pantalla](../frontend/src/features/requests/NewRequestPage.tsx), [DTO](../backend/src/requests/application/dto/create-request.dto.ts) |
| Gestión de usuarios | Identidad, correo, clave inicial, rol y activación de personal | [pantalla](../frontend/src/features/users/StaffUsersPage.tsx) |
| Estados, agenda y préstamos | Día, comentarios y observaciones operativas, identidad del actor derivada de sesión | [estado](../frontend/src/features/requests/ChangeRequestStatusForm.tsx), [agenda](../frontend/src/features/requests/ScheduleAppointmentForm.tsx), [observaciones de entrega](../backend/src/requests/application/dto/deliver-material.dto.ts), [devolución](../backend/src/materials/application/dto/return-material.dto.ts) |
| Catálogo, filtros y reportes | Metadatos, términos de búsqueda, fechas/límite y resultados agregados | [búsqueda](../frontend/src/features/materials/MaterialSearchPage.tsx), [mapeador público](../backend/src/materials/application/mappers/material-response.mapper.ts), [CSV](../backend/src/requests/application/mappers/report-csv.mapper.ts) |
| Ingesta de Everything | Metadatos recibidos, carpetas retenidas y campos persistidos | [página recibida](../backend/src/everything/application/mappers/everything-page.mapper.ts), [filtrado de archivos](../backend/src/everything/application/mappers/sync-page.mapper.ts), [material sincronizado](../backend/src/everything/infrastructure/mappers/prisma-synced-material.mapper.ts) |
| Persistencia y relaciones | Datos capturados, derivados, cuentas del personal y trazabilidad | [Modelo Prisma](../backend/prisma/schema.prisma) |

### Revisión obligatoria de cada formulario nuevo o modificado

Antes de aprobar un PR que introduce o amplía una captura, su autor y revisor deben:

1. Identificar todos sus campos en la UI y payload, también los opcionales,
   ocultos, precargados, derivados y recibidos de una integración.
2. Enlazar la fila de este inventario que justifica cada dato; si no existe,
   actualizar primero este documento con finalidad concreta, fuente,
   obligatoriedad, alternativa mínima y quién lo ve. «Puede servir» o «es
   opcional» no son justificaciones.
3. Reutilizar la sesión o solicitante existente antes de pedir otra vez un dato;
   no convertir opcionales en obligatorios sin justificarlo. Considerar rangos
   en vez de fechas precisas y códigos en vez de nombres/documentos.
4. Verificar que DTO, persistencia, respuestas por rol, textos de ayuda, aviso,
   logs, notificaciones y exportaciones respetan la finalidad y visibilidad.
   Si se cambia el aviso, seguir su mecanismo de versión y aceptación.
5. Adjuntar al PR la revisión de campos y, si cambia el comportamiento, las pruebas
   de validación, autorización y exclusión de información en las respuestas.
   Una justificación documental no sustituye una comprobación de permisos.

La [Definition of Done del PR](../.github/pull_request_template.md) exige enlazar
esta justificación. Un campo sin justificación no debe añadirse a un formulario
nuevo ni a su API. No copiar datos personales reales a ejemplos, fixtures,
capturas, issues o reportes de fallos.

## Decisiones pendientes y límites conocidos

- CLENA debe precisar qué reporte necesita cada dato de caracterización, quién
  recibe ese reporte, los plazos de conservación y las garantías de grupos
  poblacionales y menores. La finalidad operativa propuesta está inventariada;
  no se atribuye al CLENA una confirmación adicional que no haya dado.
- Confirmar el uso excepcional de documento e institución frente al mínimo
  nombre/correo. Que existan columnas históricas o sean opcionales no obliga a
  recogerlas. No promover estos datos a requisitos de nuevas pantallas.
- El registro de visitante por personal registra actualmente aceptación al crear
  el solicitante; falta recoger su manifestación expresa. No describir esa
  constancia automática como consentimiento demostrado. Resolver en el flujo
  correspondiente sin inventar una firma ni modificar aceptaciones históricas.
- El aviso público vigente 1.1 incluye caracterización pero conserva la frase
  «No solicitamos datos sensibles», incompatible con las opciones del grupo
  poblacional. Requiere revisión del aviso y de su versionado en el alcance de
  privacidad; este inventario no cambia el texto ni reinterpreta autorizaciones.
- HU-33 debe concretar conservación y anonimización, incluidas copias de
  seguridad, notificaciones, historiales y datos de caracterización. No se
  promete borrado automático ni plazo de retención que el código no implemente.
- HU-140 debe implementar/verificar el indicador por rol. La revisión del origen
  y de títulos/colecciones es necesaria incluso sin exponer rutas completas.
