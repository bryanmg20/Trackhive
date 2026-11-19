/** Independent 360 px compositions. Never scales down the desktop canvas. */
import fs from 'node:fs';
import path from 'node:path';

export function createMobile({ screen, blocks, palette: p, escape: esc, brand }) {
  const width = 360;
  const parts = [];
  let y = 100;
  const notes = [];
  const wrap = (value, size, available) => {
    const limit = Math.max(8, Math.floor(available / (size * 0.62)));
    const words = String(value).replaceAll('->', '→').split(/\s+/)
      .flatMap((word) => word.match(new RegExp(`.{1,${limit}}`, 'gu')) ?? []);
    const lines = []; let line = '';
    for (const word of words) {
      if (line && (line + ' ' + word).length > limit) { lines.push(line); line = ''; }
      line += (line ? ' ' : '') + word;
    }
    return [...lines, line];
  };
  function rect(x, top, w, h, fill = p.white, radius = 16, stroke = 'none', attributes = '') {
    parts.push(`<rect x="${x}" y="${top}" width="${w}" height="${h}" rx="${radius}" fill="${fill}" stroke="${stroke}" ${attributes}/>`);
  }
  function label(x, top, value, size = 14, available = 328, weight = 400, color = p.ink) {
    const lines = wrap(value, size, available);
    const lineHeight = Math.ceil(size * 1.45);
    parts.push(`<text fill="${color}" font-size="${size}" font-weight="${weight}" font-family="Inter,Arial,sans-serif" data-max-width="${available}">${lines.map((line, index) => `<tspan x="${x}" y="${top + size + index * lineHeight}">${esc(line)}</tspan>`).join('')}</text>`);
    return lines.length * lineHeight;
  }
  function heading(value) { y += 12; y += label(16, y, value, 20, 328, 700) + 14; }
  function note(value) {
    const h = wrap(value, 13, 296).length * 19 + 28;
    rect(16, y, 328, h, '#E3ECE9');
    label(32, y + 14, value, 13, 296, 400, '#354E4A'); y += h + 14;
  }
  function button(value, primary = false, disabled = false) {
    const h = Math.max(48, wrap(value, 14, 284).length * 21 + 24);
    rect(16, y, 328, h, disabled ? '#E5E1D9' : primary ? p.yellow : p.white, 24, primary ? 'none' : p.ochre, `data-control="button" data-disabled="${disabled}"`);
    label(36, y + 12, value, 14, 284, 600, disabled ? p.muted : p.ink); y += h + 12;
  }
  function field(name, value, select = false, multiline = false) {
    const labelHeight = label(16, y, name, 14, 328, 600);
    y += labelHeight + 8;
    const h = multiline ? 104 : Math.max(48, wrap(value || 'Escribir…', 14, 268).length * 21 + 24);
    rect(16, y, 328, h, p.white, 12, p.ochre, 'data-control="field"');
    label(30, y + 12, value || 'Escribir…', 14, 268, 400, value ? p.ink : p.muted);
    if (select) parts.push(`<path d="M315 ${y + 21}l6 6 6-6" fill="none" stroke="${p.ink}" stroke-width="2"/>`);
    y += h + 20;
  }
  function paragraph(value) { y += label(16, y, value, 14, 328) + 16; }
  function radioDelivery() {
    heading('Modalidad de entrega');
    for (const [index, name] of ['Presencial', 'Digital'].entries()) {
      rect(16, y, 328, 48, p.white, 12, p.ochre, 'data-control="radio"');
      parts.push(`<circle cx="38" cy="${y + 24}" r="10" fill="white" stroke="${p.ink}"/>${index === 0 ? `<circle cx="38" cy="${y + 24}" r="5" fill="${p.ink}"/>` : ''}`);
      label(60, y + 13, name, 14, 264); y += 58;
    }
  }
  function record(headings, row) {
    const start = y; const content = [];
    const original = parts.length;
    y += 18;
    headings.forEach((name, index) => {
      if (name === 'Acciones') return;
      y += label(32, y, name.toUpperCase(), 11, 296, 600, p.muted) + 4;
      y += label(32, y, row[index], 14, 296, name === 'Estado' ? 700 : 500) + 13;
    });
    content.push(...parts.splice(original));
    rect(16, start, 328, y - start + 4, p.white, 20);
    parts.push(...content); y += 20;
    if (['WF-04', 'WF-15'].includes(screen.id)) button('Seleccionar este material');
    if (screen.id === 'WF-09') button('Ver solicitud');
    if (screen.id === 'WF-12') {
      const actions = row[headings.indexOf('Acciones')];
      actions?.split(' / ').forEach((action) => button(action + ' personal'));
    }
  }
  function pagination() {
    paragraph('Página 1 de 3');
    for (const [index, name] of ['← Anterior', 'Siguiente →'].entries()) {
      rect(16 + index * 170, y, 158, 48, p.white, 24, p.ochre, 'data-control="button"');
      label(32 + index * 170, y + 13, name, 14, 126, 500);
    }
    y += 70;
  }

  // Co-branding is placed on a light background; original logo proportions are preserved.
  parts.push(brand('mobile'));
  if (screen.roles === 'Sin sesión') {
    button(screen.id === 'WF-01' ? 'Crear cuenta →' : 'Ya tengo cuenta →');
  } else {
    rect(16, y, 328, 48, p.ink, 24, 'none', 'data-control="menu"');
    parts.push(`<path d="M34 ${y + 17}h18m-18 7h18m-18 7h18" stroke="${p.paper}" stroke-width="2"/>`);
    label(66, y + 13, 'Menú', 14, 100, 600, p.paper);
    label(184, y + 14, screen.roles === 'ADMIN' ? 'ADMIN' : screen.roles === 'PUBLICO' || screen.id === 'WF-03' ? 'PÚBLICO' : 'PERSONAL', 12, 144, 500, p.yellow);
    y += 68;
  }
  y += label(16, y, screen.name, 26, 328, 800) + 12;
  y += label(16, y, screen.description, 14, 328, 400, p.muted) + 22;
  rect(16, y, 328, 112, p.hero, 20, p.ochre, 'stroke-dasharray="6 5" data-photo-placeholder="true"');
  label(34, y + 27, 'FOTOGRAFÍA DE LA CIUDAD', 12, 292, 600);
  label(34, y + 54, 'Espacio reservado · imagen pendiente', 12, 292, 400, p.muted);
  y += 140;

  if (screen.id === 'WF-11') {
    paragraph('DICIEMBRE DE 2026');
    button('← Mes anterior'); button('Mes siguiente →');
    field('Material', 'Todos', true); field('Solicitante', 'Todos');
    note('Capacidad diaria: 15 · valor de ejemplo. La cifra vigente proviene de la configuración de la sala.');
    heading('Martes 15 de diciembre');
    note('4/15 · 4 citas · Capacidad disponible');
    for (const [index, name] of ['Ana Pérez', 'Luis Rojas', 'Marta Díaz', 'José Ruiz'].entries()) {
      record(['Solicitud', 'Solicitante', 'Material', 'Estado'], [`SOL-2026-00${index + 1}`, name, 'Actas del cabildo', 'Programada']);
      button('Ver solicitud → WF-10');
    }
    heading('Miércoles 16 de diciembre');
    note('0/15 · Sin citas');
    heading('Leyenda de ocupación');
    note('12/15 · Cerca del límite (80 %)');
    note('15/15 · Límite alcanzado');
    notes.push('Agenda agrupada por día: todas las citas visibles, sin cuadrícula comprimida ni franjas horarias. Las cifras son ejemplos independientes de la leyenda.');
  } else {
    for (const block of blocks) {
      if (block.kind === 'panel') {
        if (block.value === 'Filtros') {
          button('Filtros · panel desplegado ▾');
          notes.push('El botón Filtros abre/cierra estos campos y expone aria-expanded. En este boceto se muestra abierto para revisar todas las etiquetas.');
        } else heading(screen.id === 'WF-08' && block.value === '01 · Solicitante' ? '01 · Solicitante nuevo' : block.value);
      } else if (block.kind === 'field') field(block.name, block.value, block.select);
      else if (block.kind === 'area') field(block.name, block.value, false, true);
      else if (block.kind === 'button') button(block.value, block.primary, /inactiv/.test(block.value));
      else if (block.kind === 'note') {
        if (block.value.startsWith('[ ] Acepto')) {
          button('Ver aviso de privacidad y finalidad');
          const h = Math.max(64, wrap('Acepto el aviso de privacidad *', 14, 264).length * 21 + 24);
          rect(16, y, 328, h, p.white, 12, p.ochre, 'data-control="checkbox" data-checked="false"');
          rect(30, y + 18, 20, 20, p.white, 4, p.ink);
          label(64, y + 12, 'Acepto el aviso de privacidad *', 14, 264, 500);
          y += h + 18;
        } else if (screen.id === 'WF-10' && block.value.startsWith('Nombre de archivo:')) {
          paragraph('Archivo digital: ACTA-2024-001.pdf');
          notes.push(block.value);
        } else if (screen.id === 'WF-10' && block.value.startsWith('Ubicación física')) paragraph(block.value);
        else if (screen.id === 'WF-10' && block.value.startsWith('Variante de revisión')) note(block.value);
        else if (screen.id === 'WF-13' && block.value.startsWith('Límite configurable')) {
          note('Capacidad predeterminada: 15 citas por día.');
          notes.push(block.value);
        } else if (screen.id === 'WF-13' || /^(Variante de error|Ya hay una sincronización|La integración con Everything|Terminó con error)/.test(block.value)) note(block.value);
        else notes.push(block.value);
      }
      else if (block.kind === 'pagination') pagination();
      else if (block.kind === 'table') {
        if (screen.id === 'WF-09') button('Registrar visitante → WF-08', true);
        heading('Resultados');
        block.rows.forEach((row) => record(block.headings, row));
        if (screen.id === 'WF-04') button('Solicitar materiales seleccionados → WF-07', true);
        if (screen.id === 'WF-15') {
          button('Registrar solicitud con selección → WF-08', true);
          button('Cambiar estado del material');
          button('Nuevo material → WF-05 (propuesta)');
        }
      } else if (block.kind === 'text') {
        if (/\(o\).*Presencial/.test(block.value)) radioDelivery();
        else if (block.value.startsWith('[x]')) {
          button(block.value.replace('[x]', '☑'));
        } else if (block.value.includes('Crear cuenta') || block.value.includes('Ya tengo cuenta')) button(block.value);
        else paragraph(block.value);
      }
    }
    if (screen.id === 'WF-02') {
      // The consent belongs before the submit action; it is inserted in the captured flow below.
      notes.push('El aviso se expande con el teclado. La aceptación nunca aparece marcada por defecto.');
    }
  }

  heading('Notas del boceto · revisión G6');
  note(`${screen.id} · 360 px · ${screen.roles}. ${screen.footer}`);
  for (const value of [...new Set(notes)]) note(value);
  note(screen.roles === 'Sin sesión'
    ? 'Sin menú de sesión. Controles de al menos 44 px; lectura y tabulación de arriba abajo. SVG estático, no prototipo interactivo.'
    : 'Navegación: Menú abre un panel con las opciones del rol. Al cerrar devuelve el foco. Controles de al menos 44 px; lectura y tabulación de arriba abajo. SVG estático, no prototipo interactivo.');
  paragraph(`Ruta: ${screen.route}`);
  paragraph('Fotografías pendientes · Revisión G6 pendiente');
  const height = Math.ceil(y + 20);
  const defs = `<defs><style>@font-face{font-family:Inter;font-style:normal;font-weight:100 900;src:url('assets/InterVariable.woff2') format('woff2')}text{font-kerning:normal}</style></defs>`;
  return { width, height, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="${height}" viewBox="0 0 360 ${height}" role="img" aria-labelledby="title desc"><title id="title">${esc(screen.id + ' ' + screen.name + ' · móvil 360 px')}</title><desc id="desc">Composición móvil independiente. Logos CLENA y Universidad del Norte. Fotografías pendientes. Borrador pendiente de revisión G6.</desc>${defs}<rect width="360" height="${height}" fill="${p.paper}"/>${parts.join('')}</svg>\n` };
}

export function loadBrand(root) {
  const data = (name) => `data:image/png;base64,${fs.readFileSync(path.join(root, 'docs/wireframes/assets', name)).toString('base64')}`;
  const metrics = JSON.parse(fs.readFileSync(path.join(root, 'docs/wireframes/assets/logos.json'), 'utf8'));
  const clena = metrics['clena-horizontal'];
  const university = metrics['uninorte-horizontal'];
  return (variant) => {
    const mobile = variant === 'mobile';
    const height = mobile ? 36 : 52;
    const top = mobile ? 24 : 30;
    const gap = mobile ? 24 : 28;
    const clenaWidth = clena.width * height / clena.height;
    const universityWidth = university.width * height / university.height;
    const left = mobile ? (360 - clenaWidth - universityWidth - gap) / 2 : 64;
    const universityLeft = left + clenaWidth + gap;
    const divider = left + clenaWidth + gap / 2;
    // Both files are cropped to visible alpha bounds: identical height and y
    // now align the marks themselves, rather than unequal transparent margins.
    return `<g data-brand="institutional" data-transparent="true"><image data-logo="clena" href="${data(clena.file)}" x="${left}" y="${top}" width="${clenaWidth}" height="${height}" preserveAspectRatio="xMidYMid meet"/><path d="M${divider} ${top}v${height}" stroke="#D8B477"/><image data-logo="uninorte" href="${data(university.file)}" x="${universityLeft}" y="${top}" width="${universityWidth}" height="${height}" preserveAspectRatio="xMidYMid meet"/></g>`;
  };
}
