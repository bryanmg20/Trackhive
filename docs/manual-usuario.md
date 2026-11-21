# Manual de usuario (personal del CLENA)

> Estado: pendiente (Sprint 3)

## 1. Qué es Trackhive

(Descripción breve del sistema y para qué sirve.)

## 2. Acceso al sistema

- URL:
- Cómo iniciar sesión y recuperar la contraseña.
- Roles: administrador, personal del CLENA, usuario público.

## 3. Gestión de solicitudes de consulta

### Registrar una solicitud
(Pasos con capturas.)

### Cambiar el estado de una solicitud
Estados: recibida, en búsqueda, disponible, agendada, atendida, cerrada, rechazada.

### Rechazar una solicitud

## 4. Agenda de citas

(Ver el calendario, agendar, reprogramar, controlar la disponibilidad del material.)

## 5. Notificaciones por correo

Cada vez que la solicitud cambia de estado, el solicitante recibe un correo en pocos segundos. Eso incluye pasarla a «En búsqueda», «Disponible», «Atendida», «Cerrada» o «Rechazada» desde «Cambiar estado», y también agendar la cita. El personal no tiene que hacer nada más.

El correo indica el radicado, el nuevo estado y el material solicitado. Si se agendó una cita, también trae el día y el horario de atención. Si se rechazó, trae el motivo que escribió el personal. Los comentarios de los demás cambios no se envían.

Si el servidor de correo falla, el cambio de estado se guarda igual y el correo se reintenta solo. Ver «Correos al solicitante» en el manual de operación.

## 6. Reportes

(Tiempos de atención: pendiente.)

**Material más solicitado.** En el menú, **Reportes** abre el ranking de los
materiales por número de solicitudes, del más pedido al menos pedido. Sirve
para decidir qué material conservar o atender primero. Cuenta las solicitudes
de cualquier estado, y una solicitud cuenta una sola vez por cada material que
incluye. Los materiales con el mismo número de solicitudes comparten puesto.

- Sin fechas, el ranking cuenta todo el historial. Con «Registradas desde» y
  «Registradas hasta» y el botón «Aplicar fechas», solo cuenta las solicitudes
  registradas en esos días (ambos incluidos, hora de Colombia). «Quitar fechas»
  vuelve al historial completo.
- «Mostrar» elige cuántos materiales ver: 10, 20 o 50.
- Cada barra es proporcional al material más pedido, y al lado se lee el
  número exacto de solicitudes.

**Tiempos de atención (solo administrador).** La opción **Tiempos de atención**
del menú muestra el promedio desde Recibida hasta Atendida y cuántas solicitudes
se consideraron. Incluye las solicitudes que después se cerraron. El tiempo
incluye noches y fines de semana; no corresponde a horas hábiles.

«Radicadas desde» y «Radicadas hasta» filtran por la fecha en que se recibió
la solicitud, en hora de Bogotá y con ambos días incluidos. Pulse «Aplicar
fechas» para consultar y «Quitar fechas» para volver al historial completo.
La duración se mide hasta la atención, aunque haya terminado después del rango.

Cada tarjeta muestra el tiempo promedio y el número de solicitudes que pasaron
por ese estado. Las solicitudes que omitieron un estado no cuentan como cero;
por eso los tamaños de muestra pueden variar. Si una solicitud volvió al mismo
estado, sus permanencias se suman antes de calcular el promedio. «Sin datos»
significa que no hay observaciones; «0 s» indica un tiempo registrado de cero.
El personal y los usuarios públicos no pueden abrir este reporte.

**Exportar reportes (solo administrador).** En Material más solicitado y
Tiempos de atención, consulte el reporte y pulse **Exportar CSV**. Se descarga
un archivo con los filtros aplicados y, en el ranking, el límite seleccionado.
Si editó las fechas, pulse primero «Aplicar fechas»; los cambios sin aplicar
no afectan la descarga. La exportación vuelve a consultar los datos con esos
criterios, por lo que incorpora las actualizaciones registradas desde la consulta.

El archivo incluye encabezados y acentos. El nombre identifica su periodo.
En tiempos de atención, los promedios se expresan en segundos y una celda vacía
significa «Sin datos», no cero. Si el ranking está vacío se descargan únicamente
sus encabezados. El personal y el público no disponen de esta acción.

## 7. Gestión de usuarios

Solo el administrador ve la opción **Usuarios** en el menú. Ahí están las
cuentas del personal del CLENA (rol Personal o Administrador). Las cuentas de
los usuarios públicos no aparecen.

**Buscar.** Escriba un nombre, un apellido o un correo y pulse «Buscar». Con
los filtros de la izquierda puede ver solo un rol o solo las cuentas activas o
desactivadas. «Ordenar por» cambia el orden: apellido, nombre, correo, rol o
fecha de creación.

**Crear una cuenta.** Pulse «Crear cuenta del personal» y llene el primer
nombre, el primer apellido, el correo y una contraseña inicial de al menos 8
caracteres. El segundo nombre y el segundo apellido son opcionales. La cuenta
se crea siempre con rol Personal, queda activa y la persona puede iniciar
sesión de inmediato con ese correo y esa contraseña. Entréguele la contraseña
por un canal seguro. Si el correo ya tiene una cuenta, el sistema no crea otra.

**Editar una cuenta.** Pulse «Editar» en la fila para cambiar los nombres o el
correo. El rol y la contraseña no se cambian desde aquí: una cuenta de personal
no puede pasar a administrador.

**Desactivar una cuenta.** Pulse «Desactivar» y confirme. La persona ya no
puede iniciar sesión. Las solicitudes que registró y su historial se conservan.
Si ya tenía la sesión abierta, la pierde a más tardar en 15 minutos. Para
devolverle el acceso, pulse «Activar».

No puede desactivar su propia cuenta.

## 8. Protección de datos personales

(Aviso de privacidad, consentimiento y eliminación de cuenta.)

## 9. Preguntas frecuentes y solución de problemas
