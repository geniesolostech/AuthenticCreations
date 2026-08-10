import Link from 'next/link';
import { notFound } from 'next/navigation';

import ProductCard from '@/components/product-card';
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

  // Sanity is expected to be reachable (Task 3's locked interface); still
  // guarded so a Sanity hiccup degrades to an empty-shelf message rather than
  // a crashed page.
  let products: Product[] = [];
  try {
    products = await getProducts(section);
  } catch (error) {
    console.error('[shop] failed to fetch products from Sanity', error);
  }

  const ids = [...new Set(products.map(primaryVariationId).filter((id) => id !== ''))];
  const { variations, counts } = await fetchPricesAndStock(ids);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="font-heading text-3xl text-charcoal sm:text-4xl">{SECTION_TITLES[section]}</h1>

      {products.length === 0 ? (
        <p className="mt-8 font-body text-charcoal">
          Our shelves for this corner of the shop are still being stitched together — check back soon.
        </p>
      ) : null}

      <div className="mt-8 grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3">
        {products.map((product) => {
          const id = primaryVariationId(product);
          const info = id ? variations.get(id) : undefined;
          const priceCents = info?.priceCents ?? null;
          const soldOut = info ? isSoldOut(info.trackInventory, counts[id]) : false;
          return (
            <ProductCard key={product._id} product={product} priceCents={priceCents} soldOut={soldOut} />
          );
        })}
        <Link
          href={`/shop/${section}/custom`}
          className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-khaki bg-linen px-4 py-8 text-center transition hover:border-rust"
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
