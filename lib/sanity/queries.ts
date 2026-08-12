import type { Section } from '@/lib/types';

import { sanityClient } from './client';
import { sanityFixtures, sanityFixturesEnabled } from './fixtures';

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface SanityImage {
  asset?: { _ref: string; _type: 'reference' };
  /** Sanity's own array-item key, present on images that live in an array
   * (product photos). Optional for the same reason `ProductVariant._key` is. */
  _key?: string;
  /** Both only carry meaning on a `sellByPiece` product's photos, where one
   * photo *is* one physical piece. Absent on every photo authored before the
   * fields existed, which reads as an unlabelled piece that is still for sale
   * — never as missing data. */
  pieceLabel?: string;
  sold?: boolean;
  [key: string]: unknown;
}

/** Portable Text block or inline image, kept loosely typed here — rendering
 * (Task 9's <RichText>) owns the strict shape. */
export type PortableTextBlock = { _type: string; [key: string]: unknown };

export interface ProductVariant {
  /** Sanity's own array-item key. Optional because `scripts/seed-sanity.ts`
   * writes variants without one; anything keying off it needs a fallback. */
  _key?: string;
  label: string;
  squareVariationId: string;
  /** This variant's "Custom — [product]" Square variation id, when the variant
   * can be ordered custom (crochet flowers price a custom rose and a custom
   * tulip separately from the ready-made ones). Undefined for a variant with no
   * custom SKU in Square yet, which the custom page reads as "not offered". */
  customSquareVariationId?: string;
}

export interface Product {
  _id: string;
  title: string;
  slug: string;
  section: Section;
  description?: string;
  photos?: SanityImage[];
  /** When true, every photo above is a different one-of-a-kind piece and the
   * shopper picks which one they are buying. Absent on every other product,
   * which behaves exactly as it always has. */
  sellByPiece?: boolean;
  squareVariationId?: string;
  customSquareVariationId?: string;
  variants?: ProductVariant[];
  displayOrder?: number;
  featured?: boolean;
}

export interface PostSummary {
  _id: string;
  title: string;
  slug: string;
  coverImage?: SanityImage;
  excerpt?: string;
  publishedAt?: string;
}

export interface Post extends PostSummary {
  body?: PortableTextBlock[];
}

export interface EventDoc {
  _id: string;
  title: string;
  slug: string;
  startsAt: string;
  description?: string;
  capacity?: number;
}

export interface Rsvp {
  _id: string;
  event: { _ref: string };
  name: string;
  email: string;
  createdAt: string;
}

export interface AboutPage {
  heading?: string;
  photo?: SanityImage;
  body?: PortableTextBlock[];
}

export interface PoliciesPage {
  body?: PortableTextBlock[];
}

// ---------------------------------------------------------------------------
// GROQ query strings — exported so they can be unit-tested without a
// network call (see tests/unit/queries.test.ts).
// ---------------------------------------------------------------------------

/**
 * `photos` spells its fields out rather than riding whole, because a photo on a
 * `sellByPiece` product is a piece: `_key`, `pieceLabel` and `sold` are as
 * load-bearing as the asset itself. `asset`/`hotspot`/`crop` are named here to
 * keep `urlFor` cropping exactly what it cropped before the fields were split
 * out; `_key` is what the picker keys its tiles by.
 */
const PRODUCT_PROJECTION = `{
  _id,
  title,
  "slug": slug.current,
  section,
  description,
  photos[]{
    _key,
    _type,
    asset,
    hotspot,
    crop,
    pieceLabel,
    sold
  },
  sellByPiece,
  squareVariationId,
  customSquareVariationId,
  variants[]{
    _key,
    label,
    squareVariationId,
    customSquareVariationId
  },
  displayOrder,
  featured
}`;

export const PRODUCTS_QUERY = `*[_type == "product" && section == $section] | order(displayOrder asc) ${PRODUCT_PROJECTION}`;

export const PRODUCT_QUERY = `*[_type == "product" && slug.current == $slug][0] ${PRODUCT_PROJECTION}`;

export const FEATURED_PRODUCTS_QUERY = `*[_type == "product" && featured == true] | order(displayOrder asc) ${PRODUCT_PROJECTION}`;

const POST_SUMMARY_PROJECTION = `{
  _id,
  title,
  "slug": slug.current,
  coverImage,
  excerpt,
  publishedAt
}`;

export const POSTS_QUERY = `*[_type == "post"] | order(publishedAt desc) ${POST_SUMMARY_PROJECTION}`;

export const POST_QUERY = `*[_type == "post" && slug.current == $slug][0] {
  _id,
  title,
  "slug": slug.current,
  coverImage,
  excerpt,
  publishedAt,
  body
}`;

const EVENT_PROJECTION = `{
  _id,
  title,
  "slug": slug.current,
  startsAt,
  description,
  capacity
}`;

export const UPCOMING_EVENTS_QUERY = `*[_type == "event" && startsAt >= $now] | order(startsAt asc) ${EVENT_PROJECTION}`;

export const PAST_EVENTS_QUERY = `*[_type == "event" && startsAt < $now] | order(startsAt desc) ${EVENT_PROJECTION}`;

export const EVENT_BY_SLUG_QUERY = `*[_type == "event" && slug.current == $slug][0] ${EVENT_PROJECTION}`;

export const RSVP_COUNT_QUERY = `count(*[_type == "rsvp" && event._ref == $eventId])`;

export const FIND_RSVP_QUERY = `*[_type == "rsvp" && event._ref == $eventId && lower(email) == lower($email)][0] {
  _id,
  event,
  name,
  email,
  createdAt
}`;

export const ABOUT_PAGE_QUERY = `*[_type == "aboutPage"][0] {
  heading,
  photo,
  body
}`;

export const POLICIES_PAGE_QUERY = `*[_type == "policiesPage"][0] {
  body
}`;

// ---------------------------------------------------------------------------
// Typed query helpers
//
// Each one is the single door between the app and Sanity, which is what makes
// it the right place for the `SANITY_FAKE` seam: every caller — pages, the
// sitemap, `generateStaticParams` — goes through here, so one check per helper
// covers the whole app and no page needs to know fixtures exist.
//
// `sanityFixturesEnabled()` is false unless a developer set `SANITY_FAKE=1` in
// their own shell (Amplify never does — see docs/launch-runbook.md), so in any
// deployed build these are exactly the one-line fetches they were before.
// ---------------------------------------------------------------------------

export function getProducts(section: Section): Promise<Product[]> {
  if (sanityFixturesEnabled()) return Promise.resolve(sanityFixtures.products(section));
  return sanityClient.fetch<Product[]>(PRODUCTS_QUERY, { section });
}

export function getProduct(slug: string): Promise<Product | null> {
  if (sanityFixturesEnabled()) return Promise.resolve(sanityFixtures.product(slug));
  return sanityClient.fetch<Product | null>(PRODUCT_QUERY, { slug });
}

export function getFeaturedProducts(): Promise<Product[]> {
  if (sanityFixturesEnabled()) return Promise.resolve(sanityFixtures.featuredProducts());
  return sanityClient.fetch<Product[]>(FEATURED_PRODUCTS_QUERY);
}

export function getPosts(): Promise<PostSummary[]> {
  if (sanityFixturesEnabled()) return Promise.resolve(sanityFixtures.posts());
  return sanityClient.fetch<PostSummary[]>(POSTS_QUERY);
}

export function getPost(slug: string): Promise<Post | null> {
  if (sanityFixturesEnabled()) return Promise.resolve(sanityFixtures.post(slug));
  return sanityClient.fetch<Post | null>(POST_QUERY, { slug });
}

export function getUpcomingEvents(now: Date): Promise<EventDoc[]> {
  if (sanityFixturesEnabled()) return Promise.resolve(sanityFixtures.upcomingEvents(now));
  return sanityClient.fetch<EventDoc[]>(UPCOMING_EVENTS_QUERY, { now: now.toISOString() });
}

export function getPastEvents(now: Date): Promise<EventDoc[]> {
  if (sanityFixturesEnabled()) return Promise.resolve(sanityFixtures.pastEvents(now));
  return sanityClient.fetch<EventDoc[]>(PAST_EVENTS_QUERY, { now: now.toISOString() });
}

export function getEventBySlug(slug: string): Promise<EventDoc | null> {
  if (sanityFixturesEnabled()) return Promise.resolve(sanityFixtures.eventBySlug(slug));
  return sanityClient.fetch<EventDoc | null>(EVENT_BY_SLUG_QUERY, { slug });
}

export function getRsvpCount(eventId: string): Promise<number> {
  if (sanityFixturesEnabled()) return Promise.resolve(sanityFixtures.rsvpCount(eventId));
  return sanityClient.fetch<number>(RSVP_COUNT_QUERY, { eventId });
}

export function findRsvp(eventId: string, email: string): Promise<Rsvp | null> {
  if (sanityFixturesEnabled()) return Promise.resolve(sanityFixtures.findRsvp(eventId, email));
  return sanityClient.fetch<Rsvp | null>(FIND_RSVP_QUERY, { eventId, email });
}

export function getAboutPage(): Promise<AboutPage | null> {
  if (sanityFixturesEnabled()) return Promise.resolve(sanityFixtures.aboutPage());
  return sanityClient.fetch<AboutPage | null>(ABOUT_PAGE_QUERY);
}

export function getPoliciesPage(): Promise<PoliciesPage | null> {
  if (sanityFixturesEnabled()) return Promise.resolve(sanityFixtures.policiesPage());
  return sanityClient.fetch<PoliciesPage | null>(POLICIES_PAGE_QUERY);
}
