import { describe, expect, test } from 'vitest';

import { QUILT_ROTATION, quiltStyle } from '@/lib/quilt';

describe('QUILT_ROTATION', () => {
  test('has exactly 6 entries in the spec order', () => {
    expect(QUILT_ROTATION).toEqual([
      { frame: 'border-mustard', fill: 'bg-mustard-tint' },
      { frame: 'border-rose', fill: 'bg-rose-tint' },
      { frame: 'border-sage', fill: 'bg-sage-tint' },
      { frame: 'border-plum', fill: 'bg-plum-tint' },
      { frame: 'border-clay', fill: 'bg-clay-tint' },
      { frame: 'border-golden', fill: 'bg-golden-tint' },
    ]);
  });
});

describe('quiltStyle', () => {
  test('index 0 returns the mustard entry', () => {
    expect(quiltStyle(0)).toEqual({ frame: 'border-mustard', fill: 'bg-mustard-tint' });
  });

  test('index 5 returns the golden entry (last of the rotation)', () => {
    expect(quiltStyle(5)).toEqual({ frame: 'border-golden', fill: 'bg-golden-tint' });
  });

  test('index 6 wraps around to index 0 (mustard)', () => {
    expect(quiltStyle(6)).toEqual(QUILT_ROTATION[0]);
  });

  test('index 13 wraps around to index 1 (rose)', () => {
    expect(quiltStyle(13)).toEqual(QUILT_ROTATION[1]);
  });

  test('a negative index falls back to index 0', () => {
    expect(quiltStyle(-1)).toEqual(QUILT_ROTATION[0]);
  });

  test('NaN falls back to index 0', () => {
    expect(quiltStyle(NaN)).toEqual(QUILT_ROTATION[0]);
  });

  test('is deterministic: the same index always returns the same style', () => {
    expect(quiltStyle(2)).toEqual(quiltStyle(2));
  });
});
