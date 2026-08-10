/**
 * In-repo stand-in for the Sanity dataset, served when `SANITY_FAKE=1`.
 *
 * Two jobs, both development-only:
 *  - **E2E.** Playwright needs the same pages every run, on a machine with no
 *    Sanity project and no credentials. Content that changes underfoot makes
 *    specs that fail for reasons no one can reproduce.
 *  - **First clone.** `SANITY_FAKE=1 SQUARE_FAKE=1 npm run dev` gives a
 *    working shop — grid, product, custom order, cart, blog, circles — before
 *    anyone has run `npx sanity init`.
 *
 * The variation ids below are the same ones `lib/square/fixtures.ts` prices,
 * which is what makes an end-to-end checkout work with neither service
 * reachable. Change one and change the other.
 *
 * **This is never live behaviour.** `lib/sanity/queries.ts` consults
 * `sanityFixturesEnabled()` and nothing else; with `SANITY_FAKE` unset, not one
 * line of this file runs. It is not `NEXT_PUBLIC_`, so it cannot be turned on
 * from a browser, and Amplify never sets it (see docs/launch-runbook.md).
 */
import type { RsvpDeps } from '@/lib/rsvp-service';

import type {
  AboutPage,
  EventDoc,
  PoliciesPage,
  PortableTextBlock,
  Post,
  PostSummary,
  Product,
  Rsvp,
} from './queries';
import type { Section } from '@/lib/types';

/**
 * Whether the fixture dataset is in play. Read per call rather than captured at
 * module load, so a test can flip it with `vi.stubEnv`.
 */
export function sanityFixturesEnabled(): boolean {
  return process.env.SANITY_FAKE === '1';
}

// ---------------------------------------------------------------------------
// Products — one featured, one variants product, one custom-enabled, one that
// the Square fixtures report as out of stock.
// ---------------------------------------------------------------------------

/** Square variation ids, shared with lib/square/fixtures.ts. */
export const FIXTURE_VARIATIONS = {
  ruffledBucketHat: 'FAKEVAR-RUFFLED-BUCKET-HAT',
  customRuffledBucketHat: 'FAKEVAR-CUSTOM-RUFFLED-BUCKET-HAT',
  /** Deliberately out of stock — the sold-out badge needs something to sit on. */
  beanie: 'FAKEVAR-BEANIE',
  slouchBag: 'FAKEVAR-SLOUCH-BAG',
  flowerRose: 'FAKEVAR-FLOWER-ROSE',
  flowerTulip: 'FAKEVAR-FLOWER-TULIP',
  flowerLavender: 'FAKEVAR-FLOWER-LAVENDER',
} as const;

// Photos are deliberately absent from every fixture product: a Sanity image
// reference would send `urlFor` to cdn.sanity.io for an asset that does not
// exist, and the whole point here is a run with no network. The app's own
// `<PlaceholderImage>` covers them, which is the same thing CJ sees before she
// uploads a photo.
const PRODUCTS: Product[] = [
  {
    _id: 'fixture-product-ruffled-bucket-hat',
    title: 'Crochet ruffled bucket hat',
    slug: 'crochet-ruffled-bucket-hat',
    section: 'hats',
    description: 'A breezy ruffled-brim bucket hat, hand-crocheted stitch by stitch.',
    squareVariationId: FIXTURE_VARIATIONS.ruffledBucketHat,
    customSquareVariationId: FIXTURE_VARIATIONS.customRuffledBucketHat,
    displayOrder: 1,
    featured: true,
  },
  {
    _id: 'fixture-product-beanie',
    title: 'Crochet beanie',
    slug: 'crochet-beanie',
    section: 'hats',
    description: 'A soft everyday beanie in a cheerful multicolor blend.',
    squareVariationId: FIXTURE_VARIATIONS.beanie,
    displayOrder: 2,
    featured: false,
  },
  {
    _id: 'fixture-product-slouch-bag',
    title: 'Crochet slouch bag',
    slug: 'crochet-slouch-bag',
    section: 'accessories',
    description: 'A relaxed, roomy slouch bag crocheted for everyday carrying.',
    squareVariationId: FIXTURE_VARIATIONS.slouchBag,
    displayOrder: 1,
    featured: true,
  },
  {
    _id: 'fixture-product-crochet-flowers',
    title: 'Crochet flowers',
    slug: 'crochet-flowers',
    section: 'accessories',
    description: 'Tiny crocheted flowers to clip, pin, or tuck in wherever you like.',
    // No `squareVariationId` on purpose: a product sold as variants must leave
    // it empty, because the grid and the detail page source their variation
    // differently and authoring both would price the tile from one and the
    // buy button from the other. The runbook's pre-flight says the same thing.
    variants: [
      { label: 'Rose', squareVariationId: FIXTURE_VARIATIONS.flowerRose },
      { label: 'Tulip', squareVariationId: FIXTURE_VARIATIONS.flowerTulip },
      { label: 'Lavender', squareVariationId: FIXTURE_VARIATIONS.flowerLavender },
    ],
    displayOrder: 2,
    featured: false,
  },
];

// ---------------------------------------------------------------------------
// Events — dated relative to "now" so the fixture set never quietly ages into
// the past and starts failing the RSVP specs.
// ---------------------------------------------------------------------------

export const FIXTURE_OPEN_EVENT_SLUG = 'cozy-crochet-circle';
export const FIXTURE_FULL_EVENT_SLUG = 'sold-out-stitching-circle';

const OPEN_EVENT_ID = 'fixture-event-open';
const FULL_EVENT_ID = 'fixture-event-full';
const PAST_EVENT_ID = 'fixture-event-past';

const DAY_MS = 24 * 60 * 60 * 1000;

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * DAY_MS).toISOString();
}

function events(): EventDoc[] {
  return [
    {
      _id: OPEN_EVENT_ID,
      title: 'Cozy crochet circle',
      slug: FIXTURE_OPEN_EVENT_SLUG,
      startsAt: daysFromNow(7),
      description: 'Bring your yarn and a warm drink; we stitch together for an hour.',
      capacity: 12,
    },
    {
      _id: FULL_EVENT_ID,
      title: 'Sold-out stitching circle',
      slug: FIXTURE_FULL_EVENT_SLUG,
      startsAt: daysFromNow(14),
      description: 'This one filled up fast.',
      // Seeded to exactly this many RSVPs below, so the page shows the
      // full-circle message instead of the form.
      capacity: 2,
    },
    {
      _id: PAST_EVENT_ID,
      title: 'Spring yarn swap',
      slug: 'spring-yarn-swap',
      startsAt: daysFromNow(-30),
      description: 'We met, we swapped, we stitched.',
    },
  ];
}

/**
 * RSVPs, in memory, for the life of the dev server.
 *
 * Keyed by event id, holding lower-cased emails — enough to answer all three
 * things the RSVP service asks (count, duplicate, create) without a datastore.
 * Reset by restarting the server, which is exactly the isolation an E2E run
 * wants.
 */
const rsvps = new Map<string, Set<string>>([
  [FULL_EVENT_ID, new Set(['first@example.com', 'second@example.com'])],
]);

function seatsFor(eventId: string): Set<string> {
  const existing = rsvps.get(eventId);
  if (existing) return existing;
  const fresh = new Set<string>();
  rsvps.set(eventId, fresh);
  return fresh;
}

/**
 * The RSVP service's dependencies, backed by the fixture events and that map.
 *
 * `app/api/rsvp/route.ts` swaps these in wholesale rather than going through
 * the query helpers, because it deliberately reads through its own non-CDN
 * client and writes with a token — neither of which exists in fixture mode.
 */
export const fixtureRsvpDeps: RsvpDeps = {
  async getEvent(slug) {
    return events().find((event) => event.slug === slug) ?? null;
  },
  async countRsvps(eventId) {
    return seatsFor(eventId).size;
  },
  async emailExists(eventId, email) {
    return seatsFor(eventId).has(email.trim().toLowerCase());
  },
  async create({ eventId, email }) {
    seatsFor(eventId).add(email.trim().toLowerCase());
  },
  now: () => new Date(),
};

// ---------------------------------------------------------------------------
// Posts and the two singleton pages
// ---------------------------------------------------------------------------

function paragraph(key: string, text: string): PortableTextBlock {
  return {
    _type: 'block',
    _key: key,
    style: 'normal',
    markDefs: [],
    children: [{ _type: 'span', _key: `${key}-span`, text, marks: [] }],
  };
}

const POSTS: Post[] = [
  {
    _id: 'fixture-post-choosing-yarn',
    title: 'Choosing yarn for a summer hat',
    slug: 'choosing-yarn-for-a-summer-hat',
    excerpt: 'Cotton, linen, or a blend? What holds a brim up in the heat.',
    publishedAt: '2026-06-14T09:00:00.000Z',
    body: [
      paragraph('p1', 'Cotton breathes, linen holds a brim, and a blend splits the difference.'),
      paragraph('p2', 'Whatever you pick, swatch first: gauge changes everything about a hat.'),
    ],
  },
  {
    _id: 'fixture-post-granny-squares',
    title: 'Granny squares, sixteen ways',
    slug: 'granny-squares-sixteen-ways',
    excerpt: 'One little square, and all the places it can go.',
    publishedAt: '2026-05-02T09:00:00.000Z',
    body: [
      paragraph('p1', 'A granny square is a whole vocabulary once you start joining them.'),
    ],
  },
];

const ABOUT: AboutPage = {
  heading: 'Meet CJ',
  body: [
    paragraph(
      'p1',
      'CJ Lavender is an artist, a musician, a therapist, and, stitch by stitch, the whole of Authentic Creations.',
    ),
    paragraph(
      'p2',
      'Every piece here is made by hand, because something made slowly is something you can feel.',
    ),
  ],
};

const POLICIES: PoliciesPage = {
  body: [
    paragraph('p1', 'Ready-made pieces post within three days. Custom pieces take two to three weeks.'),
    paragraph('p2', 'If something is not right when it arrives, email CJ and she will make it right.'),
  ],
};

// ---------------------------------------------------------------------------
// The reads themselves — each one mirrors the ordering and shape of the GROQ
// query it stands in for, so a page cannot pass here and fail against Sanity.
// ---------------------------------------------------------------------------

/** Drops `body`, matching `POSTS_QUERY`'s projection — the index has no use for it. */
function toSummary(post: Post): PostSummary {
  return {
    _id: post._id,
    title: post.title,
    slug: post.slug,
    coverImage: post.coverImage,
    excerpt: post.excerpt,
    publishedAt: post.publishedAt,
  };
}

export const sanityFixtures = {
  products(section: Section): Product[] {
    return PRODUCTS.filter((product) => product.section === section).sort(byDisplayOrder);
  },
  product(slug: string): Product | null {
    return PRODUCTS.find((product) => product.slug === slug) ?? null;
  },
  featuredProducts(): Product[] {
    return PRODUCTS.filter((product) => product.featured === true).sort(byDisplayOrder);
  },
  posts(): PostSummary[] {
    return [...POSTS]
      .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
      .map(toSummary);
  },
  post(slug: string): Post | null {
    return POSTS.find((post) => post.slug === slug) ?? null;
  },
  upcomingEvents(now: Date): EventDoc[] {
    return events()
      .filter((event) => event.startsAt >= now.toISOString())
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  },
  pastEvents(now: Date): EventDoc[] {
    return events()
      .filter((event) => event.startsAt < now.toISOString())
      .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  },
  eventBySlug(slug: string): EventDoc | null {
    return events().find((event) => event.slug === slug) ?? null;
  },
  rsvpCount(eventId: string): number {
    return seatsFor(eventId).size;
  },
  findRsvp(eventId: string, email: string): Rsvp | null {
    const normalized = email.trim().toLowerCase();
    if (!seatsFor(eventId).has(normalized)) return null;
    return {
      _id: `fixture-rsvp-${eventId}-${normalized}`,
      event: { _ref: eventId },
      name: 'Fixture Guest',
      email: normalized,
      createdAt: '2026-08-01T00:00:00.000Z',
    };
  },
  aboutPage(): AboutPage {
    return ABOUT;
  },
  policiesPage(): PoliciesPage {
    return POLICIES;
  },
};

/** Mirrors `| order(displayOrder asc)`; unordered products sort last. */
function byDisplayOrder(a: Product, b: Product): number {
  return (a.displayOrder ?? Number.MAX_SAFE_INTEGER) - (b.displayOrder ?? Number.MAX_SAFE_INTEGER);
}
