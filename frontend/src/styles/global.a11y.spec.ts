/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Vitest returns an empty string for `?raw` CSS imports, so read the file from disk.
// The test runs with the frontend package as its working directory.
const globalCss = readFileSync(
  resolve(process.cwd(), 'src/styles/global.css'),
  'utf8',
);

function colorTokens(): Record<string, string> {
  const tokens: Record<string, string> = {};
  const pattern = /--([\w-]+):\s*(#[0-9a-fA-F]{6})\b/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(globalCss)) !== null) {
    tokens[match[1]] = match[2];
  }

  return tokens;
}

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((index) => {
    const value = Number.parseInt(hex.slice(index, index + 2), 16) / 255;
    return value <= 0.03928
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(foreground: string, background: string): number {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  return (
    (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
  );
}

const TOKENS = colorTokens();

const TEXT_PAIRS: [foreground: string, background: string][] = [
  ['ink', 'paper'],
  ['ink', 'surface'],
  ['ink', 'surface-strong'],
  ['ink-soft', 'paper'],
  ['muted', 'paper'],
  ['muted', 'surface'],
  ['muted', 'surface-strong'],
  ['gold-text', 'paper'],
  ['gold-text', 'surface'],
  ['gold-text', 'surface-strong'],
  ['gold-deep', 'paper'],
  ['gold-deep', 'surface'],
  ['seal', 'paper'],
  ['seal', 'surface'],
  ['seal', 'error-surface'],
  ['seal-dark', 'surface'],
  ['success', 'surface'],
  ['success', 'success-surface'],
  ['gold-ink', 'gold'],
];

describe('accessible base colors', () => {
  it.each(TEXT_PAIRS)(
    'has at least 4.5:1 contrast for --%s on --%s',
    (foreground, background) => {
      expect(TOKENS[foreground]).toBeDefined();
      expect(TOKENS[background]).toBeDefined();
      expect(contrastRatio(TOKENS[foreground], TOKENS[background])).toBeGreaterThanOrEqual(4.5);
    },
  );

  it('keeps the control border at 3:1 over the paper background', () => {
    expect(
      contrastRatio(TOKENS['sage-deep'], TOKENS.paper),
    ).toBeGreaterThanOrEqual(3);
  });
});

describe('scalable base text', () => {
  it('uses the user text size instead of a fixed pixel size', () => {
    expect(globalCss).toMatch(/:root\s*{[^}]*font-size:\s*100%/);
    expect(globalCss).not.toMatch(/:root\s*{[^}]*font-size:\s*\d+px/);
  });

  it('does not block the browser text size adjustment', () => {
    expect(globalCss).toMatch(/text-size-adjust:\s*100%/);
  });
});
