/** Validate the documentation artifacts; --render additionally needs frontend Playwright. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

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
  const preview = fs.readFileSync(path.join(folder, `${screen.file}.svg`), 'utf8');
  assert(preview.includes('<title') && preview.includes('<desc'), `${screen.id}: preview has no accessible description`);
  assert(doc.includes(`wireframes/${screen.file}.svg`), `${screen.id}: preview not included in pantallas.md`);
  assert(doc.includes(`wireframes/${screen.file}.png`), `${screen.id}: PNG not included in pantallas.md`);
}

const slug = (heading) => heading.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s/g, '-');
const anchors = new Set([...doc.matchAll(/^#{1,6} (.+)$/gm)].map((match) => slug(match[1])));
for (const [, target] of doc.matchAll(/\]\(([^)]+)\)/g)) {
  if (/^https?:/.test(target)) continue;
  if (target.startsWith('#')) {
    assert(anchors.has(target.slice(1)), `Broken heading anchor: ${target}`);
  } else {
    const resolved = path.resolve(path.dirname(docPath), target.split('#')[0]);
    const pendingPreview = process.argv.includes('--render') && resolved.startsWith(folder + path.sep) && resolved.endsWith('.png');
    assert(fs.existsSync(resolved) || pendingPreview, `Broken file link: ${target}`);
  }
}
assert(!/^(<<<<<<<|=======|>>>>>>>)/m.test(doc), 'Conflict markers in document');
console.log(`OK: ${ids.size} screens, accessible SVGs and documentation links.`);

if (process.argv.includes('--render')) {
  const require = createRequire(path.join(root, 'frontend/package.json'));
  const { chromium } = require('@playwright/test');
  const output = path.join(root, 'frontend/test-results/wireframes');
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const failures = [];
  try {
    const font = fs.readFileSync(path.join(folder, 'assets/InterVariable.woff2')).toString('base64');
    const page = await browser.newPage({ viewport: { width: 1920, height: 1440 }, deviceScaleFactor: 1 });
    for (const screen of manifest.screens) {
      const source = fs.readFileSync(path.join(folder, `${screen.file}.svg`), 'utf8').replace('assets/InterVariable.woff2', 'data:font/woff2;base64,' + font);
      await page.setContent('<html lang="es"><meta charset="utf-8"><body style="margin:0">' + source + '</body></html>');
      await page.evaluate(async () => { await document.fonts.load('400 18px Inter'); await document.fonts.load('800 40px Inter'); await document.fonts.ready; });
      assert(await page.evaluate(() => document.fonts.check('18px Inter')), screen.id + ': Inter did not load');
      assert.equal(await page.locator('parsererror').count(), 0, `${screen.id}: invalid SVG XML`);
      const outside = await page.locator('text').evaluateAll((texts, bounds) => texts.flatMap((element) => {
        const box = element.getBBox();
        return box.x < -1 || box.y < -1 || box.x + box.width > bounds.width + 1 || box.y + box.height > bounds.height + 1
          ? [element.textContent] : [];
      }), { width: screen.width, height: screen.height });
      failures.push(...outside.map((content) => `${screen.id}: ${content}`));
      await page.screenshot({ path: path.join(output, `${screen.file}.png`) });
      fs.copyFileSync(path.join(output, `${screen.file}.png`), path.join(folder, `${screen.file}.png`));
    }
    const cards = manifest.screens.map((screen) => {
      const data = fs.readFileSync(path.join(folder, `${screen.file}.png`)).toString('base64');
      return `<figure><figcaption>${screen.id} · ${screen.name}</figcaption><img alt="${screen.id}" src="data:image/png;base64,${data}"></figure>`;
    }).join('');
    await page.setViewportSize({ width: 1320, height: 1100 });
    await page.goto('about:blank');
    await page.setContent(`<html lang="es"><meta charset="utf-8"><style>body{font:16px Arial;background:#F4F0E8;margin:20px}h1{font-size:26px}main{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}figure{margin:0;background:white;padding:8px}figcaption{height:40px;font-weight:bold}img{width:100%;display:block}</style><h1>CLENA · 15 wireframes · Pendiente de revisión G6</h1><main>${cards}</main></html>`);
    await page.locator('img').evaluateAll((images) => Promise.all(images.map((image) => image.decode())));
    await page.screenshot({ path: path.join(output, 'hoja-contacto.png'), fullPage: true });
    fs.copyFileSync(path.join(output, 'hoja-contacto.png'), path.join(folder, 'hoja-contacto.png'));
  } finally {
    await browser.close();
  }
  assert.deepEqual(failures, [], 'Rendered text outside the canvas');
  console.log(`OK: 15 SVGs rendered in Chromium without text outside canvas. Previews: ${output}`);
}
