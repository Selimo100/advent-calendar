import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GRAND_DOOR, VILLAGE_ORDER } from '../../src/components/village/houses.ts';

describe('village layout', () => {
  it('is a fixed arrangement containing doors 1–23 exactly once, plus door 24', () => {
    expect([...VILLAGE_ORDER].sort((a, b) => a - b)).toEqual(Array.from({ length: 23 }, (_, i) => i + 1));
    expect(GRAND_DOOR).toBe(24);
  });
});

// WCAG 2.x relative luminance / contrast ratio.
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

describe('colour tokens', () => {
  const css = readFileSync(new URL('../../src/styles/index.css', import.meta.url), 'utf8');
  const token = (name: string) => {
    const m = new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6})`, 'i').exec(css);
    if (!m) throw new Error(`token ${name} missing`);
    return m[1]!;
  };

  it.each([
    ['ivory', 'midnight', 4.5],
    ['ivory-dim', 'midnight', 4.5],
    ['ivory-dim', 'evergreen', 4.5],
    ['gold', 'midnight', 4.5],
    ['gold-bright', 'burgundy', 3], // large door numbers
    ['ivory', 'burgundy', 4.5],
    ['midnight', 'gold-bright', 4.5],
    ['ink', 'ivory', 4.5],
    ['ink-soft', 'ivory', 4.5],
    ['burgundy', 'ivory', 4.5],
    ['ivory', 'evergreen', 4.5],
  ])('%s on %s meets %s:1', (fg, bg, min) => {
    expect(contrast(token(fg), token(bg))).toBeGreaterThanOrEqual(min);
  });
});
