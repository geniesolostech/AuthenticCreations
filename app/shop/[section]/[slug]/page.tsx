import { notFound } from 'next/navigation';

import ProductGallery from '@/components/product-gallery';
import ProductPurchasePanel, { type PurchaseOption } from '@/components/product-purchase-panel';
import { SECTIONS } from '@/lib/constants';
import { urlFor } from '@/lib/sanity/image';
import { getProduct, getProducts } from '@/lib/sanity/queries';
import { realGateway, type VariationInfo } from '@/lib/square/gateway';
import type { Section } from '@/lib/types';

// Note: once Task 7 adds the static `app/shop/[section]/custom/page.tsx`
// route, Next.js resolves it in preference to this dynamic `[slug]` segment
// for the literal path `/shop/[section]/custom` — no special-casing needed
// here.

export const revalidate = 60;

export async function generateStaticParams(): Promise<{ section: string; slug: string }[]> {
  try {
    const params: { section: string; slug: string }[] = [];
    for (const section of SECTIONS) {
      const products = await getProducts(section);
      for (const product of products) {
        params.push({ section, slug: product.slug });
      }
    }
    return params;
  } catch (error) {
    // Sanity unreachable at build time: fall back to on-demand rendering for
    // every product page instead of failing the whole build.
    console.error('[shop] failed to list products for generateStaticParams', error);
    return [];
  }
}

function isSection(value: string): value is Section {
  return (SECTIONS as readonly string[]).includes(value);
}

interface VariationOption {
  label: string;
  squareVariationId: string;
}

/**
 * Server-fetches Square prices/stock for the given variation ids. Never
 * throws: an unset or unreachable Square falls back to empty maps, so the
 * page still renders with "Price at checkout" and a disabled Add to Cart
 * rather than crashing.
 */
async function fetchPricesAndStock(
  ids: string[],
): Promise<{ variations: Map<string, VariationInfo>; counts: Record<string, number> }> {
  try {
    const gw = realGateway();
    const variations = await gw.getVariations(ids);
    const trackedIds = ids.filter((id) => variations.get(id)?.trackInventory);
    const counts =
      trackedIds.length > 0 ? Object.fromEntries(await gw.getInventoryCounts(trackedIds)) : {};
    return { variations, counts };
  } catch (error) {
    console.error('[shop] failed to fetch Square prices/stock', error);
    return { variations: new Map(), counts: {} };
  }
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ section: string; slug: string }>;
}) {
  const { section, slug } = await params;
  if (!isSection(section)) notFound();

  // Guarded the same way as the grid page: a Sanity hiccup renders a 404
  // rather than an unhandled crash. `getProduct` doesn't otherwise throw for
  // "not found" (it resolves null), so this only ever catches real outages.
  let product: Awaited<ReturnType<typeof getProduct>> = null;
  try {
    product = await getProduct(slug);
  } catch (error) {
    console.error('[shop] failed to fetch product from Sanity', error);
  }
  if (!product || product.section !== section) notFound();

  const options: VariationOption[] =
    product.variants && product.variants.length > 0
      ? product.variants.map((variant) => ({
          label: variant.label,
          squareVariationId: variant.squareVariationId,
        }))
      : [{ label: product.title, squareVariationId: product.squareVariationId ?? '' }];

  const ids = [...new Set(options.map((option) => option.squareVariationId).filter((id) => id !== ''))];
  const { variations, counts } = await fetchPricesAndStock(ids);

  const purchaseOptions: PurchaseOption[] = options.map((option) => {
    const info = option.squareVariationId ? variations.get(option.squareVariationId) : undefined;
    return {
      label: option.label,
      variationId: option.squareVariationId,
      priceCents: info?.priceCents ?? null,
      trackInventory: info?.trackInventory ?? false,
      initialCount: option.squareVariationId ? counts[option.squareVariationId] : undefined,
    };
  });

  const firstPhoto = product.photos?.[0];
  const heroImageUrl = firstPhoto?.asset
    ? urlFor(firstPhoto).width(1200).height(1200).fit('crop').auto('format').url()
    : undefined;

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-2">
      <ProductGallery title={product.title} photos={product.photos} />
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-heading text-3xl text-charcoal">{product.title}</h1>
          {product.description ? (
            <p className="mt-3 font-body text-charcoal">{product.description}</p>
          ) : null}
        </div>
        <ProductPurchasePanel productName={product.title} options={purchaseOptions} imageUrl={heroImageUrl} />
      </div>
    </div>
  );
}
