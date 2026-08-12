/**
 * The two validation rules on the product schema that decide whether CJ can
 * press **Publish**.
 *
 * Studio blocks publishing on an *error* and allows it on a *warning*, so the
 * level a rule is declared at is a functional decision, not a matter of tone —
 * and it is invisible unless something pins it. These tests drive each
 * `validation` builder with a stand-in Rule and inspect what it asked for.
 */
import { describe, expect, test } from 'vitest';

import product from '@/sanity/schema/product';

type Validator = (
  value: unknown,
  context: { document?: Record<string, unknown> },
) => true | string;

interface RuleCalls {
  required: boolean;
  level: 'error' | 'warning';
  message?: string;
  validator?: Validator;
}

/**
 * The slice of Sanity's Rule builder this schema uses, recording what it was
 * asked for. `warning()` sets the level for the whole rule, which is why
 * `required().warning(msg)` is a soft "please fill this in" rather than a
 * publish-blocking demand.
 */
function fakeRule(): { rule: unknown; calls: RuleCalls } {
  const calls: RuleCalls = { required: false, level: 'error' };
  const rule = {
    required() {
      calls.required = true;
      return rule;
    },
    warning(message?: string) {
      calls.level = 'warning';
      calls.message = message;
      return rule;
    },
    error(message?: string) {
      calls.level = 'error';
      calls.message = message;
      return rule;
    },
    custom(fn: Validator) {
      calls.validator = fn;
      return rule;
    },
  };
  return { rule, calls };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function field(name: string): any {
  const found = (product.fields as any[]).find((f) => f.name === name);
  if (!found) throw new Error(`no field named ${name} on the product schema`);
  return found;
}

/** The `squareVariationId` field *inside* a variants array entry. */
function variantField(name: string): any {
  const variantObject = (field('variants').of as any[])[0];
  const found = (variantObject.fields as any[]).find((f) => f.name === name);
  if (!found) throw new Error(`no field named ${name} on the variant object`);
  return found;
}

function drive(validation: (rule: unknown) => unknown): RuleCalls {
  const { rule, calls } = fakeRule();
  validation(rule);
  return calls;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

describe('product.squareVariationId — exclusive with variants', () => {
  const EXPECTED =
    'This product uses variants — leave this field empty; each variant carries its own Square ID.';

  function check(value: unknown, document: Record<string, unknown>): true | string {
    const calls = drive(field('squareVariationId').validation);
    expect(calls.validator).toBeTypeOf('function');
    return calls.validator!(value, { document });
  }

  test('refuses a top-level id on a product that has variants', () => {
    // Filling in both means the grid tile (which prices from this field) and
    // the detail page (which prices from the variants) can quote different
    // prices for the same product.
    expect(check('VAR123', { variants: [{ label: 'Rose', squareVariationId: 'A' }] })).toBe(
      EXPECTED,
    );
  });

  test('is happy with an empty id on a product that has variants', () => {
    const doc = { variants: [{ label: 'Rose', squareVariationId: 'A' }] };

    expect(check('', doc)).toBe(true);
    expect(check(undefined, doc)).toBe(true);
    expect(check('   ', doc)).toBe(true);
  });

  test('leaves a product without variants alone', () => {
    expect(check('VAR123', {})).toBe(true);
    expect(check('VAR123', { variants: [] })).toBe(true);
  });

  test('is declared at error level, so Studio blocks the publish', () => {
    expect(drive(field('squareVariationId').validation).level).toBe('error');
  });
});

describe('product.variants[].customSquareVariationId — not asked for at all', () => {
  test('carries no validation, so a style with no custom SKU still publishes', () => {
    // Lavender has no "Custom — crochet flowers" variation in Square yet, and
    // may never. The custom page reads a missing id as "this style is not
    // offered custom" and leaves it off the picker, so there is nothing here
    // for Studio to nag about.
    const customId = variantField('customSquareVariationId');

    expect(customId.type).toBe('string');
    expect(customId.validation).toBeUndefined();
    expect(customId.title).toBe('Custom Square Variation ID');
  });
});

describe('product.sellByPiece and the per-photo piece fields', () => {
  test('sellByPiece is an opt-in boolean that starts off', () => {
    // Off by default is the whole safety of the pilot: every product CJ has
    // today keeps the behaviour it has today until she turns this on.
    const flag = field('sellByPiece');

    expect(flag.type).toBe('boolean');
    expect(flag.initialValue).toBe(false);
    expect(flag.description).toMatch(/one-of-a-kind/i);
  });

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const photoMember = (field('photos').of as any[])[0];

  test('photos keep the hotspot option they were authored with', () => {
    expect(photoMember.type).toBe('image');
    expect(photoMember.options).toEqual({ hotspot: true });
  });

  test('each photo carries an optional piece name and an optional sold mark', () => {
    const fields = photoMember.fields as any[];

    expect(fields.map((f) => f.name)).toEqual(['pieceLabel', 'sold']);
    // Neither is demanded, at any level: every photo uploaded before this
    // existed has neither, and the site reads that as "unnamed, still for
    // sale" rather than as an unfinished document.
    expect(fields.every((f) => f.validation === undefined)).toBe(true);
    expect(fields.find((f) => f.name === 'sold').initialValue).toBe(false);
    expect(fields.find((f) => f.name === 'sold').description).toMatch(/cannot be bought/i);
  });
  /* eslint-enable @typescript-eslint/no-explicit-any */
});

describe('product.variants[].squareVariationId — asked for, not demanded', () => {
  test('is a warning, so a seeded product can still be published', () => {
    // The seed creates Crochet flowers with three labelled variants and no ids
    // yet — filling them in is a launch step. At error level that product could
    // not be published at all, which contradicts the runbook and the checklist.
    const calls = drive(variantField('squareVariationId').validation);

    expect(calls.required).toBe(true);
    expect(calls.level).toBe('warning');
    expect(calls.message).toMatch(/square/i);
  });
});
