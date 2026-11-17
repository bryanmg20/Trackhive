/** Validate the documentation artifacts; --render additionally needs frontend Playwright. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const folder = path.join(root, 'docs/wireframes');
const manifest = JSON.parse(fs.readFileSync(path.join(folder, 'manifest.json'), 'utf8'));
const docPath = path.join(root, 'docs/pantallas.md');
const doc = fs.readFileSync(docPath, 'utf8');
assert.equal(manifest.screens.length, 15, 'Expected fourteen requested screens plus the staff-material variant');
const ids = new Set();
for (const screen of manifest.screens) {
  assert(!ids.has(screen.id), `Duplicate screen: ${screen.id}`);
  ids.add(screen.id);
  const scenePath = path.join(folder, `${screen.file}.excalidraw`);
  const scene = JSON.parse(fs.readFileSync(scenePath, 'utf8'));
  assert.equal(scene.type, 'excalidraw', screen.id);
  assert.equal(scene.version, 2, screen.id);
  assert.equal(scene.elements.length, screen.elements, screen.id);
  assert(scene.elements.some((element) => element.type === 'text' && element.text.includes(screen.name)), `${screen.id}: title missing`);
  const elementIds = new Set();
  for (const element of scene.elements) {
    assert(!elementIds.has(element.id), `${screen.id}: duplicate element id`);
    elementIds.add(element.id);
    assert(['rectangle', 'text'].includes(element.type), `${screen.id}: unsupported element type`);
    assert([element.x, element.y, element.width, element.height].every(Number.isFinite), `${screen.id}: invalid coordinates`);
    assert(element.x >= 0 && element.y >= 0 && element.width >= 0 && element.height > 0, `${screen.id}: negative bounds`);
    assert(element.x + element.width <= screen.width + 1, `${screen.id}: horizontal overflow in ${element.text ?? element.id}`);
    assert(element.y + element.height <= screen.height + 1, `${screen.id}: vertical overflow in ${element.text ?? element.id}`);
  }
  const preview = fs.readFileSync(path.join(folder, `${screen.file}.svg`), 'utf8');
  assert(preview.includes('<title') && preview.includes('<desc'), `${screen.id}: preview has no accessible description`);
  assert(doc.includes(`wireframes/${screen.file}.svg`), `${screen.id}: preview not included in pantallas.md`);
  assert(doc.includes(`wireframes/${screen.file}.excalidraw`), `${screen.id}: editable not linked in pantallas.md`);
}

const slug = (heading) => heading.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s/g, '-');
const anchors = new Set([...doc.matchAll(/^#{1,6} (.+)$/gm)].map((match) => slug(match[1])));
for (const [, target] of doc.matchAll(/\]\(([^)]+)\)/g)) {
  if (/^https?:/.test(target)) continue;
  if (target.startsWith('#')) {
    assert(anchors.has(target.slice(1)), `Broken heading anchor: ${target}`);
  } else {
    assert(fs.existsSync(path.resolve(path.dirname(docPath), target.split('#')[0])), `Broken file link: ${target}`);
  }
}
assert(!/^(<<<<<<<|=======|>>>>>>>)/m.test(doc), 'Conflict markers in document');
console.log(`OK: ${ids.size} screens, Excalidraw structure, accessible SVGs, canvas bounds and documentation links.`);

if (process.argv.includes('--render')) {
  const require = createRequire(path.join(root, 'frontend/package.json'));
  const { chromium } = require('@playwright/test');
  const output = path.join(root, 'frontend/test-results/wireframes');
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const failures = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1040 }, deviceScaleFactor: 1 });
    for (const screen of manifest.screens) {
      await page.goto(pathToFileURL(path.join(folder, `${screen.file}.svg`)).href);
      assert.equal(await page.locator('parsererror').count(), 0, `${screen.id}: invalid SVG XML`);
      const outside = await page.locator('text').evaluateAll((texts, bounds) => texts.flatMap((element) => {
        const box = element.getBBox();
        return box.x < -1 || box.y < -1 || box.x + box.width > bounds.width + 1 || box.y + box.height > bounds.height + 1
          ? [element.textContent] : [];
      }), { width: screen.width, height: screen.height });
      failures.push(...outside.map((content) => `${screen.id}: ${content}`));
      await page.screenshot({ path: path.join(output, `${screen.file}.png`) });
    }
    const cards = manifest.screens.map((screen) => {
      const data = fs.readFileSync(path.join(folder, `${screen.file}.svg`)).toString('base64');
      return `<figure><figcaption>${screen.id} · ${screen.name}</figcaption><img alt="${screen.id}" src="data:image/svg+xml;base64,${data}"></figure>`;
    }).join('');
    await page.setViewportSize({ width: 1320, height: 1100 });
    await page.goto('about:blank');
    await page.setContent(`<html lang="es"><meta charset="utf-8"><style>body{font:16px Arial;background:#eee;margin:20px}h1{font-size:26px}main{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}figure{margin:0;background:white;padding:8px}figcaption{height:40px;font-weight:bold}img{width:100%;display:block}</style><h1>Trackhive · 15 wireframes · Pendiente de revisión G6</h1><main>${cards}</main></html>`);
    await page.locator('img').evaluateAll((images) => Promise.all(images.map((image) => image.decode())));
    await page.screenshot({ path: path.join(output, 'hoja-contacto.png'), fullPage: true });
    fs.copyFileSync(path.join(output, 'hoja-contacto.png'), path.join(folder, 'hoja-contacto.png'));
  } finally {
    await browser.close();
  }
  assert.deepEqual(failures, [], 'Rendered text outside the canvas');
  console.log(`OK: 15 SVGs rendered in Chromium without text outside canvas. Previews: ${output}`);
}
