import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GLOBAL_CSS = join(SRC_DIR, 'styles', 'global.css');

function cssModules(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      return cssModules(fullPath);
    }

    return entry.isFile() && entry.name.endsWith('.module.css')
      ? [fullPath]
      : [];
  });
}

function declaredBreakpoints(): number[] {
  const globalCss = readFileSync(GLOBAL_CSS, 'utf8');

  return [...globalCss.matchAll(/--bp-(?:mobile|tablet):\s*(\d+)px/g)].map(
    (match) => Number(match[1]),
  );
}

describe('responsive breakpoints', () => {
  const breakpoints = declaredBreakpoints();

  it('declares the two breakpoint widths once in styles/global.css', () => {
    expect(breakpoints).toHaveLength(2);
    // 360 px is the smallest accepted phone, so the mobile rules must apply.
    expect(Math.min(...breakpoints)).toBeGreaterThanOrEqual(360);
  });

  it('CSS modules reuse exactly the widths declared in styles/global.css', () => {
    const allowed = new Set(breakpoints);
    const violations: string[] = [];

    for (const file of cssModules(SRC_DIR)) {
      const css = readFileSync(file, 'utf8');

      for (const media of css.matchAll(/@media[^{]+/g)) {
        for (const width of media[0].matchAll(
          /(?:max|min)-width:\s*(\d+)px/g,
        )) {
          if (!allowed.has(Number(width[1]))) {
            violations.push(`${file}: ${media[0].trim()}`);
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
