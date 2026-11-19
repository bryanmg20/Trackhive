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
const variants = [];
for (const screen of manifest.screens) {
  assert(!ids.has(screen.id), `Duplicate screen: ${screen.id}`);
  ids.add(screen.id);
  assert.equal(screen.mobile?.width, 360, `${screen.id}: missing 360 px composition`);
  for (const variant of [{ ...screen, device: 'desktop' }, { ...screen, ...screen.mobile, device: 'mobile' }]) {
    const preview = fs.readFileSync(path.join(folder, `${variant.file}.svg`), 'utf8');
    assert(preview.includes('<title') && preview.includes('<desc'), `${variant.file}: accessible description missing`);
    for (const logo of ['clena', 'uninorte']) {
      assert(preview.includes(`data-logo="${logo}"`), `${variant.file}: ${logo} logo missing`);
    }
    assert(preview.includes('preserveAspectRatio="xMidYMid meet"'), `${variant.file}: logo proportions not protected`);
    assert(preview.includes(`viewBox="0 0 ${variant.width} ${variant.height}"`), `${variant.file}: incorrect dimensions`);
    for (const extension of ['svg', 'png']) {
      assert(doc.includes(`wireframes/${variant.file}.${extension}`), `${variant.file}: ${extension} not linked in pantallas.md`);
      if (!process.argv.includes('--render')) assert(fs.existsSync(path.join(folder, `${variant.file}.${extension}`)), `${variant.file}: ${extension} missing`);
    }
    variants.push(variant);
  }
}
assert.equal(variants.length, 30);

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
console.log(`OK: ${ids.size} screens, 30 desktop/mobile variants, institutional logos and documentation links.`);

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
    for (const screen of variants) {
      await page.setViewportSize({ width: screen.width, height: screen.height });
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
      await page.locator('image').evaluateAll((elements) => Promise.all(elements.map((element) => {
        const image = new Image(); image.src = element.getAttribute('href'); return image.decode();
      })));
      const brand = page.locator('[data-brand="institutional"]');
      assert.equal(await brand.locator('rect').count(), 0, `${screen.id}: white logo container`);
      const logos = await brand.locator('image').evaluateAll((elements) => elements.map((element) => ({
        y: Number(element.getAttribute('y')), height: Number(element.getAttribute('height')),
      })));
      assert.equal(logos[0].y, logos[1].y, `${screen.id}: logos are vertically misaligned`);
      assert.equal(logos[0].height, logos[1].height, `${screen.id}: logos have unequal visible heights`);
      if (screen.device === 'mobile') {
        const invalid = await page.locator('[data-control]').evaluateAll((controls) => controls.filter((control) => control.getBBox().height < 44).map((control) => control.outerHTML));
        assert.deepEqual(invalid, [], `${screen.id}: controls below 44 px`);
        const overflow = await page.locator('text[data-max-width]').evaluateAll((texts) => texts.filter((element) => element.getBBox().width > Number(element.dataset.maxWidth) + 1).map((element) => element.textContent));
        failures.push(...overflow.map((content) => `${screen.id} mobile text exceeds its column: ${content}`));
        assert(await page.evaluate(() => document.documentElement.scrollWidth === 360), `${screen.id}: horizontal overflow`);
      }
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
    const mobileCards = manifest.screens.map((screen) => {
      const data = fs.readFileSync(path.join(folder, `${screen.mobile.file}.png`)).toString('base64');
      return `<figure><figcaption>${screen.id} · ${screen.name}</figcaption><img alt="${screen.id} móvil" src="data:image/png;base64,${data}"></figure>`;
    }).join('');
    await page.setContent(`<html lang="es"><meta charset="utf-8"><style>body{font:14px Arial;background:#F4F0E8;margin:20px}h1{font-size:26px}main{display:grid;grid-template-columns:repeat(5,1fr);gap:16px}figure{margin:0;background:white;padding:8px}figcaption{height:48px;font-weight:bold}img{width:100%;height:560px;object-fit:cover;object-position:top;display:block}</style><h1>CLENA / Uninorte · 15 versiones móviles de 360 px</h1><p>Vista parcial de cada pantalla. Abrir los PNG individuales para revisar el contenido completo. Revisión G6 pendiente.</p><main>${mobileCards}</main></html>`);
    await page.locator('img').evaluateAll((images) => Promise.all(images.map((image) => image.decode())));
    await page.screenshot({ path: path.join(output, 'hoja-contacto-movil.png'), fullPage: true });
    fs.copyFileSync(path.join(output, 'hoja-contacto-movil.png'), path.join(folder, 'hoja-contacto-movil.png'));
  } finally {
    await browser.close();
  }
  assert.deepEqual(failures, [], 'Rendered text outside the canvas');
  console.log(`OK: 30 SVGs rendered in Chromium. Mobile: 360 px, controls >=44 px, no horizontal overflow. Previews: ${output}`);
}
