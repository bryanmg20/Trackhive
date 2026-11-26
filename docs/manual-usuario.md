# Manual de usuario (personal del CLENA)

> Para el personal y el administrador del CLENA. Quien instala y mantiene el
> servidor tiene el [manual de operación](manual-operacion.md).

## 1. Qué es Trackhive

Trackhive registra y sigue las solicitudes de consulta del archivo del CLENA,
desde que llegan hasta que se atienden. Cada solicitud recibe un **radicado**
(por ejemplo `SOL-2026-00001`) con el que se identifica siempre.

- El **público** se registra, busca material en el catálogo, radica sus
  solicitudes y consulta su estado en «Mis solicitudes».
- El **personal** atiende las solicitudes: busca el material, cambia el estado,
  agenda las citas en la sala de lectura, entrega y recibe el material, y
  registra en el mostrador las solicitudes de quien llega sin cuenta.
- El **administrador** hace lo mismo que el personal y además gestiona las
  cuentas del personal, la capacidad de la sala, los reportes de tiempos y la
  sincronización con *Everything*.

El catálogo de material no se escribe a mano: lo trae la sincronización con
las carpetas digitalizadas del CLENA (sección 8).

## 2. Acceso al sistema

- **Dirección:** la que publica el administrador del servidor (manual de
  operación, sección 4). Siempre empieza por `https://`; si se escribe con
  `http://`, el navegador pasa solo a `https://`.
- **Iniciar sesión:** escriba su correo y su contraseña en «Iniciar sesión».
  «Mostrar» deja ver la contraseña mientras la escribe. Si el correo o la
  contraseña no coinciden, el sistema lo dice y conserva el correo escrito.
  Al entrar, el público llega a «Buscar material» y el personal y el
  administrador a «Solicitudes».
- **Primer acceso del administrador:** la cuenta del administrador la crea el
  servidor la primera vez que arranca, con el correo y la contraseña que
  configuró quien lo instaló. Pídale esos datos y cambie la contraseña según
  el manual de operación (sección 8).
- **Cuentas del personal:** las crea el administrador en «Usuarios»
  (sección 7) y entrega la contraseña inicial por un canal seguro.
- **Cuentas del público:** cada persona crea la suya en «Cree su cuenta»,
  con sus nombres, correo, contraseña, municipio o distrito, rango de edad y la
  aceptación del aviso de privacidad.
- **Contraseña olvidada:** Trackhive todavía no tiene recuperación por correo.
  El personal se la pide al administrador; el administrador, a quien administra
  el servidor (manual de operación, sección 8).
- **Cerrar sesión:** en el menú. La sesión también se cierra sola si deja de
  usarse por un tiempo.

| Rol | Opciones del menú |
|---|---|
| Público | Mi perfil, Buscar material, Mis solicitudes |
| Personal | Mi perfil, Solicitudes, Calendario, Material, Reportes |
| Administrador | Las del personal, más Capacidad sala, Tiempos de atención, Usuarios y Sincronización |

## 3. Gestión de solicitudes de consulta

### Ver las solicitudes

**Solicitudes** muestra la bandeja del personal con todas las solicitudes.
Puede filtrarlas por estado, material, solicitante y fechas, y ver solo las que
tienen **referencias por resolver** (material que el solicitante describió por
escrito porque no lo encontró en el catálogo). La tabla se actualiza sola cada
30 segundos sin perder los filtros ni la página. El radicado abre el detalle.

### Registrar una solicitud en el mostrador

Para una persona que llega sin cuenta o que pide ayuda:

1. En **Material**, busque y seleccione el material que pide. Si no está en el
   catálogo, puede agregarlo después como referencia escrita.
2. Pase al registro de la solicitud y escriba el **correo del solicitante**.
   - Si ya existe, se reutilizan sus datos.
   - Si es nuevo, llene sus nombres y su caracterización (municipio o
     distrito y rango de edad); los datos adicionales son opcionales.
3. Complete el motivo, la fecha deseada y la modalidad de entrega (presencial
   en la sala o digital).
4. Si falta material del catálogo, agregue **referencias escritas**: un
   protocolo notarial (notaría, año y número de escritura) u otro material en
   texto libre.
5. Guarde. El comprobante muestra el radicado, que se entrega al solicitante.
   Puede registrar otra solicitud sin perder el material elegido.

El público radica sus propias solicitudes desde «Buscar material»; la fecha
deseada debe tener al menos diez días hábiles de anticipación.

### Cambiar el estado de una solicitud

Estados: **Recibida → En búsqueda → Disponible → Agendada → Atendida →
Cerrada**. Una solicitud Recibida o En búsqueda también puede pasar a
**Rechazada**. Si todo su material ya tiene copia digital, una Recibida pasa
directo a Disponible, sin búsqueda. Una Disponible también se puede cerrar.

En el detalle de la solicitud, en «Cambiar estado», elija el nuevo estado,
escriba un comentario si hace falta y pulse «Guardar cambio». Solo aparecen los
cambios permitidos desde el estado actual:

- **Agendada** solo se alcanza agendando la cita (sección 4).
- Una solicitud **digital** pasa a **Atendida** sin cita, cuando se envía la
  copia. Si el material ya tiene copia digital, el detalle lo indica: no hace
  falta buscarlo en físico.
- **Cerrada** y **Rechazada** son finales: la solicitud ya no admite cambios.
- Si la solicitud tiene referencias sin material y pasa a Disponible, el
  comentario es obligatorio: explique qué se entrega y cómo.
- Si otra persona cambió la solicitud mientras usted la editaba, el sistema
  avisa y no guarda: recargue y vuelva a intentarlo.

Cada cambio queda en el **Historial de estados** con quién y cuándo lo hizo, y
el solicitante recibe un correo (sección 5).

### Asociar material a una referencia escrita

En «Referencias de material no catalogado», mientras la solicitud está
Recibida o En búsqueda, «Asociar material» busca en el catálogo con el texto de
la referencia. Al elegir el material, la referencia queda resuelta y el
material se agrega a la solicitud.

### Rechazar una solicitud

En «Cambiar estado», elija **Rechazada** y escriba el **motivo del rechazo**,
que es obligatorio. El solicitante lo ve en «Mis solicitudes» y en el correo.
Un rechazo no se puede deshacer.

## 4. Agenda de citas

Las citas son en la sala de lectura, por día completo, de lunes a sábado; los
domingos la sala está cerrada. El horario depende del día y se muestra al
agendar.

- **Agendar:** en el detalle de una solicitud **Disponible** y presencial,
  pulse «Agendar cita» y elija la fecha. La solicitud pasa a Agendada. El
  sistema no deja agendar si la sala alcanzó su capacidad diaria o si el
  material ya está reservado para ese día.
- **Calendario:** muestra las citas del mes; puede filtrarlas por material.
  Al elegir un día aparecen sus citas, con enlace a cada solicitud.
- **Reprogramar o cancelar:** en el calendario, en la cita, «Reprogramar o
  cancelar cita». Elija la nueva fecha y pulse «Reprogramar cita», o escriba el
  motivo y pulse «Cancelar cita». El cambio queda en el historial.
- **Asistencia:** el día de la cita, marque «El solicitante asistió» o «El
  solicitante no asistió».
- **Entrega del material en sala:** «Registrar entrega de material» deja el
  material En uso mientras lo consulta el solicitante; «Confirmar devolución»
  lo devuelve a Disponible. Las notas de entrega y devolución son opcionales.
- **Capacidad de la sala (administrador):** en **Capacidad sala**, escriba el
  número máximo de citas por día y pulse «Guardar capacidad».

## 5. Notificaciones por correo

Cada vez que la solicitud cambia de estado, el solicitante recibe un correo en pocos segundos. Eso incluye pasarla a «En búsqueda», «Disponible», «Atendida», «Cerrada» o «Rechazada» desde «Cambiar estado», y también agendar la cita. El personal no tiene que hacer nada más.

El correo indica el radicado, el nuevo estado y el material solicitado. Si se agendó una cita, también trae el día y el horario de atención. Si se rechazó, trae el motivo que escribió el personal. Los comentarios de los demás cambios no se envían.

Si el servidor de correo falla, el cambio de estado se guarda igual y el correo se reintenta solo. Ver «Correos al solicitante» en el manual de operación.

## 6. Reportes

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
Al abrir el CSV directamente en Excel, cada dato aparece en su columna: el archivo
incluye la indicación de separador `sep=,`. En otras herramientas de importación,
seleccione Unicode UTF-16 LE, separador coma y omita esa primera línea antes de los encabezados.
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

## 8. Sincronización con Everything (solo administrador)

Las copias digitales del material están en las carpetas que indexa
*Everything* en el PC del CLENA. Un programa instalado en ese PC, el agente,
las envía a Trackhive una vez al día. Solo el administrador ve la opción
**Sincronización** en el menú.

**Qué muestra.**

- **Última sincronización:** hace cuánto terminó, cuántas carpetas recibió y
  si terminó correctamente o con error. Si terminó con error, muestra el
  motivo, por ejemplo que *Everything* no respondía o que la unidad de red no
  estaba conectada. Si no hubo ninguna, dice «Todavía no hay
  sincronizaciones».
- **Sincronizar ahora:** si hay una sincronización pedida o en curso.
- **Agente del CLENA:** la última vez que el agente se comunicó con Trackhive.
  Si lleva mucho tiempo sin comunicarse, el PC del CLENA puede estar apagado
  o sin internet.

**Sincronizar ahora.** Pulse «Sincronizar ahora» y confirme con «Sí,
sincronizar ahora». La sincronización queda **pedida, esperando al agente**:
el agente pregunta a Trackhive cada minuto mientras el PC del CLENA está
encendido y la hace en ese momento. No hace falta recargar la página: cuando
el agente termina, aparece el resultado nuevo y un aviso dice cómo terminó.

- Si el PC está apagado, la sincronización sigue pedida y la pantalla dice
  hace cuánto se pidió. Se hace cuando el PC se encienda.
- Si ya hay una sincronización pedida o en curso, no se pide otra: la
  pantalla le avisa y basta con esperar el resultado.
- Si la pantalla dice «En curso, sin noticias del agente», el agente dejó de
  enviar carpetas, porque se cerró o perdió la conexión. Puede pedir otra: la
  anterior termina con error sin cambiar nada del catálogo.
- Si dice que la integración con *Everything* está desactivada, el botón no
  está disponible: quien administra el servidor debe configurar el token del
  agente (manual de operación, sección 3).

Una sincronización que termina con error nunca marca materiales como «copia
digital no encontrada». Solo lo hace una que termina completa.

## 9. Protección de datos personales

- Al crear su cuenta, el público acepta el **aviso de privacidad** (Ley 1581 de
  2012). Trackhive guarda la fecha y la versión del aviso aceptado.
- Cada persona ve y corrige su caracterización (municipio o distrito, rango de
  edad y grupo poblacional) en **Mi perfil**. El grupo poblacional es opcional
  e incluye «PREFIERO NO RESPONDER».
- Al registrar una solicitud en el mostrador, informe al visitante el aviso de
  privacidad antes de guardar sus datos.
- No comparta capturas ni exportaciones con datos de los solicitantes fuera
  del CLENA. Los reportes en CSV no incluyen datos personales.
- Las peticiones de una persona para conocer, corregir o suprimir sus datos se
  atienden por el canal que defina el CLENA ([datos-personales.md](datos-personales.md)).

### Eliminar mi cuenta

En **Mi perfil**, pulse **Eliminar mi cuenta**. El diálogo explica que la acción
es irreversible. Marque la confirmación y pulse **Confirmar eliminación**.
**Cancelar** o Escape cierran el diálogo sin eliminar nada; se puede operar con
Tab, Espacio y Enter, también en pantallas de 360 px.

Al terminar verá **Cuenta eliminada**: se han suprimido sus datos personales y
cerrado sus sesiones. Ya no podrá iniciar sesión con la cuenta anterior. Sus
solicitudes se conservan con identidad neutralizada para mantener los reportes.
Si ocurre un error, no se muestra éxito y puede reintentar. El botón no elimina
archivos del fondo ni correos o CSV que ya estén fuera de Trackhive.

Si es la última cuenta ADMIN activa, la eliminación se rechaza y su cuenta sigue
funcionando: debe existir otro administrador activo. Si aparece un conflicto por
otra operación simultánea, no se completó la eliminación y puede reintentar la
confirmación. Ninguno de estos errores cierra la sesión ni muestra éxito.

## 10. Preguntas frecuentes y solución de problemas

| Situación | Qué hacer |
|---|---|
| «Correo o contraseña incorrectos» | Revise el correo y la contraseña con «Mostrar». Si la olvidó, pida una nueva (sección 2). Una cuenta desactivada tampoco entra: hable con el administrador |
| La sesión se cerró sola | Vuelva a iniciar sesión. Pasa tras un tiempo sin usarla o cuando el administrador desactiva la cuenta |
| «No tiene permiso…» | Esa acción es de otro rol, por ejemplo del administrador |
| No se puede agendar un día | La sala está llena ese día, es domingo o el material ya está reservado: elija otra fecha |
| El estado cambió mientras lo editaba | Otra persona guardó primero. Recargue el detalle y vuelva a intentarlo |
| El solicitante no recibió el correo | Revise que el correo esté bien escrito. El sistema reintenta solo; si sigue sin llegar, avise a quien administra el servidor (manual de operación, sección 9) |
| Un material no aparece en el catálogo | Puede no estar digitalizado o la sincronización no lo ha traído. Agréguelo como referencia escrita (sección 3) y revise **Sincronización** (sección 8) |
| «No pudimos conectar con el servidor» | Revise su conexión a internet. Si sigue, avise a quien administra el servidor |
