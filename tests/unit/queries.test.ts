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
