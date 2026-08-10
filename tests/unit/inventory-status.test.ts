import { describe, expect, test } from 'vitest';

import { isSoldOut } from '@/lib/inventory-status';

/**
 * Pins the sold-out matrix carried over from Task 4's review: sold out
 * requires BOTH trackInventory === true AND a count that is missing or <= 0.
 * Untracked (made-to-order) items must never read as sold out, regardless of
 * count — count is meaningless for them and must not even be consulted.
 */
describe('isSoldOut', () => {
  test.each([
    [false, undefined, false],
    [false, 0, false],
    [false, 5, false],
    [false, -3, false],
    [true, undefined, true],
    [true, 0, true],
    [true, -1, true],
    [true, 1, false],
    [true, 100, false],
  ] as const)('trackInventory=%s count=%s -> soldOut=%s', (trackInventory, count, expected) => {
    expect(isSoldOut(trackInventory, count)).toBe(expected);
  });
});
