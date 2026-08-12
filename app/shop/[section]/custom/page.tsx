import Link from 'next/link';
import { notFound } from 'next/navigation';

import CustomOrderForm, { type CustomProductOption } from '@/components/custom-order-form';
import GrannyCornerMotif from '@/components/granny-corner-motif';
import YarnUnderline from '@/components/yarn-underline';
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

  // Every product in the section gets a card, custom SKU or not (pre-launch
  // catalog state can leave `customSquareVariationId` empty for some/all of
  // them) — only products that have one need a price lookup. A product sold in
  // styles (crochet flowers) carries the ids on its variants instead, one per
  // style Square can charge for.
  const ids = [
    ...new Set(
      products
        .flatMap((product) => [
          product.customSquareVariationId,
          ...(product.variants ?? []).map((variant) => variant.customSquareVariationId),
        ])
        .filter((id): id is string => !!id),
    ),
  ];
  const { variations } = await fetchPricesAndStock(ids);

  const options: CustomProductOption[] = products.map((product) => {
    const customVariationId = product.customSquareVariationId ?? null;
    const info = customVariationId ? variations.get(customVariationId) : undefined;
    const variants = (product.variants ?? []).flatMap((variant) => {
      const id = variant.customSquareVariationId;
      // A style with no custom SKU in Square yet — lavender, until CJ builds
      // one — is left off the picker entirely rather than offered as a choice
      // that cannot be priced or charged.
      if (!id) return [];
      return [
        {
          key: variant._key ?? id,
          label: variant.label,
          customVariationId: id,
          priceCents: variations.get(id)?.priceCents ?? null,
        },
      ];
    });
    const photo = product.photos?.[0];
    return {
      id: product._id,
      title: product.title,
      customVariationId,
      // The card can only show one number, and every style of a piece is priced
      // the same in the catalog, so the first one speaks for all of them; a
      // range would be inventing a distinction the shop does not make.
      priceCents: variants.length > 0 ? variants[0].priceCents : (info?.priceCents ?? null),
      variants,
      imageUrl: photo?.asset ? urlFor(photo).width(300).height(300).fit('crop').auto('format').url() : undefined,
    };
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      {/* Woven spec §3/§4: page-title motif + mustard underline. */}
      <div className="inline-flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-3xl text-charcoal sm:text-4xl">
            Custom {SECTION_TITLES[section]}
          </h1>
          <GrannyCornerMotif size="sm" />
        </div>
        <YarnUnderline color="mustard" />
      </div>
      <p className="mt-3 font-body text-charcoal">
        Custom pieces are made just for you; please allow extra time before your order ships.
      </p>

      {options.length === 0 ? (
        <div className="mt-8 flex flex-col items-start gap-3">
          <p className="font-body text-charcoal">
            We don&apos;t have any {SECTION_TITLES[section].toLowerCase()} yet. Check back soon.
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
