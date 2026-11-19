/** CLENA visual identity for the documentation wireframes. SVG, not application UI. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMobile, loadBrand } from './wireframe-mobile.mjs';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const out = path.join(root, 'docs/wireframes');
export const WIDTH = 1920;
export const HEIGHT = 1440;
export const screens = [];
export const palette = { paper: '#F4F0E8', white: '#FFFFFF', ink: '#171717', yellow: '#F5C400', ochre: '#D8B477', teal: '#A9C7C5', clay: '#A96F55', line: '#E6D9C5', muted: '#68635B', hero: '#E9DCC5' };
export const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]);
fs.mkdirSync(out, { recursive: true });
let svg, current, firstTitle, mobileBlocks, capturing = false;
const brand = loadBrand(root);
const capture = (block) => { if (capturing) mobileBlocks.push(block); };

function rect(x, y, w, h, fill = palette.white, radius = 24, stroke = 'none', shadow = false, dashed = false) {
  svg.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}" stroke="${stroke}"${dashed ? ' stroke-dasharray="8 7"' : ''}${shadow ? ' filter="url(#card-shadow)"' : ''}/>`);
}
function lines(value, chars) {
  return String(value).split('\n').flatMap((paragraph) => {
    const result = []; let line = '';
    for (const word of paragraph.split(' ')) {
      if (line && (line + ' ' + word).length > chars) { result.push(line); line = ''; }
      line += (line ? ' ' : '') + word;
    }
    return [...result, line];
  });
}
function label(x, y, value, size = 18, width = 1000, color = palette.ink, weight = 400) {
  width = Math.min(width, WIDTH - x - 30);
  const chunks = lines(String(value).replaceAll('->', '→'), Math.max(5, Math.floor(width / (size * 0.59))));
  svg.push(`<text x="${x}" y="${y}" fill="${color}" font-family="Inter,Arial,sans-serif" font-size="${size}" font-weight="${weight}" data-max-width="${width}">${chunks.map((line, index) => `<tspan x="${x}" y="${y + size + index * size * 1.35}">${escape(line)}</tspan>`).join('')}</text>`);
}
function coords(x, y, w = 0, h = 0) {
  const login = current.id === 'WF-01';
  const register = current.id === 'WF-02';
  const sx = login ? 1.15 : register ? 1.5 : 1.28;
  return { x: login ? 1050 + (x - 350) * sx : (register ? 64 : 348) + (x - 48) * sx,
    y: login ? 260 + (y - 205) * 1.05 : 338 + (y - 180) * 1.12,
    w: w * sx, h: h * (login ? 1.05 : 1.12), sx };
}
export function text(x, y, value, size = 17, maxWidth = 1150) {
  capture({ kind: 'text', value });
  const p = coords(x, y, maxWidth);
  label(p.x, p.y, value, size * 1.08, p.w);
}
export function title() { if (firstTitle) { firstTitle = false; return; } }
export function note(x, y, value, w = 1150) {
  capture({ kind: 'note', value });
  const p = coords(x, y, w);
  label(p.x, p.y, value, 16, p.w, palette.muted);
}
export function box(x, y, w, h, fill = '#ffffff', dashed = false) {
  const p = coords(x, y, w, h);
  const colors = { '#ffffff': palette.white, '#eeeeee': '#E1EBE8', '#dedede': '#E2D8C7', '#e9e9e9': palette.paper, '#f6f6f6': '#FBF9F5', '#fafafa': palette.white };
  rect(p.x, p.y, p.w, p.h, colors[fill] ?? fill, 12, palette.line, false, dashed);
}
export function button(x, y, value, w = 210, primary = false) {
  capture({ kind: 'button', value, primary });
  const p = coords(x, y, w, 46);
  const inactive = /inactivo|inactiva/.test(value);
  rect(p.x, p.y, p.w, p.h, inactive ? '#E9E5DE' : primary ? palette.yellow : palette.paper, 26, primary ? 'none' : palette.ochre);
  label(p.x + 18, p.y + 12, value, 17, p.w - 36, inactive ? palette.muted : palette.ink, primary ? 600 : 500);
}
export function field(x, y, name, value = '', w = 500, select = false) {
  capture({ kind: 'field', name, value, select });
  const p = coords(x, y, w, 68);
  label(p.x, p.y, name, 17, p.w, palette.ink, 600);
  const inputY = p.y + 30;
  rect(p.x, inputY, p.w, 48, palette.white, 15, palette.ochre);
  label(p.x + 15, inputY + 12, value || 'Escribir…', 17, p.w - 55, value ? palette.ink : palette.muted);
  if (select) svg.push(`<path d="M${p.x + p.w - 30} ${inputY + 20}l6 6 6-6" fill="none" stroke="${palette.ink}" stroke-width="2"/>`);
}
export function area(x, y, name, value, w = 500, h = 92) {
  capture({ kind: 'area', name, value });
  const p = coords(x, y, w, h);
  label(p.x, p.y, name, 17, p.w, palette.ink, 600);
  rect(p.x, p.y + 30, p.w, p.h, palette.white, 16, palette.ochre);
  label(p.x + 15, p.y + 44, value, 17, p.w - 30, palette.muted);
}
export function panel(x, y, w, h, heading) {
  capture({ kind: 'panel', value: heading.replace('Trackhive', 'CLENA') });
  const p = coords(x, y, w, h);
  rect(p.x, p.y, p.w, p.h, palette.white, 28, 'none', true);
  label(p.x + 22, p.y + 14, heading.replace('Trackhive', 'CLENA'), 21, p.w - 44, palette.ink, 600);
  svg.push(`<path d="M${p.x + 22} ${p.y + 55}h${p.w - 44}" stroke="${palette.line}"/>`);
}
export function table(x, y, widths, headings, rows, rowHeight = 76) {
  capture({ kind: 'table', headings, rows });
  const total = widths.reduce((a, b) => a + b, 0);
  const p = coords(x, y, total, 48 + rows.length * rowHeight);
  rect(p.x - 16, p.y - 18, p.w + 32, p.h + 30, palette.white, 28, 'none', true);
  rect(p.x, p.y, p.w, 48 * 1.12, palette.ink, 12);
  let offset = x;
  widths.forEach((width, index) => {
    const cell = coords(offset, y, width);
    label(cell.x + 12, cell.y + 16, headings[index], 16, cell.w - 24, palette.paper, 500);
    offset += width;
  });
  rows.forEach((row, rowIndex) => {
    offset = x;
    widths.forEach((width, column) => {
      const cell = coords(offset, y + 48 + rowIndex * rowHeight, width, rowHeight);
      const value = row[column];
      if (headings[column] === 'Estado') {
        const color = /Rechaz|Inactiv|Restaur/.test(value) ? '#E8D6CC' : /Recib|Agend|Activo/.test(value) ? '#D3E3E0' : /Disponible|Cerrada/.test(value) ? '#FBE69B' : '#EBD9B8';
        const chipWidth = Math.min(cell.w - 18, Math.max(90, value.length * 8.5 + 26));
        rect(cell.x + 9, cell.y + 17, chipWidth, 31, color, 16);
        label(cell.x + 20, cell.y + 23, value, 15, chipWidth - 20, palette.ink, 500);
      } else {
        label(cell.x + 12, cell.y + 20, value, 16, cell.w - 24);
      }
      offset += width;
    });
    svg.push(`<path d="M${p.x + 12} ${p.y + (48 + (rowIndex + 1) * rowHeight) * 1.12}h${p.w - 24}" stroke="${palette.line}"/>`);
  });
}
export function pagination(y = 820) {
  capture({ kind: 'pagination' });
  const wasCapturing = capturing;
  capturing = false;
  button(770, y, '← Anterior', 130);
  text(921, y + 10, 'Página 1 de 3', 16, 170);
  button(1086, y, 'Siguiente →', 145);
  capturing = wasCapturing;
}

/** Busy-day desktop reference, including HU-142 and configured room capacity. */
export function monthCalendar() {
  const left = 348, top = 500, cellWidth = 152, cellHeight = 124;
  const weekdays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  weekdays.forEach((name, column) => {
    rect(left + column * cellWidth, top, cellWidth, 40, palette.ink, 0);
    label(left + column * cellWidth + 15, top + 9, name, 15, 120, palette.paper, 600);
  });
  for (let index = 0; index < 35; index++) {
    const day = index;
    const column = index % 7, row = Math.floor(index / 7);
    const x = left + column * cellWidth, y = top + 40 + row * cellHeight;
    rect(x, y, cellWidth, cellHeight, column === 6 ? '#E8E1D5' : palette.white, 0, palette.line);
    if (day < 1 || day > 31) continue;
    const count = day === 15 ? 12 : day === 16 ? 15 : day % 4 === 0 && column !== 6 ? 2 : 0;
    label(x + 9, y + 5, String(day), 14, 34, palette.ink, 600);
    const color = count >= 15 ? '#E8C7BA' : count >= 12 ? '#FBE69B' : '#DFEBE8';
    rect(x + 51, y + 6, 91, 22, color, 11);
    label(x + 58, y + 9, column === 6 ? 'Cerrado' : `${count}/15`, 11, 78, palette.ink, 600);
    const names = ['Ana · SOL-001', 'Luis · SOL-002', 'Marta · SOL-003'];
    names.slice(0, Math.min(count, 3)).forEach((name, position) => label(x + 9, y + 31 + position * 18, name, 11, 135));
    if (count > 3) {
      rect(x + 9, y + 91, 132, 26, palette.yellow, 13);
      label(x + 20, y + 95, `+${count - 3} más`, 12, 110, palette.ink, 600);
    }
  }
}

function icon(x, y, type, color = palette.paper) {
  const paths = { file: 'M6 2h9l5 5v15H6z M14 2v6h6 M9 12h8 M9 16h8', home: 'M2 11l10-9 10 9 M5 10v12h14V10 M10 22v-8h4v8', calendar: 'M3 5h18v17H3z M7 2v6 M17 2v6 M3 11h18', user: 'M16 7a4 4 0 1 1-8 0a4 4 0 1 1 8 0 M4 22v-3a8 8 0 0 1 16 0v3', box: 'M3 7h18v15H3z M2 3h20v4H2z M9 12h6', settings: 'M12 3v3 M12 18v3 M3 12h3 M18 12h3 M5 5l3 3 M16 16l3 3 M5 19l3-3 M16 8l3-3 M16 12a4 4 0 1 1-8 0a4 4 0 1 1 8 0' };
  svg.push(`<g transform="translate(${x} ${y})" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[type] ?? paths.file}"/></g>`);
}
function photoSlot(x, y, w, h, dark = false) {
  rect(x, y, w, h, dark ? '#242424' : '#E7D7BC', 20, dark ? '#756953' : palette.ochre, false, true);
  label(x + 20, y + h / 2 - 24, 'FOTOGRAFÍA DE LA CIUDAD', 13, w - 40, dark ? '#D8B477' : '#65543C', 600);
  label(x + 20, y + h / 2 + 2, 'Espacio reservado · imagen pendiente', 12, w - 40, dark ? '#D4C6B2' : '#776650');
}
const descriptions = {
  'WF-01': 'Acceda a los servicios del Archivo Histórico del Atlántico.',
  'WF-02': 'Cree su cuenta y registre sus datos una sola vez.',
  'WF-03': 'Consulte y actualice sus datos de caracterización.',
  'WF-04': 'Explore el catálogo y seleccione el material que necesita consultar.',
  'WF-05': 'Incorpore un material al catálogo y registre su ubicación.',
  'WF-06': 'Consulte el estado y la información de sus solicitudes.',
  'WF-07': 'Complete su consulta y obtenga un código de seguimiento.',
  'WF-08': 'Registre la consulta recibida y los datos del visitante.',
  'WF-09': 'Consulte y atienda las solicitudes de consulta del archivo.',
  'WF-10': 'Revise el material solicitado y gestione la atención.',
  'WF-11': 'Organice las citas de consulta y revise la disponibilidad por día.',
  'WF-12': 'Administre las cuentas del personal del CLENA.',
  'WF-13': 'Configure el límite diario de citas de la sala de consulta.',
  'WF-14': 'Sincronice las referencias de copias digitales y consulte el resultado.',
  'WF-15': 'Consulte el catálogo y gestione la disponibilidad del material.',
};
function shell() {
  rect(0, 0, WIDTH, HEIGHT, palette.paper, 0);
  svg.push(brand('desktop'));
  const guest = current.roles === 'Sin sesión';
  if (guest) {
    label(1410, 49, 'Inicio de sesión', 18, 210, palette.ink, 600);
    rect(1635, 32, 220, 54, palette.yellow, 27);
    label(1670, 47, 'Crear cuenta', 18, 170, palette.ink, 600);
  } else {
    rect(650, 34, 720, 50, palette.white, 25, palette.ochre);
    label(680, 49, 'Buscar por código, título o solicitante', 16, 660, palette.muted);
    rect(1765, 38, 44, 44, palette.teal, 22); icon(1775, 47, 'user', palette.ink);
    rect(1825, 38, 44, 44, palette.yellow, 22); label(1837, 47, 'AP', 17, 30, palette.ink, 600);
    rect(0, 112, 300, HEIGHT - 112, '#202020', 0);
    label(28, 145, 'ARCHIVO HISTÓRICO', 12, 245, '#BEB8AE', 600);
    const publicView = current.roles === 'PUBLICO' || current.id === 'WF-03';
    const items = publicView ? [['Inicio', 'home', 'WF-04'], ['Mis solicitudes', 'file', 'WF-06'], ['Mi perfil', 'user', 'WF-03']]
      : [['Solicitudes', 'file', ['WF-08', 'WF-09', 'WF-10']], ['Archivo', 'box', ['WF-05', 'WF-15']], ['Calendario', 'calendar', 'WF-11'], ['Mi perfil', 'user', 'WF-03']];
    if (current.roles === 'ADMIN') items.push(['Usuarios', 'user', 'WF-12'], ['Capacidad sala', 'settings', 'WF-13'], ['Everything *', 'settings', 'WF-14']);
    items.forEach(([name, glyph, ids], index) => {
      const active = Array.isArray(ids) ? ids.includes(current.id) : ids === current.id;
      const y = 190 + index * 85;
      rect(20, y, 260, 66, active ? palette.yellow : '#303030', 24);
      icon(40, y + 21, glyph, active ? palette.ink : palette.paper);
      label(82, y + 21, name, 19, 180, active ? palette.ink : palette.paper, 600);
    });
    photoSlot(24, 1060, 252, 175, true);
    label(38, 1270, 'Cerrar sesión →', 17, 230, palette.paper, 500);
  }
  if (current.id === 'WF-01') {
    rect(64, 235, 880, 760, palette.hero, 30);
    label(105, 295, 'La historia nos conecta.', 48, 780, palette.ink, 800);
    label(105, 385, 'Consulte el patrimonio documental\ndel Archivo Histórico del Atlántico.', 25, 780);
    photoSlot(105, 535, 795, 365);
  } else {
    const x = guest ? 64 : 348; const w = guest ? 1792 : 1516;
    rect(x, 145, w, 155, palette.hero, 28);
    label(x + 28, 171, current.name, 40, w - 420, palette.ink, 800);
    label(x + 28, 237, descriptions[current.id], 19, w - 420, palette.muted);
    photoSlot(x + w - 335, 160, 315, 125);
  }
}

export function scene(id, slug, name, roles, route, state, draw, footer) {
  current = { id, name, roles }; firstTitle = true; svg = []; mobileBlocks = [];
  shell();
  capturing = true;
  draw();
  capturing = false;
  const left = roles === 'Sin sesión' ? 64 : 348;
  rect(left, 1230, WIDTH - left - 56, 150, '#ECE7DD', 22);
  label(left + 24, 1250, `${id} · ${name} · Borrador para revisión G6`, 17, WIDTH - left - 110, palette.ink, 600);
  label(left + 24, 1284, `${roles} · ${route} · ${state}`, 14, WIDTH - left - 110, palette.muted);
  label(left + 24, 1320, footer, 15, WIDTH - left - 110, palette.muted);
  const file = `${id.toLowerCase()}-${slug}`;
  const defs = `<defs><style>@font-face{font-family:Inter;font-style:normal;font-weight:100 900;src:url('assets/InterVariable.woff2') format('woff2')}text{font-kerning:normal}</style><filter id="card-shadow" x="-15%" y="-15%" width="140%" height="150%"><feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#171717" flood-opacity="0.09"/></filter></defs>`;
  fs.writeFileSync(path.join(out, `${file}.svg`), `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-labelledby="title desc"><title id="title">${escape(id + ' ' + name)}</title><desc id="desc">${escape(roles + '. ' + state + '. Identidad CLENA. Fotografías pendientes. Borrador sin validación G6.')}</desc>${defs}${svg.join('')}</svg>\n`);
  const mobile = createMobile({ screen: { ...current, route, state, footer, description: descriptions[id] }, blocks: mobileBlocks, palette, escape, brand });
  fs.writeFileSync(path.join(out, `${file}-movil.svg`), mobile.svg);
  screens.push({ id, file, name, roles, route, state, width: WIDTH, height: HEIGHT,
    mobile: { file: `${file}-movil`, width: mobile.width, height: mobile.height } });
}

export function writeManifest() {
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify({ version: 3, issue: 152, designVersion: 'HU-152 · segunda entrega de HU-46', identity: 'CLENA – Dashboard (paleta adaptada)', figmaReference: 'https://www.figma.com/design/2ZPymk8udllKrGQ9J16jui/Sin-t%C3%ADtulo?node-id=5-2', status: 'Borrador pendiente de revisión G6', photography: 'Espacios reservados; imágenes de la ciudad pendientes de entrega', palette, screens }, null, 2) + '\n');
  console.log(`Generadas ${screens.length} vistas de escritorio y ${screens.length} móviles de 360 px con identidad CLENA / Uninorte.`);
}
