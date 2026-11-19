/** Deterministic white-matte removal. Uses original pixels, never generated logos. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const folder = path.join(root, 'docs/wireframes/assets');
const require = createRequire(path.join(root, 'frontend/package.json'));
const { chromium } = require('@playwright/test');
const browser = await chromium.launch({ headless: true });
const metadata = {};
try {
  const page = await browser.newPage();
  for (const name of ['clena-horizontal', 'uninorte-horizontal', 'uninorte-simbolo']) {
    const original = fs.readFileSync(path.join(folder, name + '.png'));
    const result = await page.evaluate(async (source) => {
      const image = new Image();
      image.src = source;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      const original = new Uint8ClampedArray(pixels.data);
      let left = canvas.width, top = canvas.height, right = -1, bottom = -1;
      let removed = 0, preserved = 0;
      for (let index = 0; index < pixels.data.length; index += 4) {
        const [r, g, b, a] = pixels.data.subarray(index, index + 4);
        // Neutral whites only, including the slight off-whites of the supplied raster.
        const white = Math.min(r, g, b) >= 245 && Math.max(r, g, b) - Math.min(r, g, b) <= 8;
        if (a && white) { pixels.data[index + 3] = 0; removed += 1; }
        else if (a) {
          preserved += 1;
          const x = (index / 4) % canvas.width;
          const y = Math.floor(index / 4 / canvas.width);
          left = Math.min(left, x); right = Math.max(right, x);
          top = Math.min(top, y); bottom = Math.max(bottom, y);
        }
      }
      // Every remaining pixel must keep exactly its input RGBA values.
      let changedBrandPixels = 0;
      for (let index = 0; index < pixels.data.length; index += 4) {
        if (!pixels.data[index + 3]) continue;
        if ([0, 1, 2, 3].some((channel) => pixels.data[index + channel] !== original[index + channel])) changedBrandPixels += 1;
      }
      if (right < left || bottom < top) throw new Error('No visible logo pixels');
      const width = right - left + 1, height = bottom - top + 1;
      // Copy pixels without resampling; remove only exterior empty canvas margins.
      const cropped = document.createElement('canvas');
      cropped.width = width; cropped.height = height;
      const croppedContext = cropped.getContext('2d');
      const croppedPixels = croppedContext.createImageData(width, height);
      for (let y = 0; y < height; y += 1) {
        const start = ((top + y) * canvas.width + left) * 4;
        croppedPixels.data.set(pixels.data.subarray(start, start + width * 4), y * width * 4);
      }
      croppedContext.putImageData(croppedPixels, 0, 0);
      return { data: cropped.toDataURL('image/png').split(',')[1], width, height, crop: { left, top }, removed, preserved, changedBrandPixels };
    }, 'data:image/png;base64,' + original.toString('base64'));
    assert.equal(result.changedBrandPixels, 0, name + ': brand pixels changed');
    const file = name + '-transparente.png';
    fs.writeFileSync(path.join(folder, file), Buffer.from(result.data, 'base64'));
    const { data, ...stats } = result;
    void data;
    metadata[name] = { file, ...stats };
    console.log(`${name}: ${result.width}x${result.height}; ${result.removed} white pixels cleared; 0 brand pixels changed`);
  }
  fs.writeFileSync(path.join(folder, 'logos.json'), JSON.stringify(metadata, null, 2) + '\n');
} finally {
  await browser.close();
}
