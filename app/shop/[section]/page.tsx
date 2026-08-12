import Link from 'next/link';
import { notFound } from 'next/navigation';

import GrannyCornerMotif from '@/components/granny-corner-motif';
import ProductCard from '@/components/product-card';
import YarnUnderline from '@/components/yarn-underline';
import { isSoldOut } from '@/lib/inventory-status';
import { getProducts, type Product } from '@/lib/sanity/queries';
import { fetchPricesAndStock } from '@/lib/shop/fetch-prices';
import { isSection } from '@/lib/shop/is-section';
import { primaryVariationId } from '@/lib/shop/primary-variation-id';
import { SECTIONS } from '@/lib/constants';
import type { Section } from '@/lib/types';

export const revalidate = 60;

const SECTION_TITLES: Record<Section, string> = {
  hats: 'Hats',
  accessories: 'Accessories',
};

export function generateStaticParams() {
  return SECTIONS.map((section) => ({ section }));
}

export default async function ShopSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!isSection(section)) notFound();

  // Logged and rethrown, deliberately — the same reasoning as the detail page.
  // Rendering on despite the failure puts an empty shelf on the page, and
  // `revalidate = 60` then *stores* it: a few seconds of Sanity trouble becomes
  // up to a minute of a shop that looks closed (the accessories grid showing
  // nothing but the custom-order card). A throw is a 500 — retryable, never
  // cached, and ISR keeps serving the last good page meanwhile. An empty list
  // Sanity actually answered with is not a failure and still reaches the
  // friendly copy below.
  let products: Product[];
  try {
    products = await getProducts(section);
  } catch (error) {
    console.error('[shop] failed to fetch products from Sanity', error);
    throw error;
  }

  const ids = [...new Set(products.map(primaryVariationId).filter((id) => id !== ''))];
  const { variations, counts } = await fetchPricesAndStock(ids);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      {/* Woven spec §3/§4: page-title motif + rose underline. */}
      <div className="inline-flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-3xl text-charcoal sm:text-4xl">{SECTION_TITLES[section]}</h1>
          <GrannyCornerMotif size="sm" />
        </div>
        <YarnUnderline color="rose" />
      </div>

      {products.length === 0 ? (
        <p className="mt-8 font-body text-charcoal">
          Our shelves for this corner of the shop are still being stitched together. Check back soon.
        </p>
      ) : null}

      {/* Deliberately NOT wrapped in RevealGrid: this grid is the page's
          main content and a plausible Largest Contentful Paint element, so
          it must never start at opacity:0 waiting on an
          IntersectionObserver (carried finding from Task 4's review). Cards
          still get the quilt frame rotation. */}
      <div className="mt-8 grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3">
        {products.map((product, index) => {
          const id = primaryVariationId(product);
          const info = id ? variations.get(id) : undefined;
          const priceCents = info?.priceCents ?? null;
          const soldOut = info ? isSoldOut(info.trackInventory, counts[id]) : false;
          return (
            <ProductCard
              key={product._id}
              product={product}
              priceCents={priceCents}
              soldOut={soldOut}
              quiltIndex={index}
            />
          );
        })}
        <Link
          href={`/shop/${section}/custom`}
          className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-rose bg-linen px-4 py-8 text-center transition hover:border-rust"
        >
          <span className="font-heading text-lg text-charcoal">
            Want it in <em>your</em> colors?
          </span>
          <span className="font-body text-sm font-semibold text-rust">Make it custom →</span>
        </Link>
      </div>
    </div>
  );
}
