/**
 * C4 figures 1 (context) and 2 (containers) of docs/arquitectura.md.
 *
 * The SVG is written here and turned into PNG with the Chromium of the
 * frontend (Playwright), with the Inter font of docs/wireframes/assets, so it
 * looks the same on any machine. Before saving, it fails if a text goes out of
 * its box or two labels overlap.
 *
 *   cd frontend && pnpm exec playwright install chromium   # once
 *   node docs/tools/generar-c4.mjs                         # docs/img/c4-nivel-1-contexto.png, c4-nivel-2-contenedores.png
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FONT = path.join(root, 'docs/wireframes/assets/InterVariable.woff2');
const SCALE = 2;

const COLOR = {
  person: '#08427B',
  personStroke: '#073B6F',
  system: '#1168BD',
  systemStroke: '#0B4884',
  container: '#438DD5',
  containerStroke: '#3C7FC0',
  external: '#8C8C8C',
  externalStroke: '#6B6B6B',
  edge: '#3D3D3D',
  text: '#1F1F1F',
};

const escape = (value) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Centered lines of text: [{ text, size, weight, color, gap }] from top y. */
function block(cx, top, rows) {
  let y = top;
  const out = [];
  for (const row of rows) {
    y += row.gap ?? 0;
    for (const line of row.lines) {
      y += row.size * 1.3;
      out.push(
        `<text x="${cx}" y="${y - row.size * 0.3}" text-anchor="middle" font-size="${row.size}" font-weight="${row.weight ?? 400}" fill="${row.color ?? '#fff'}">${escape(line)}</text>`,
      );
    }
  }
  return { svg: out.join(''), height: y - top };
}

function rows(title, tag, description, { titleSize = 18 } = {}) {
  return [
    { lines: title, size: titleSize, weight: 700 },
    { lines: tag, size: 12.5, gap: 2 },
    ...(description.length ? [{ lines: description, size: 13.5, gap: 8 }] : []),
  ];
}

/** Text vertically centered in a box; the group is checked against the box. */
function centered(x, y, w, h, content) {
  const measure = block(0, 0, content);
  const { svg } = block(x + w / 2, y + (h - measure.height) / 2, content);
  return `<g class="fit" data-box="${x},${y},${w},${h}">${svg}</g>`;
}

function person(x, y, w, h, title, description) {
  const cx = x + w / 2;
  return (
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="30" fill="${COLOR.person}" stroke="${COLOR.personStroke}" stroke-width="1.5"/>` +
    `<circle cx="${cx}" cy="${y - 2}" r="38" fill="${COLOR.person}" stroke="${COLOR.personStroke}" stroke-width="1.5"/>` +
    centered(x + 12, y + 34, w - 24, h - 40, rows(title, ['[Persona]'], description))
  );
}

function box(x, y, w, h, fill, stroke, title, tag, description, options) {
  return (
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>` +
    centered(x + 14, y + 8, w - 28, h - 16, rows(title, tag, description, options))
  );
}

function cylinder(x, y, w, h, title, tag, description) {
  const ry = 14;
  return (
    `<path d="M${x},${y + ry} A${w / 2},${ry} 0 0 1 ${x + w},${y + ry} V${y + h - ry} A${w / 2},${ry} 0 0 1 ${x},${y + h - ry} Z" fill="${COLOR.container}" stroke="${COLOR.containerStroke}" stroke-width="1.5"/>` +
    `<path d="M${x},${y + ry} A${w / 2},${ry} 0 0 0 ${x + w},${y + ry}" fill="none" stroke="${COLOR.containerStroke}" stroke-width="1.5"/>` +
    centered(x + 14, y + 2 * ry, w - 28, h - 3 * ry, rows(title, tag, description))
  );
}

function boundary(x, y, w, h, label) {
  return (
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="none" stroke="#555" stroke-width="1.5" stroke-dasharray="9 7"/>` +
    `<text x="${x + 14}" y="${y + h - 14}" font-size="15" font-weight="700" fill="#444">${escape(label)}</text>`
  );
}

/** A relation: a polyline with an arrow and its label (white background). */
function edge(points, labelX, labelY, label) {
  const d = points.map(([px, py], index) => `${index ? 'L' : 'M'}${px},${py}`).join(' ');
  const text = block(labelX, labelY, [{ lines: label, size: 13, color: COLOR.text }]);
  return (
    `<path d="${d}" fill="none" stroke="${COLOR.edge}" stroke-width="1.6" marker-end="url(#arrow)"/>` +
    `<g class="label">${text.svg}</g>`
  );
}

function legend(x, y, w, items, notes) {
  const lineHeight = 34;
  const height = 52 + items.length * lineHeight + notes.length * 22 + 14;
  const parts = [
    `<rect x="${x}" y="${y}" width="${w}" height="${height}" fill="#fff" stroke="#999" stroke-width="1.2"/>`,
    `<text x="${x + 16}" y="${y + 32}" font-size="16" font-weight="700" fill="${COLOR.text}">Leyenda</text>`,
  ];
  items.forEach(([fill, stroke, text], index) => {
    const top = y + 50 + index * lineHeight;
    parts.push(
      fill === 'arrow'
        ? `<path d="M${x + 16},${top + 12} L${x + 58},${top + 12}" stroke="${COLOR.edge}" stroke-width="1.6" marker-end="url(#arrow)"/>`
        : `<rect x="${x + 16}" y="${top}" width="42" height="24" rx="4" fill="${fill}" stroke="${stroke}" stroke-width="1.2"/>`,
      `<text x="${x + 72}" y="${top + 17}" font-size="14.5" fill="${COLOR.text}">${escape(text)}</text>`,
    );
  });
  notes.forEach((note, index) => {
    parts.push(
      `<text x="${x + 16}" y="${y + 50 + items.length * lineHeight + 14 + index * 22}" font-size="13.5" fill="${COLOR.text}">${escape(note)}</text>`,
    );
  });
  return `<g class="fit" data-box="${x},${y},${w},${height}">${parts.join('')}</g>`;
}

function svg(width, height, body) {
  const font = fs.readFileSync(FONT).toString('base64');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="Inter, Arial, sans-serif">` +
    `<defs><style>@font-face{font-family:Inter;font-weight:100 900;src:url(data:font/woff2;base64,${font}) format('woff2')}</style>` +
    `<marker id="arrow" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="11" markerHeight="11" orient="auto-start-reverse"><path d="M0,0 L12,6 L0,12 Z" fill="${COLOR.edge}"/></marker></defs>` +
    `<rect width="${width}" height="${height}" fill="#fff"/>${body}</svg>`
  );
}

const HTTPS_NOTES = ['* HTTPS al desplegar (D-24).', 'Hoy, HTTP en docker-compose.'];

// ---- Figure 1: context -------------------------------------------------------

function context() {
  const body = [
    person(30, 50, 300, 150, ['Usuario público'], ['Investigador o ciudadano que pide', 'consultar material del archivo.']),
    person(410, 50, 300, 150, ['Personal del CLENA'], ['Atiende las solicitudes, ubica el', 'material y agenda las citas.']),
    person(790, 50, 300, 150, ['Administrador'], ['Personal con permisos extra: correo', 'de prueba y «Sincronizar ahora».']),
    box(270, 420, 520, 190, COLOR.system, COLOR.systemStroke, ['Trackhive'], ['[Sistema de software]'], [
      'Registra las solicitudes de consulta, sigue su estado,',
      'controla la disponibilidad del material y agenda las citas.',
      'Su agente, en el PC del CLENA, le envía las copias',
      'digitales que encuentra Everything.',
    ]),
    box(230, 820, 380, 140, COLOR.external, COLOR.externalStroke, ['Servicio de correo'], ['[Sistema externo: servidor SMTP]'], [
      'Entrega los correos que genera Trackhive.',
    ]),
    box(690, 820, 400, 140, COLOR.external, COLOR.externalStroke, ['Everything'], ['[Sistema externo: en el PC del CLENA]'], [
      'Indexa las carpetas de las copias',
      'digitales (unidad Z: del CLENA).',
    ]),
    edge([[230, 200], [380, 420]], 300, 268, ['Registra solicitudes y', 'consulta su estado [HTTPS*]']),
    edge([[560, 200], [560, 420]], 560, 302, ['Gestiona solicitudes, materiales', 'y citas [HTTPS*]']),
    edge([[890, 200], [700, 420]], 840, 268, ['Hace lo mismo que el personal,', 'prueba el correo y pide', 'sincronizar [HTTPS*]']),
    edge([[420, 610], [420, 820]], 420, 694, ['Envía notificaciones de', 'cambio de estado [SMTP]']),
    edge([[790, 515], [890, 515], [890, 820]], 890, 656, ['El agente consulta las carpetas', 'de los fondos y las envía a', 'Trackhive [HTTP en el mismo PC;', 'HTTPS* hacia Trackhive]']),
    edge([[230, 890], [110, 890], [110, 200]], 110, 520, ['Entrega los', 'correos de', 'estado', '[correo]']),
    legend(30, 1010, 400, [
      [COLOR.person, COLOR.personStroke, 'Persona (actor)'],
      [COLOR.system, COLOR.systemStroke, 'Sistema Trackhive'],
      [COLOR.external, COLOR.externalStroke, 'Sistema externo'],
      ['arrow', '', 'Relación [protocolo]'],
    ], HTTPS_NOTES),
  ];
  return svg(1120, 1270, body.join(''));
}

// ---- Figure 2: containers ----------------------------------------------------

function containers() {
  const tag = (technology) => technology.map((line, index) => (index === 0 ? `[Contenedor: ${line}` : line));
  const body = [
    person(40, 45, 280, 110, ['Usuario público'], []),
    person(420, 45, 280, 110, ['Personal del CLENA'], []),
    person(800, 45, 280, 110, ['Administrador'], []),
    boundary(40, 225, 680, 975, 'Trackhive [Sistema de software]'),
    box(160, 260, 440, 160, COLOR.container, COLOR.containerStroke, ['Aplicación web'], tag(['React 19 + TypeScript, Vite;', 'servida por Nginx]']), [
      'SPA con las pantallas públicas y las del',
      'personal. Se ejecuta en el navegador.',
    ]),
    box(160, 520, 440, 160, COLOR.container, COLOR.containerStroke, ['API REST'], tag(['NestJS 11 sobre Node.js 22]']), [
      'Expone /api/v1, aplica las reglas de negocio,',
      'programa los correos y recibe la sincronización.',
    ]),
    cylinder(70, 800, 300, 170, ['Base de datos'], tag(['PostgreSQL 15]']), [
      'Usuarios, materiales, solicitudes,',
      'citas, historial y notificaciones.',
    ]),
    box(400, 800, 300, 170, COLOR.container, COLOR.containerStroke, ['Agente de Everything'], tag(['Python,', 'trackhive-agente.exe en el PC del CLENA]']), [
      'Envía a la API las carpetas de',
      'Everything: cada día y a pedido.',
    ], { titleSize: 17 }),
    box(780, 520, 300, 160, COLOR.external, COLOR.externalStroke, ['Servicio de correo'], ['[Sistema externo: servidor SMTP', '(Mailpit en desarrollo)]'], [
      'Entrega los correos de cambio',
      'de estado.',
    ]),
    box(780, 1030, 300, 150, COLOR.external, COLOR.externalStroke, ['Everything'], ['[Sistema externo: en el PC del CLENA]'], [
      'Indexa las carpetas de las',
      'copias digitales.',
    ], { titleSize: 17 }),
    edge([[180, 155], [290, 260]], 220, 196, ['Usa [HTTPS*]']),
    edge([[560, 155], [420, 260]], 500, 196, ['Usa [HTTPS*]']),
    edge([[940, 155], [560, 260]], 760, 196, ['Usa [HTTPS*]']),
    edge([[380, 420], [380, 520]], 380, 452, ['Llama a /api/v1 [HTTPS/JSON*]']),
    edge([[600, 600], [780, 600]], 660, 582, ['Envía correos', '[SMTP]']),
    edge([[220, 680], [220, 800]], 220, 718, ['Lee y escribe con', 'Prisma [SQL sobre TCP]']),
    edge([[550, 800], [550, 680]], 550, 704, ['Pregunta si hay una corrida', 'pedida y envía las páginas a', '/api/v1/everything/sync-runs', '[HTTPS/JSON*]']),
    edge([[550, 970], [550, 1105], [780, 1105]], 550, 1020, ['Busca solo carpetas', '[HTTP en 127.0.0.1]']),
    legend(780, 230, 300, [
      [COLOR.person, COLOR.personStroke, 'Persona (actor)'],
      [COLOR.container, COLOR.containerStroke, 'Contenedor de Trackhive'],
      [COLOR.external, COLOR.externalStroke, 'Sistema externo'],
      ['arrow', '', 'Relación [protocolo]'],
    ], HTTPS_NOTES),
  ];
  return svg(1120, 1230, body.join(''));
}

// ---- Render -------------------------------------------------------------------

const require = createRequire(path.join(root, 'frontend/package.json'));
const { chromium } = require('@playwright/test');
const browser = await chromium.launch({ headless: true });
try {
  for (const [file, source] of [
    ['c4-nivel-1-contexto.png', context()],
    ['c4-nivel-2-contenedores.png', containers()],
  ]) {
    const page = await browser.newPage({ deviceScaleFactor: SCALE, viewport: { width: 1200, height: 1300 } });
    await page.setContent(`<html lang="es"><meta charset="utf-8"><body style="margin:0">${source}</body></html>`);
    await page.evaluate(async () => {
      await document.fonts.load('700 18px Inter');
      await document.fonts.ready;
    });
    assert(await page.evaluate(() => document.fonts.check('13px Inter')), `${file}: Inter no cargó`);

    const problems = await page.evaluate(() => {
      const found = [];
      // A white background behind each label, so the lines do not cross the text
      const labels = [...document.querySelectorAll('g.label')].map((group) => {
        const box = group.getBBox();
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        Object.entries({ x: box.x - 5, y: box.y - 2, width: box.width + 10, height: box.height + 4, fill: '#fff' }).forEach(
          ([name, value]) => rect.setAttribute(name, value),
        );
        group.insertBefore(rect, group.firstChild);
        return { text: group.textContent, box };
      });
      for (const [i, a] of labels.entries()) {
        for (const b of labels.slice(i + 1)) {
          const apart = a.box.x + a.box.width < b.box.x || b.box.x + b.box.width < a.box.x ||
            a.box.y + a.box.height < b.box.y || b.box.y + b.box.height < a.box.y;
          if (!apart) found.push(`Etiquetas encimadas: «${a.text}» y «${b.text}»`);
        }
      }
      for (const group of document.querySelectorAll('g.fit')) {
        const [x, y, w, h] = group.dataset.box.split(',').map(Number);
        for (const text of group.querySelectorAll('text')) {
          const box = text.getBBox();
          if (box.x < x || box.y < y || box.x + box.width > x + w || box.y + box.height > y + h) {
            found.push(`Texto fuera de su caja: «${text.textContent}»`);
          }
        }
      }
      return found;
    });
    assert.deepEqual(problems, [], `${file}:\n${problems.join('\n')}`);

    await page.locator('svg').screenshot({ path: path.join(root, 'docs/img', file) });
    await page.close();
    console.log(`docs/img/${file}`);
  }
} finally {
  await browser.close();
}
