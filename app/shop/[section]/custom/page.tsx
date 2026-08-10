import Link from 'next/link';
import { notFound } from 'next/navigation';

import CustomOrderForm, { type CustomProductOption } from '@/components/custom-order-form';
import { SECTIONS } from '@/lib/constants';
import { urlFor } from '@/lib/sanity/image';
import { getProducts, type Product } from '@/lib/sanity/queries';
import { fetchPricesAndStock } from '@/lib/shop/fetch-prices';
import { isSection } from '@/lib/shop/is-section';
import type { Section } from '@/lib/types';

// This static `custom` segment already beats the dynamic `[slug]` route for
// the literal path `/shop/[section]/custom` (Next.js route-resolution
// behavior — see the comment in `[slug]/page.tsx`), so no extra config is
// needed here to avoid colliding with a product actually named "custom".

export const revalidate = 60;

const SECTION_TITLES: Record<Section, string> = {
  hats: 'Hats',
  accessories: 'Accessories',
};

export function generateStaticParams() {
  return SECTIONS.map((section) => ({ section }));
}

/** Narrows to products that actually have a custom Square variation set up
 * (pre-launch catalog state can leave this empty for some/all products). */
function hasCustomVariation(product: Product): product is Product & { customSquareVariationId: string } {
  return !!product.customSquareVariationId;
}

export default async function CustomOrderPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!isSection(section)) notFound();

  // Guarded the same way as the grid/detail pages: a Sanity hiccup degrades
  // to the empty-state copy below rather than a crashed page.
  let products: Product[] = [];
  try {
    products = await getProducts(section);
  } catch (error) {
    console.error('[shop] failed to fetch products from Sanity', error);
  }

  const customizable = products.filter(hasCustomVariation);

  const ids = [...new Set(customizable.map((product) => product.customSquareVariationId))];
  const { variations } = await fetchPricesAndStock(ids);

  const options: CustomProductOption[] = customizable.map((product) => {
    const info = variations.get(product.customSquareVariationId);
    const photo = product.photos?.[0];
    return {
      id: product._id,
      title: product.title,
      customVariationId: product.customSquareVariationId,
      priceCents: info?.priceCents ?? null,
      imageUrl: photo?.asset ? urlFor(photo).width(600).height(600).fit('crop').auto('format').url() : undefined,
    };
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="font-heading text-3xl text-charcoal sm:text-4xl">
        Custom {SECTION_TITLES[section]}
      </h1>
      <p className="mt-3 font-body text-charcoal">
        Custom pieces are made just for you — please allow extra time before your order ships.
      </p>

      {options.length === 0 ? (
        <div className="mt-8 flex flex-col items-start gap-3">
          <p className="font-body text-charcoal">
            We don&apos;t have any custom {SECTION_TITLES[section].toLowerCase()} to start from just
            yet — check back soon, or browse what&apos;s ready to ship today.
          </p>
          <Link href={`/shop/${section}`} className="font-body text-sm font-semibold text-rust hover:underline">
            ← Back to {SECTION_TITLES[section]}
          </Link>
        </div>
      ) : (
        <div className="mt-8">
          <CustomOrderForm products={options} />
        </div>
      )}
    </div>
  );
}
