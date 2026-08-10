import Link from 'next/link';

import EventCard from '@/components/event-card';
import Hero from '@/components/hero';
import PlaceholderImage from '@/components/placeholder-image';
import PostCard from '@/components/post-card';
import ProductCard from '@/components/product-card';
import { isSoldOut } from '@/lib/inventory-status';
import {
  getAboutPage,
  getFeaturedProducts,
  getPosts,
  getUpcomingEvents,
  type AboutPage as AboutPageDoc,
  type EventDoc,
  type PostSummary,
  type Product,
} from '@/lib/sanity/queries';
import { urlFor } from '@/lib/sanity/image';
import { fetchPricesAndStock } from '@/lib/shop/fetch-prices';

export const revalidate = 60;

const MAX_FEATURED = 4;
const MAX_POSTS = 2;

const ABOUT_FALLBACK_HEADING = 'Meet CJ';
/**
 * The home teaser's two sentences are this task's own fixed copy, not read
 * from Sanity: `AboutPage` only carries a Portable Text `body` (the full
 * `/about` story), with no short-teaser field to pull two sentences out of.
 * The CMS still drives the heading and photo below — this text is the one
 * piece of the teaser that is always the same.
 */
const ABOUT_TEASER_BODY =
  'CJ Lavender hand-crochets every hat and accessory in this shop, one stitch at a time. Authentic Creations exists to help you find yourself in whatever you make, wear, or do.';

/**
 * The variation id used to price/stock a featured tile — identical to
 * `app/shop/[section]/page.tsx`'s own helper (see its comment): a product's
 * own base variation, or its first named variant when it only sells as
 * variants, so every tile gets *some* price.
 */
function primaryVariationId(product: Product): string {
  return product.squareVariationId || product.variants?.[0]?.squareVariationId || '';
}

export default async function Home() {
  // Every Sanity read below is guarded the same way as the rest of the app
  // (Tasks 6/7/9/10): a hiccup degrades that one section to its empty/fallback
  // state — never a crashed front door.
  let featured: Product[] = [];
  try {
    featured = (await getFeaturedProducts()).slice(0, MAX_FEATURED);
  } catch (error) {
    console.error('[home] failed to fetch featured products from Sanity', error);
  }

  // Same call, same "never throws" contract as the shop grid — see
  // lib/shop/fetch-prices.ts. An empty `ids` array (no featured products, or
  // none with a priceable variation yet) is a normal input, not a guard case.
  const ids = [...new Set(featured.map(primaryVariationId).filter((id) => id !== ''))];
  const { variations, counts } = await fetchPricesAndStock(ids);

  let about: AboutPageDoc | null = null;
  try {
    about = await getAboutPage();
  } catch (error) {
    console.error('[home] failed to fetch the about page from Sanity', error);
  }

  let upcoming: EventDoc[] = [];
  try {
    upcoming = await getUpcomingEvents(new Date());
  } catch (error) {
    console.error('[home] failed to fetch upcoming events from Sanity', error);
  }
  // UPCOMING_EVENTS_QUERY already orders by startsAt ascending, so the first
  // entry is the single soonest circle.
  const nextEvent = upcoming[0] ?? null;

  let posts: PostSummary[] = [];
  try {
    posts = (await getPosts()).slice(0, MAX_POSTS);
  } catch (error) {
    console.error('[home] failed to fetch posts from Sanity', error);
  }

  const aboutHeading = about?.heading || ABOUT_FALLBACK_HEADING;
  const aboutPhotoUrl = about?.photo?.asset
    ? urlFor(about.photo).width(400).height(400).fit('crop').auto('format').url()
    : undefined;

  return (
    <>
      <Hero />

      {featured.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <h2 className="font-heading text-2xl text-charcoal sm:text-3xl">Featured pieces</h2>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-4">
            {featured.map((item) => {
              const id = primaryVariationId(item);
              const info = id ? variations.get(id) : undefined;
              const priceCents = info?.priceCents ?? null;
              const soldOut = info ? isSoldOut(info.trackInventory, counts[id]) : false;
              return <ProductCard key={item._id} product={item} priceCents={priceCents} soldOut={soldOut} />;
            })}
          </div>
        </section>
      )}

      <section className="bg-linen">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-4 py-12 text-center sm:px-6">
          <div className="h-32 w-32 shrink-0 overflow-hidden rounded-full bg-cream">
            {aboutPhotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- see components/product-card.tsx
              <img src={aboutPhotoUrl} alt={aboutHeading} className="h-full w-full object-cover" />
            ) : (
              <PlaceholderImage title={aboutHeading} hideTitle />
            )}
          </div>
          <div>
            <h2 className="font-heading text-2xl text-charcoal sm:text-3xl">{aboutHeading}</h2>
            <p className="mt-3 font-body text-charcoal">{ABOUT_TEASER_BODY}</p>
            <Link
              href="/about"
              className="mt-4 inline-block font-body text-sm font-semibold text-rust hover:text-rust-soft"
            >
              More about CJ →
            </Link>
          </div>
        </div>
      </section>

      {nextEvent && (
        <section className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
          <h2 className="font-heading text-2xl text-charcoal sm:text-3xl">Next event</h2>
          <div className="mt-6">
            <EventCard event={nextEvent} />
          </div>
        </section>
      )}

      {posts.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <h2 className="font-heading text-2xl text-charcoal sm:text-3xl">Latest posts</h2>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2">
            {posts.map((post) => (
              <PostCard key={post._id} post={post} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
