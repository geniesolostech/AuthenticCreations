import { describe, expect, test } from 'vitest';

import {
  ABOUT_PAGE_QUERY,
  EVENT_BY_SLUG_QUERY,
  FEATURED_PRODUCTS_QUERY,
  FIND_RSVP_QUERY,
  PAST_EVENTS_QUERY,
  POLICIES_PAGE_QUERY,
  POST_QUERY,
  POSTS_QUERY,
  PRODUCT_QUERY,
  PRODUCTS_QUERY,
  RSVP_COUNT_QUERY,
  UPCOMING_EVENTS_QUERY,
} from '@/lib/sanity/queries';

describe('product queries', () => {
  test('PRODUCTS_QUERY filters by type and section, ordered by displayOrder', () => {
    expect(PRODUCTS_QUERY).toContain('_type == "product"');
    expect(PRODUCTS_QUERY).toContain('section == $section');
    expect(PRODUCTS_QUERY).toContain('order(displayOrder asc)');
  });

  test('PRODUCT_QUERY filters by type and slug, returns a single document', () => {
    expect(PRODUCT_QUERY).toContain('_type == "product"');
    expect(PRODUCT_QUERY).toContain('slug.current == $slug');
    expect(PRODUCT_QUERY).toContain('[0]');
  });

  test('FEATURED_PRODUCTS_QUERY filters by type and featured', () => {
    expect(FEATURED_PRODUCTS_QUERY).toContain('_type == "product"');
    expect(FEATURED_PRODUCTS_QUERY).toContain('featured == true');
  });

  test('the shared projection spells out the variant fields, per-variant custom id included', () => {
    // The custom page builds its style picker from these; a bare `variants`
    // would still return them, but naming them is what stops a later edit to
    // the sub-projection from quietly dropping the one the picker needs.
    for (const query of [PRODUCTS_QUERY, PRODUCT_QUERY, FEATURED_PRODUCTS_QUERY]) {
      expect(query).toContain('variants[]{');
      expect(query).toContain('customSquareVariationId');
    }
    expect(PRODUCTS_QUERY.match(/customSquareVariationId/g)).toHaveLength(2);
  });

  test('the photo sub-projection carries the piece fields and everything urlFor needs', () => {
    // `photos` used to ride whole. Now that a photo can *be* a piece, the
    // fields are named — which means the ones the image URL builder crops with
    // have to be named too, or every hotspot in the shop quietly stops working.
    for (const query of [PRODUCTS_QUERY, PRODUCT_QUERY, FEATURED_PRODUCTS_QUERY]) {
      expect(query).toContain('photos[]{');
      for (const field of ['_key', 'asset', 'hotspot', 'crop', 'pieceLabel', 'sold']) {
        expect(query).toContain(field);
      }
      expect(query).toContain('sellByPiece');
    }
  });
});

describe('post queries', () => {
  test('POSTS_QUERY filters by type, ordered by publishedAt descending', () => {
    expect(POSTS_QUERY).toContain('_type == "post"');
    expect(POSTS_QUERY).toContain('order(publishedAt desc)');
  });

  test('POST_QUERY filters by type and slug, returns a single document', () => {
    expect(POST_QUERY).toContain('_type == "post"');
    expect(POST_QUERY).toContain('slug.current == $slug');
    expect(POST_QUERY).toContain('[0]');
  });
});

describe('event queries', () => {
  test('UPCOMING_EVENTS_QUERY filters startsAt >= $now', () => {
    expect(UPCOMING_EVENTS_QUERY).toContain('_type == "event"');
    expect(UPCOMING_EVENTS_QUERY).toContain('startsAt >= $now');
  });

  test('PAST_EVENTS_QUERY filters startsAt < $now', () => {
    expect(PAST_EVENTS_QUERY).toContain('_type == "event"');
    expect(PAST_EVENTS_QUERY).toContain('startsAt < $now');
  });

  test('EVENT_BY_SLUG_QUERY filters by type and slug, returns a single document', () => {
    expect(EVENT_BY_SLUG_QUERY).toContain('_type == "event"');
    expect(EVENT_BY_SLUG_QUERY).toContain('slug.current == $slug');
    expect(EVENT_BY_SLUG_QUERY).toContain('[0]');
  });
});

describe('rsvp queries', () => {
  test('RSVP_COUNT_QUERY counts rsvps for an event', () => {
    expect(RSVP_COUNT_QUERY).toContain('_type == "rsvp"');
    expect(RSVP_COUNT_QUERY).toContain('event._ref == $eventId');
    expect(RSVP_COUNT_QUERY).toContain('count(');
  });

  test('FIND_RSVP_QUERY matches event and case-insensitive email', () => {
    expect(FIND_RSVP_QUERY).toContain('_type == "rsvp"');
    expect(FIND_RSVP_QUERY).toContain('event._ref == $eventId');
    expect(FIND_RSVP_QUERY).toContain('lower(email) == lower($email)');
  });
});

describe('singleton queries', () => {
  test('ABOUT_PAGE_QUERY selects the aboutPage singleton', () => {
    expect(ABOUT_PAGE_QUERY).toContain('_type == "aboutPage"');
    expect(ABOUT_PAGE_QUERY).toContain('[0]');
  });

  test('POLICIES_PAGE_QUERY selects the policiesPage singleton', () => {
    expect(POLICIES_PAGE_QUERY).toContain('_type == "policiesPage"');
    expect(POLICIES_PAGE_QUERY).toContain('[0]');
  });
});
