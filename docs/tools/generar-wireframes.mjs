/** Documentation-only wireframes using the CLENA Figma identity. */
import { scene, title, note, field, button, box, text, area, panel, table, pagination, writeManifest } from './wireframe-theme.mjs';

scene('WF-01', 'inicio-sesion', 'Inicio de sesión', 'Sin sesión', '/login', 'Pantalla existente', () => {
  panel(350, 205, 580, 600, 'Acceso a Trackhive');
  note(390, 273, 'Entre con el correo y la contraseña de su cuenta.', 500);
  field(390, 330, 'Correo electrónico *', 'persona@example.com');
  field(390, 425, 'Contraseña *', '********     [ Mostrar ]');
  box(390, 520, 500, 70, '#eeeeee');
  note(405, 537, 'Variante de error: correo o contraseña incorrectos. Conservar el correo escrito.', 470);
  button(390, 625, 'Iniciar sesión', 500, true);
  text(390, 700, 'Crear cuenta -> WF-02', 17, 500);
  note(350, 845, 'Destino al entrar: PUBLICO -> WF-04; PERSONAL / ADMIN -> WF-09.', 650);
}, 'Móvil: tarjeta de una columna. Etiquetas visibles, foco y mensajes asociados al formulario.');

scene('WF-02', 'registro', 'Registro público', 'Sin sesión', '/registro', 'Existente · HU-73 integrada', () => {
  title(48, 182, 'Cree su cuenta');
  note(48, 220, '* Obligatorio. Los datos de caracterización se guardan una sola vez.');
  field(48, 273, 'Primer nombre *', 'Ana', 270);
  field(338, 273, 'Segundo nombre (opcional)', '', 270);
  field(48, 366, 'Primer apellido *', 'Pérez', 270);
  field(338, 366, 'Segundo apellido (opcional)', '', 270);
  field(48, 459, 'Correo electrónico *', 'ana@example.com', 560);
  field(48, 552, 'Contraseña * · mínimo 8 caracteres', '********    [ Mostrar ]', 560);
  field(48, 645, 'Confirmar contraseña *', '********    [ Mostrar ]', 560);
  panel(662, 273, 570, 464, 'Datos de caracterización');
  field(686, 340, 'Municipio o distrito *', 'Barranquilla', 522);
  field(686, 434, 'Rango de edad *', '18–28', 522, true);
  field(686, 528, 'Grupo poblacional (opcional)', 'PREFIERO NO RESPONDER', 522, true);
  note(686, 622, 'Once opciones del formato del CLENA, en MAYÚSCULAS y sin numeración. Puede quedar vacío.', 510);
  note(48, 765, '[ ] Acepto el aviso de privacidad.  [ Ver aviso completo y finalidad de los datos ]');
  button(48, 825, 'Crear cuenta', 270, true);
  text(350, 837, 'Ya tengo cuenta -> WF-01', 17, 500);
  note(48, 886, 'Éxito: cuenta creada y acceso al login. Error: correo duplicado o validación junto al campo.');
}, 'Móvil: nombres y paneles apilados. El aviso comienza sin aceptar; no repetir datos al radicar.');

scene('WF-03', 'mi-perfil', 'Mi perfil', 'PUBLICO / PERSONAL / ADMIN', '/mi-perfil', 'Pantalla existente · HU-73', () => {
  title(180, 192, 'Mi perfil');
  note(180, 240, 'Ana Pérez · ana@example.com  /  Identidad de la sesión, sin elegir otro usuario.', 920);
  panel(180, 300, 920, 450, 'Datos de caracterización');
  field(210, 367, 'Municipio o distrito *', 'Soledad', 860);
  field(210, 467, 'Rango de edad *', '29–59', 860, true);
  field(210, 567, 'Grupo poblacional (opcional)', 'PREFIERO NO RESPONDER', 860, true);
  note(210, 671, 'Cargar los valores guardados. Los perfiles anteriores pueden tener campos vacíos.', 850);
  button(180, 790, 'Guardar cambios', 250, true);
  note(470, 800, 'Confirmación: datos guardados. Si falla, conservar lo escrito.', 630);
}, 'Móvil: una columna. Guardar no cambia el correo, la contraseña ni el rol de la cuenta.');

function materialSearch(staff = false) {
  title(48, 181, staff ? 'Material · Personal del CLENA' : 'Buscar material');
  field(330, 235, 'Título, autor, colección o código', 'Actas', 670);
  button(1020, 261, 'Buscar', 210, true);
  panel(48, 236, 250, 568, 'Filtros');
  field(65, 310, 'Tipo', 'Todos', 216, true);
  field(65, 410, 'Colección', 'Todas', 216, true);
  field(65, 510, 'Estado', 'Todos', 216, true);
  button(65, 635, 'Quitar filtros', 216);
  note(330, 340, '30 resultados     Orden: título [v]     Copia digital: propuesta HU-140', 900);
  table(330, 395, staff ? [135, 240, 130, 150, 245] : [150, 280, 140, 170, 160], ['Código', 'Material', 'Tipo', 'Estado', 'Copia digital'], [
    ['TH-DOC-0001', 'Actas del cabildo', 'Documento', 'Disponible', staff ? 'Sí\nACTA-2024-001.pdf' : 'Disponible en digital'],
    ['TH-PER-0002', 'Prensa histórica', 'Periódico', 'Disponible', 'No'],
    ['TH-NOT-0003', 'Protocolo notarial', 'Protocolo', 'Restauración', staff ? 'Para revisión: código duplicado o inválido' : 'No'],
  ], 88);
  note(330, 755, staff ? '[ Cambiar estado ]  [ Registrar solicitud WF-08 ]  [ Nuevo material WF-05 ]' : '[ Seleccionar materiales ]  [ Solicitar WF-07 ]', 900);
  pagination(830);
  if (staff) note(48, 880, 'Personal: nombre de archivo, nunca ruta o unidad. Marcar revisión. Sincronización WF-14: solo ADMIN.');
  else note(48, 880, 'Sin ubicación física, rutas del disco ni enlaces de descarga. El indicador informa existencia, no acceso.');
}
scene('WF-04', 'busqueda-material', 'Búsqueda de material', 'PUBLICO', '/materiales', 'Existente + propuesta HU-140', () => materialSearch(), 'Móvil: filtros plegables y resultados en tarjetas; conservar selección, filtros y paginación.');

scene('WF-05', 'formulario-material', 'Formulario de material', 'PERSONAL / ADMIN', '/personal/materiales/nuevo (propuesta)', 'Propuesta · HU-06 / HU-49', () => {
  title(48, 185, 'Registrar material');
  note(48, 225, 'Volver a Material -> WF-15. Los campos específicos dependen del tipo.');
  panel(48, 280, 560, 570, 'Datos del catálogo');
  field(70, 345, 'Código de catalogación *', 'TH-DOC-0001', 516);
  field(70, 435, 'Título *', 'Actas del cabildo', 516);
  field(70, 525, 'Tipo *', 'Documento', 516, true);
  field(70, 615, 'Autor (opcional)', '', 516);
  field(70, 705, 'Colección *', 'Archivo histórico', 516);
  panel(655, 280, 577, 570, 'Ubicación y disponibilidad · solo personal');
  field(678, 345, 'Depósito *', 'Depósito 1', 530);
  field(678, 435, 'Estantería *', 'Estante 3', 530);
  field(678, 525, 'Caja *', 'Caja 12', 530);
  field(678, 615, 'Estado inicial *', 'Disponible', 530, true);
  note(678, 715, 'Para periódicos: fecha de publicación y editorial opcionales. La copia digital se consulta; no añadir apertura ni descarga de archivos.', 510);
  button(48, 880, 'Guardar material', 250, true);
  button(320, 880, 'Cancelar', 180);
}, 'Móvil: catálogo seguido de ubicación. Código duplicado y campos inválidos se muestran junto al campo.');

scene('WF-06', 'mis-solicitudes', 'Mis solicitudes', 'PUBLICO', '/mis-solicitudes', 'Pantalla existente', () => {
  title(48, 185, 'Mis solicitudes');
  field(48, 245, 'Estado', 'Todos', 300, true);
  field(380, 245, 'Orden', 'Más recientes primero', 400, true);
  button(920, 271, 'Buscar material', 310);
  table(48, 365, [210, 320, 230, 230, 194], ['Radicado', 'Material', 'Fecha deseada', 'Estado', 'Modalidad'], [
    ['SOL-2026-001', 'Actas del cabildo', '15/12/2026', 'Recibida', 'Presencial'],
    ['SOL-2026-002', 'Prensa histórica', '17/12/2026', 'Rechazada', 'Digital'],
  ], 112);
  panel(48, 680, 1184, 95, 'Motivo visible para una solicitud rechazada');
  note(65, 733, 'El material se encuentra en restauración. No mostrar comentarios internos.');
  pagination(825);
  note(48, 890, 'Solo solicitudes propias. Lista vacía: buscar material para iniciar una solicitud.');
}, 'Móvil: una tarjeta por solicitud. Conservar filtros, estado legible y motivo de rechazo.');

scene('WF-07', 'radicar-solicitud', 'Radicar solicitud', 'PUBLICO', '/solicitudes/nueva?materiales=…', 'Pantalla existente', () => {
  title(48, 185, 'Radicar solicitud');
  panel(48, 265, 540, 385, 'Materiales seleccionados');
  text(70, 335, '[x] TH-DOC-0001 · Actas del cabildo', 18, 490);
  text(70, 403, '[x] TH-PER-0002 · Prensa histórica', 18, 490);
  button(70, 535, 'Cambiar materiales', 300);
  panel(640, 265, 592, 550, 'Motivo y entrega');
  area(662, 330, 'Motivo de la consulta *', 'Consulta para una investigación histórica.', 548, 110);
  field(662, 500, 'Fecha deseada *', '15/12/2026', 548);
  note(662, 582, 'Al menos diez días hábiles de anticipación; atención de lunes a sábado.', 525);
  text(662, 655, 'Modalidad: (o) Presencial   ( ) Digital', 17, 535);
  button(662, 728, 'Enviar solicitud', 548, true);
  note(48, 700, 'Identidad y caracterización: se reutilizan desde el solicitante. No volver a pedirlas.', 520);
  note(48, 865, 'Éxito: mostrar radicado y enlace a Mis solicitudes (WF-06). Error: conservar el formulario.');
}, 'Móvil: materiales arriba y formulario debajo. La fecha es un día, no una franja horaria.');

scene('WF-08', 'solicitud-personal', 'Registro por el personal', 'PERSONAL / ADMIN', '/personal/solicitudes/nueva?materiales=…', 'Pantalla existente · HU-10 / HU-73', () => {
  title(48, 185, 'Ficha de solicitud');
  panel(48, 255, 560, 650, '01 · Solicitante');
  field(70, 320, 'Correo del solicitante *', 'visitante@example.com', 355);
  button(445, 346, 'Buscar', 140, true);
  note(70, 408, 'Encontrado: mostrar datos guardados, sin pedirlos otra vez. Nuevo: habilitar los campos siguientes.', 505);
  field(70, 480, 'Primer nombre / primer apellido *', 'Ana / Pérez', 516);
  field(70, 570, 'Municipio o distrito *', 'Barranquilla', 516);
  field(70, 660, 'Rango de edad *', '18–28', 245, true);
  field(335, 660, 'Grupo (opcional)', 'SIN SELECCIONAR', 250, true);
  note(70, 765, '[ + ] Segundos nombres, teléfono y datos adicionales opcionales.', 505);
  note(70, 830, 'Grupo: catálogo de once opciones en MAYÚSCULAS; aceptar no responder.', 505);
  panel(655, 255, 577, 650, '02 · Material y entrega');
  text(678, 325, 'TH-DOC-0001 · Actas del cabildo', 18, 525);
  text(678, 370, '[ Cambiar materiales -> WF-15 ]', 16, 525);
  area(678, 430, 'Motivo *', 'Describa la consulta recibida.', 530, 90);
  field(678, 580, 'Fecha deseada *', '15/12/2026', 530);
  text(678, 690, '(o) Presencial   ( ) Digital', 17, 525);
  button(678, 775, 'Registrar solicitud', 530, true);
  note(678, 839, 'Éxito: comprobante con radicado y Registrar otra solicitud.', 515);
}, 'Móvil: solicitante antes de material. Probar ramas encontrado / nuevo y conservar el correo en errores.');

scene('WF-09', 'listado-personal', 'Listado de solicitudes del personal', 'PERSONAL / ADMIN', '/solicitudes', 'Existente · HU-12 / HU-141', () => {
  title(48, 182, 'Solicitudes');
  field(330, 232, 'Solicitante: nombre, correo o documento', 'Ana', 670);
  button(1020, 258, 'Buscar', 210, true);
  panel(48, 232, 250, 620, 'Filtros');
  field(65, 300, 'Estado', 'Todos', 216, true);
  field(65, 395, 'Material', '', 216);
  field(65, 490, 'Fecha desde', '', 216);
  field(65, 585, 'Fecha hasta', '', 216);
  button(65, 740, 'Quitar filtros', 216);
  note(330, 335, '25 solicitudes   Orden: fecha de radicación [v]   [ Registrar visitante -> WF-08 ]', 900);
  table(330, 395, [175, 170, 205, 170, 180], ['Radicado', 'Solicitante', 'Material', 'Fecha deseada', 'Estado'], [
    ['SOL-2026-001', 'Ana Pérez', 'Actas del cabildo', '15/12/2026', 'Recibida'],
    ['SOL-2026-002', 'Luis Rojas', 'Prensa histórica', '17/12/2026', 'En búsqueda'],
    ['SOL-2026-003', 'Ana Pérez', 'Protocolo', '18/12/2026', 'Disponible'],
  ], 88);
  note(330, 745, 'Pulsar el radicado -> detalle WF-10. Carga inicial / vacío / error con mensaje.', 900);
  pagination(820);
  note(48, 886, 'Actualizar cada 30 s y al volver a la pestaña. Oculta: no consultar. Conservar filtros, página y scroll.');
}, 'Móvil: filtros plegables y tabla en tarjetas. Una actualización en segundo plano no retira los resultados.');

scene('WF-10', 'detalle-solicitud', 'Detalle y cambio de estado', 'PERSONAL / ADMIN', '/solicitudes/:id', 'Existente + propuesta HU-140', () => {
  title(48, 182, 'SOL-2026-001 · Detalle de solicitud');
  note(48, 225, 'Solicitante: Ana Pérez · Entrega presencial · Fecha deseada: 15/12/2026');
  panel(48, 280, 1184, 205, 'Material solicitado · copia digital HU-140');
  text(70, 342, 'TH-DOC-0001 · Actas del cabildo     [ COPIA DIGITAL: SÍ ]', 19, 1120);
  note(70, 383, 'Nombre de archivo: ACTA-2024-001.pdf. Sin ruta ni unidad; no abre ni descarga el archivo.', 1110);
  note(70, 419, 'Variante de revisión: [ REVISAR MATERIAL: CÓDIGO DUPLICADO / SIN CÓDIGO VÁLIDO ].', 1110);
  note(70, 453, 'Ubicación física (solo personal): Depósito 1 / Estante 3 / Caja 12.', 1110);
  panel(48, 505, 560, 360, 'Variante A · Estado EN_BUSQUEDA');
  field(70, 570, 'Cambiar a · solo transiciones permitidas', 'Rechazada', 516, true);
  area(70, 665, 'Motivo de rechazo *', 'Describa el motivo para el solicitante.', 516, 70);
  button(70, 790, 'Guardar cambio', 245, true);
  panel(655, 505, 577, 360, 'Variante B · DISPONIBLE + PRESENCIAL');
  field(678, 570, 'Agendar cita · día completo', '15/12/2026', 530);
  note(678, 660, 'Fecha inicial: la deseada. Sin domingos. Validar material y reservas del día.', 515);
  button(678, 740, 'Agendar cita', 530, true);
  note(678, 805, 'DIGITAL: ofrecer Atendida; no mostrar agendamiento.', 510);
  note(48, 892, 'Confirmar responsable y fecha del cambio. Cerrada / Rechazada: sin acciones. Conflicto 409: recargar detalle.');
}, 'Son variantes de estado, no acciones simultáneas. Móvil: material y acciones apilados; rechazo con motivo.');

scene('WF-11', 'calendario', 'Calendario de citas', 'PERSONAL / ADMIN', '/calendario', 'Existente · HU-19', () => {
  title(48, 182, 'Calendario');
  button(48, 240, '< Mes anterior', 200);
  text(290, 250, 'DICIEMBRE 2026', 22, 350);
  button(660, 240, 'Mes siguiente >', 210);
  field(940, 215, 'Filtrar por material', 'Todos', 290, true);
  const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  for (let col = 0; col < 7; col++) {
    box(48 + col * 120, 330, 120, 45, '#e9e9e9');
    text(60 + col * 120, 342, days[col], 17, 96);
    for (let row = 0; row < 5; row++) {
      const x = 48 + col * 120; const y = 375 + row * 94;
      const day = row * 7 + col;
      box(x, y, 120, 94, col === 6 ? '#dedede' : day === 15 ? '#eeeeee' : '#ffffff');
      if (day < 1 || day > 31) continue;
      text(x + 10, y + 10, String(day), 16, 95);
      if (col === 6) note(x + 10, y + 45, 'Cerrado', 98);
      else if ((row + col) % 3 === 0 || day === 15) note(x + 10, y + 45, '2 citas', 98);
    }
  }
  panel(920, 330, 312, 505, 'Día seleccionado');
  text(940, 400, '15/12/2026', 21, 270);
  text(940, 460, 'SOL-2026-001\nAna Pérez\nActas del cabildo', 17, 268);
  button(940, 600, 'Ver solicitud WF-10', 270);
  note(940, 680, 'Las citas son por día completo. La consulta se realiza durante el horario de atención.', 260);
  note(48, 875, 'Agendar desde WF-10. Reprogramar / cancelar: propuestas de HU-21; no asumir que existen.');
}, 'Móvil: mes compacto y lista del día debajo. Citas y estados también expresados con texto.');

scene('WF-12', 'gestion-usuarios', 'Gestión de usuarios del personal', 'ADMIN', '/admin/usuarios (propuesta)', 'Propuesta · HU-05', () => {
  title(48, 182, 'Personal del CLENA');
  field(48, 245, 'Buscar por nombre o correo', '', 700);
  button(780, 271, 'Buscar', 180);
  button(985, 271, 'Crear personal', 245, true);
  table(48, 360, [240, 370, 160, 175, 240], ['Nombre', 'Correo', 'Rol', 'Estado', 'Acciones'], [
    ['Ana Pérez', 'personal1@example.com', 'PERSONAL', 'Activo', 'Editar / Desactivar'],
    ['Luis Rojas', 'personal2@example.com', 'PERSONAL', 'Inactivo', 'Editar / Activar'],
  ], 86);
  panel(48, 635, 735, 265, 'Crear / editar personal · formulario propuesto');
  field(70, 699, 'Primer nombre / apellido *', 'Ana / Pérez', 688);
  field(70, 794, 'Correo *', 'personal@example.com', 688);
  panel(825, 635, 407, 265, 'Confirmación');
  note(845, 705, '¿Desactivar esta cuenta? Conservar solicitudes y responsables históricos.', 365);
  button(845, 820, 'Confirmar', 165, true);
  button(1025, 820, 'Cancelar', 185);
}, 'Solo ADMIN. Alta y credencial inicial por definir en HU-05. No proponer borrado de cuentas con historial.');

scene('WF-13', 'capacidad-sala', 'Capacidad de la sala', 'ADMIN', '/admin/capacidad-sala (propuesta)', 'Propuesta · HU-20.1', () => {
  title(180, 185, 'Capacidad diaria de la sala');
  panel(180, 280, 920, 400, 'Configuración propuesta');
  note(210, 350, 'Límite de citas por día de atención. El valor mostrado es un ejemplo, no una capacidad aprobada.', 850);
  field(210, 445, 'Capacidad diaria * · entero positivo', '20', 860);
  button(210, 560, 'Guardar capacidad', 290, true);
  button(530, 560, 'Ver calendario WF-11', 330);
  panel(180, 725, 920, 150, 'Decisiones para G6');
  note(210, 785, 'Confirmar capacidad, permisos y regla ante reservas existentes. El cambio no debe cancelar citas silenciosamente.', 850);
}, 'Móvil: una columna. Un mensaje explica validación y efecto del cambio; no implementar reglas no acordadas.');

scene('WF-14', 'sincronizacion-everything', 'Sincronización con Everything', 'ADMIN', '/admin/sincronizacion (propuesta)', 'Propuesta · HU-138 · depende de HU-137', () => {
  title(48, 182, 'Sincronización con Everything');
  note(48, 225, 'Solo ADMIN. PERSONAL y PUBLICO no ven esta pantalla; el endpoint debe responderles 403 (HU-138).');
  panel(48, 285, 1184, 220, 'Última sincronización · ejemplo de ejecución correcta');
  text(70, 352, 'Hace 15 minutos  |  125 archivos  |  Terminó correctamente', 23, 1120);
  note(70, 415, 'Al terminar una ejecución, actualizar antigüedad, cantidad, resultado y motivo si hubo error.', 1100);
  button(70, 550, 'Sincronizar ahora', 350, true);
  note(455, 560, 'Sin ejecuciones anteriores: mostrar Sin sincronizaciones, sin inventar resultados.', 740);
  panel(48, 655, 370, 245, 'Variante: en curso');
  note(66, 718, 'Ya hay una sincronización en curso. No se lanzará otra.', 332);
  button(66, 830, 'Sincronizando… [inactivo]', 332);
  panel(455, 655, 370, 245, 'Variante: desactivada');
  note(473, 718, 'La integración con Everything está desactivada.', 332);
  button(473, 830, 'Sincronizar [inactivo]', 332);
  panel(862, 655, 370, 245, 'Variante: error');
  note(880, 718, 'Terminó con error. Motivo: no fue posible conectar con el servicio de búsqueda.', 332);
  note(880, 830, 'Mostrar resultado nuevo; permitir otro intento cuando corresponda.', 332);
}, 'EVERYTHING_ENABLED=false deshabilita la acción. Variantes separadas; sin credenciales ni rutas internas.');

scene('WF-15', 'material-personal', 'Material para personal', 'PERSONAL / ADMIN', '/personal/materiales', 'Existente + propuestas HU-06 / HU-140', () => materialSearch(true), 'Variante del buscador: ubicación y cambio de disponibilidad solo para personal; selección hacia WF-08.');


writeManifest();
