/**
 * Seed script — populates Sanity with the 10 launch products (spec §5) and
 * the aboutPage/policiesPage singletons, uploading photos from
 * `images/full/` per the mapping in the Task 3 brief.
 *
 * Idempotent: every document has a deterministic `_id` and is written with
 * `createIfNotExists`, so running this twice is a no-op the second time
 * (image uploads are also skipped on the second run — see `exists()` below).
 *
 * This is a standalone Node script (run via `npx tsx`), not part of the
 * Next.js app — it builds its own write client instead of importing
 * lib/sanity/client.ts's `sanityWriteClient`, because that module's
 * `import 'server-only'` guard only works inside Next's own build (it throws
 * unconditionally under plain Node/tsx).
 *
 * Usage:
 *   npx tsx scripts/seed-sanity.ts            # writes to the real dataset
 *   npx tsx scripts/seed-sanity.ts --dry-run  # prints planned mutations, no network
 */

import fs from 'node:fs';
import path from 'node:path';

// Relative, not the `@/` alias: this script runs under plain Node via tsx, not
// through Next's or Vitest's resolver, so it should not depend on either
// knowing about tsconfig paths. The module it pulls in is a lone string
// constant with no imports of its own — see lib/sanity/api-version.ts for why
// the version must not drift between this script and the app's clients.
import { SANITY_API_VERSION } from '../lib/sanity/api-version';

const DRY_RUN = process.argv.includes('--dry-run');

// Best-effort .env.local load, so `npm run seed` picks up local credentials
// the same way `next dev`/`next build` would. Never required for --dry-run.
try {
  process.loadEnvFile(path.join(process.cwd(), '.env.local'));
} catch {
  // Missing/unreadable .env.local — fine for --dry-run; the real run fails
  // its own env-var check below with a clear message.
}

const IMAGES_DIR = path.join(process.cwd(), 'images', 'full');
const ABOUT_PAGE_PHOTO = 'cj-portrait.jpg';

interface ProductSeed {
  id: string;
  title: string;
  slug: string;
  section: 'hats' | 'accessories';
  description: string;
  displayOrder: number;
  featured: boolean;
  /** Filenames under images/full/, in the order they should appear. */
  photos?: string[];
  /**
   * `squareVariationId` is deliberately absent, not empty: the seed runs before
   * anyone has built the Square catalog, so there is no id to write. Writing
   * `''` would put a blank string in a field the schema asks to be filled in,
   * which reads in Studio as "someone typed nothing here" rather than "not
   * done yet". CJ pastes the real ids in during launch step 2.4.
   */
  variants?: { label: string }[];
}

// Descriptions are friendly one-line drafts — CJ can refine them in Studio.
const PRODUCTS: ProductSeed[] = [
  // --- Hats -----------------------------------------------------------
  {
    id: 'product-crochet-ruffled-bucket-hat',
    title: 'Crochet ruffled bucket hat',
    slug: 'crochet-ruffled-bucket-hat',
    section: 'hats',
    description: 'A breezy ruffled-brim bucket hat, hand-crocheted stitch by stitch.',
    displayOrder: 1,
    featured: true,
    photos: [
      'Crochet ruffled bucket hat.jpg',
      'Crochet ruffled bucket hat orange.jpg',
      'Crochet ruffled bucket hat yellow.jpg',
      'Ruffled bucket hat green.jpg',
      'Ruffled bucket hat khaki.jpg',
      'Ruffled bucket hat ombré.jpg',
    ],
  },
  {
    id: 'product-crochet-granny-stitch-hat',
    title: 'Crochet granny stitch hat',
    slug: 'crochet-granny-stitch-hat',
    section: 'hats',
    description: 'A classic granny-stitch bucket hat with cozy, textured rounds.',
    displayOrder: 2,
    featured: false,
    photos: ['Granny stitch bucket hat.jpg'],
  },
  {
    id: 'product-crochet-granny-square-beanie',
    title: 'Crochet granny square beanie',
    slug: 'crochet-granny-square-beanie',
    section: 'hats',
    description: 'A snug beanie built from granny squares, playful and warm.',
    displayOrder: 3,
    featured: false,
  },
  {
    id: 'product-crochet-bucket-hat',
    title: 'Crochet bucket hat',
    slug: 'crochet-bucket-hat',
    section: 'hats',
    description: 'A simple, sturdy crochet bucket hat for everyday sunshine.',
    displayOrder: 4,
    featured: true,
    photos: ['Crochet bucket hat ombré.jpg', 'Crochet bucket hat ombré model.jpg'],
  },
  {
    id: 'product-crochet-cat-ear-beanie',
    title: 'Crochet cat-ear beanie',
    slug: 'crochet-cat-ear-beanie',
    section: 'hats',
    description: 'A playful beanie topped with two little crocheted cat ears.',
    displayOrder: 5,
    featured: false,
  },
  {
    id: 'product-crochet-beanie',
    title: 'Crochet beanie',
    slug: 'crochet-beanie',
    section: 'hats',
    description: 'A soft everyday beanie in a cheerful multicolor blend.',
    displayOrder: 6,
    featured: true,
    photos: ['Crochet beanie multicolor.jpg'],
  },
  // --- Accessories ------------------------------------------------------
  {
    id: 'product-scrunchies-3-pack',
    title: 'Scrunchies 3-pack',
    slug: 'scrunchies-3-pack',
    section: 'accessories',
    description: 'Three hand-crocheted scrunchies, gentle on hair and full of color.',
    displayOrder: 1,
    featured: false,
  },
  {
    id: 'product-crochet-flowers',
    title: 'Crochet flowers',
    slug: 'crochet-flowers',
    section: 'accessories',
    description: 'Tiny crocheted flowers to clip, pin, or tuck in wherever you like.',
    displayOrder: 2,
    featured: false,
    variants: [{ label: 'Rose' }, { label: 'Tulip' }, { label: 'Lavender' }],
  },
  {
    id: 'product-crochet-slouch-bag',
    title: 'Crochet slouch bag',
    slug: 'crochet-slouch-bag',
    section: 'accessories',
    description: 'A relaxed, roomy slouch bag crocheted for everyday carrying.',
    displayOrder: 3,
    featured: true,
    photos: [
      'Crochet slouch bag.jpg',
      'Crochet slouch bag model.jpg',
      'Crochet slouch bag(1).jpg',
    ],
  },
  {
    id: 'product-crochet-bottle-holder',
    title: 'Crochet bottle holder',
    slug: 'crochet-bottle-holder',
    section: 'accessories',
    description: 'A crocheted sling to carry your water bottle in handmade style.',
    displayOrder: 4,
    featured: false,
    photos: ['Water bottle holder .jpeg'],
  },
];

function resolveImage(filename: string): { filename: string; absPath: string; exists: boolean } {
  const absPath = path.join(IMAGES_DIR, filename);
  return { filename, absPath, exists: fs.existsSync(absPath) };
}

// ---------------------------------------------------------------------------
// Starter copy for the two singletons.
//
// Seeded with words in them, not empty. An empty aboutPage and an absent
// policiesPage body both render their "nothing here yet" fallbacks, which means
// the launch smoke test's "/about and /policies render CJ's content" step has
// nothing to look at and passes by showing placeholders. These are drafts in
// CJ's voice for her to rewrite in Studio — complete and safe to be live as
// they stand, with no blanks to fill in and no claim the site cannot keep.
// ---------------------------------------------------------------------------

interface Para {
  style?: 'normal' | 'h2';
  text: string;
}

/** Portable Text blocks with stable keys, so re-seeding produces the same document. */
function portableText(prefix: string, paragraphs: Para[]) {
  return paragraphs.map((paragraph, index) => ({
    _type: 'block' as const,
    _key: `${prefix}-${index}`,
    style: paragraph.style ?? 'normal',
    markDefs: [],
    children: [
      { _type: 'span' as const, _key: `${prefix}-${index}-0`, text: paragraph.text, marks: [] },
    ],
  }));
}

const ABOUT_BODY = portableText('about', [
  {
    text:
      "Hi — I'm CJ Lavender. I'm an artist, a musician and a therapist, and every one " +
      'of those turns up in the crochet: the colour sense, the rhythm of the stitches, ' +
      'and the belief that what you wear can help you feel like yourself.',
  },
  {
    text:
      'Everything here is made by hand, one piece at a time. That is where the name ' +
      'comes from — nothing is mass-produced, nothing is a copy, and no two pieces come ' +
      'out quite the same. If you order a custom piece, it is made for you and nobody else.',
  },
  {
    text:
      'What I want most is for the things you wear to sound like you rather than like ' +
      'everyone else. Find you in whatever you do.',
  },
]);

const POLICIES_BODY = portableText('policies', [
  { style: 'h2', text: 'Shipping' },
  {
    text:
      'Every piece is made and posted by hand. Ready-made pieces usually go out within ' +
      'a few days. Made-to-order pieces take longer, because they are started once you ' +
      "order them — I'll email you when yours is on its way. You'll be asked for a " +
      'delivery address at checkout.',
  },
  { style: 'h2', text: 'Returns' },
  {
    text:
      "If something arrives damaged, or isn't what you ordered, email me within 14 days " +
      'and I will put it right. Custom pieces are made for one person, so I can only take ' +
      'those back if there is a fault.',
  },
  { style: 'h2', text: 'Questions' },
  {
    text:
      'There is a person on the other end of this — me. If anything is unclear, or you ' +
      'need something by a particular date, just ask before you order.',
  },
]);

// ---------------------------------------------------------------------------
// Dry run — no Sanity client is ever constructed, no network access.
// ---------------------------------------------------------------------------

function plannedProductDoc(product: ProductSeed) {
  const photos = (product.photos ?? []).map(resolveImage);
  return {
    _id: product.id,
    _type: 'product',
    title: product.title,
    slug: { _type: 'slug', current: product.slug },
    section: product.section,
    description: product.description,
    squareVariationId: '',
    displayOrder: product.displayOrder,
    featured: product.featured,
    ...(product.variants ? { variants: product.variants } : {}),
    photos: photos.map(
      (p) => `<upload:${p.filename}>${p.exists ? '' : ' — MISSING, would be skipped'}`
    ),
  };
}

function runDryRun(): void {
  console.log('[dry-run] planned mutations — no network calls will be made\n');

  for (const product of PRODUCTS) {
    console.log(`createIfNotExists product: ${product.id}`);
    console.log(JSON.stringify(plannedProductDoc(product), null, 2));
    console.log('');
  }

  const aboutPhoto = resolveImage(ABOUT_PAGE_PHOTO);
  console.log('createIfNotExists singleton: aboutPage');
  console.log(
    JSON.stringify(
      {
        _id: 'aboutPage',
        _type: 'aboutPage',
        heading: 'Meet CJ',
        photo: aboutPhoto.exists
          ? `<upload:${aboutPhoto.filename}>`
          : '(cj-portrait.jpg not found — left unset; CJ can upload it in Studio later)',
        body: ABOUT_BODY,
      },
      null,
      2
    )
  );
  console.log('');

  console.log('createIfNotExists singleton: policiesPage');
  console.log(
    JSON.stringify({ _id: 'policiesPage', _type: 'policiesPage', body: POLICIES_BODY }, null, 2)
  );
  console.log('');

  const photoCount = PRODUCTS.filter((p) => (p.photos ?? []).length > 0).length;
  const missing = PRODUCTS.flatMap((p) => (p.photos ?? []).map(resolveImage)).filter(
    (p) => !p.exists
  );
  console.log(
    `Summary: ${PRODUCTS.length} products planned (${photoCount} with photos, ` +
      `${PRODUCTS.length - photoCount} with no photos — UI placeholder covers them), ` +
      `${missing.length} referenced photo file(s) missing, ` +
      `aboutPage photo ${aboutPhoto.exists ? 'found' : 'NOT found'}.`
  );
}

// ---------------------------------------------------------------------------
// Real run — writes to the dataset via a write-token client.
// ---------------------------------------------------------------------------

async function runSeed(): Promise<void> {
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || 'production';
  const token = process.env.SANITY_API_WRITE_TOKEN;

  if (!projectId || !token) {
    console.error(
      'Missing NEXT_PUBLIC_SANITY_PROJECT_ID and/or SANITY_API_WRITE_TOKEN in .env.local.\n' +
        'Run `npx sanity init` to create the project (see docs/launch-runbook.md), fill in\n' +
        '.env.local, then re-run `npm run seed`.\n' +
        'Use `npm run seed -- --dry-run` to preview the planned mutations without credentials.'
    );
    process.exitCode = 1;
    return;
  }

  const { createClient } = await import('next-sanity');
  const client = createClient({
    projectId,
    dataset,
    apiVersion: SANITY_API_VERSION,
    useCdn: false,
    token,
  });

  async function exists(id: string): Promise<boolean> {
    const found = await client.fetch<string | null>('*[_id == $id][0]._id', { id });
    return Boolean(found);
  }

  async function uploadPhoto(filename: string) {
    const { absPath, exists: fileExists } = resolveImage(filename);
    if (!fileExists) {
      console.warn(`  photo not found, skipping: ${filename}`);
      return null;
    }
    const asset = await client.assets.upload('image', fs.createReadStream(absPath), { filename });
    return { _type: 'image' as const, asset: { _type: 'reference' as const, _ref: asset._id } };
  }

  for (const product of PRODUCTS) {
    if (await exists(product.id)) {
      console.log(`skip (exists): ${product.id}`);
      continue;
    }

    const photos = product.photos
      ? (await Promise.all(product.photos.map(uploadPhoto))).filter((p) => p !== null)
      : [];

    await client.createIfNotExists({
      _id: product.id,
      _type: 'product',
      title: product.title,
      slug: { _type: 'slug', current: product.slug },
      section: product.section,
      description: product.description,
      squareVariationId: '',
      displayOrder: product.displayOrder,
      featured: product.featured,
      ...(product.variants ? { variants: product.variants } : {}),
      ...(photos.length > 0 ? { photos } : {}),
    });
    console.log(`created: ${product.id}`);
  }

  if (await exists('aboutPage')) {
    console.log('skip (exists): aboutPage');
  } else {
    const photo = await uploadPhoto(ABOUT_PAGE_PHOTO);
    await client.createIfNotExists({
      _id: 'aboutPage',
      _type: 'aboutPage',
      heading: 'Meet CJ',
      body: ABOUT_BODY,
      ...(photo ? { photo } : {}),
    });
    console.log(`created: aboutPage${photo ? '' : ' (no photo — cj-portrait.jpg not found)'}`);
  }

  if (await exists('policiesPage')) {
    console.log('skip (exists): policiesPage');
  } else {
    await client.createIfNotExists({
      _id: 'policiesPage',
      _type: 'policiesPage',
      body: POLICIES_BODY,
    });
    console.log('created: policiesPage');
  }

  console.log('\nSeed complete.');
}

if (DRY_RUN) {
  runDryRun();
} else {
  runSeed().catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  });
}
