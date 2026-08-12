import { notFound } from 'next/navigation';

import PiecePurchase from '@/components/piece-purchase';
import ProductGallery from '@/components/product-gallery';
import ProductPurchasePanel, { type PurchaseOption } from '@/components/product-purchase-panel';
import { SECTIONS } from '@/lib/constants';
import { urlFor } from '@/lib/sanity/image';
import { getProduct, getProducts } from '@/lib/sanity/queries';
import { fetchPricesAndStock } from '@/lib/shop/fetch-prices';
import { isSection } from '@/lib/shop/is-section';
import { piecesOf } from '@/lib/shop/pieces';

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

interface VariationOption {
  label: string;
  squareVariationId: string;
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ section: string; slug: string }>;
}) {
  const { section, slug } = await params;
  if (!isSection(section)) notFound();

  // Logged and rethrown, deliberately. `getProduct` resolves null for a genuine
  // miss, so this catch only ever sees a real outage — and answering that with
  // `notFound()` would put a cacheable "no such product" in front of a product
  // that exists, outliving the outage by a page lifetime. A throw is a 500:
  // retryable, and never cached.
  let product: Awaited<ReturnType<typeof getProduct>>;
  try {
    product = await getProduct(slug);
  } catch (error) {
    console.error('[shop] failed to fetch product from Sanity', error);
    throw error;
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

  // Empty for every product that is not sold by piece, which is what keeps the
  // branch below a genuine no-op for the rest of the shop.
  const pieces = piecesOf(product);

  const heading = (
    <div>
      <h1 className="font-heading text-3xl text-charcoal">{product.title}</h1>
      {product.description ? (
        <p className="mt-3 font-body text-charcoal">{product.description}</p>
      ) : null}
    </div>
  );

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-2">
      {pieces.length > 0 ? (
        // Both grid columns at once: picking a piece and buying it are one
        // question asked in two places, so one client component owns it.
        <PiecePurchase
          title={product.title}
          pieces={pieces}
          options={purchaseOptions}
          imageUrl={heroImageUrl}
        >
          {heading}
        </PiecePurchase>
      ) : (
        <>
          <ProductGallery title={product.title} photos={product.photos} />
          <div className="flex flex-col gap-6">
            {heading}
            <ProductPurchasePanel
              productName={product.title}
              options={purchaseOptions}
              imageUrl={heroImageUrl}
            />
          </div>
        </>
      )}
    </div>
  );
}
