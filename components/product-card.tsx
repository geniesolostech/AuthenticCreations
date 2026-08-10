import Link from 'next/link';

import { formatMoney } from '@/lib/money';
import { urlFor } from '@/lib/sanity/image';
import type { Product } from '@/lib/sanity/queries';

import PlaceholderImage from './placeholder-image';
import SoldOutBadge from './sold-out-badge';

export interface ProductCardProps {
  product: Product;
  /** Cents from Square's catalog, or `null` when Square couldn't be reached
   * (dev without creds, or an outage) — renders a "price at checkout"
   * fallback instead of guessing a number. */
  priceCents: number | null;
  soldOut: boolean;
}

/** Grid tile for `/shop/[section]`: photo (or on-brand placeholder), name,
 * price, and a sold-out overlay — links through to the product detail page. */
export default function ProductCard({ product, priceCents, soldOut }: ProductCardProps) {
  const photo = product.photos?.[0];
  const imageUrl = photo?.asset
    ? urlFor(photo).width(600).height(600).fit('crop').auto('format').url()
    : undefined;

  return (
    <Link
      href={`/shop/${product.section}/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl bg-linen transition hover:shadow-md"
    >
      <div className="relative aspect-square w-full overflow-hidden">
        {imageUrl ? (
          // Sanity's CDN already serves responsive, optimized images; no
          // next/image remotePatterns config exists yet for cdn.sanity.io.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={product.title}
            className="h-full w-full max-w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <PlaceholderImage title={product.title} />
        )}
        {soldOut && (
          <div className="absolute right-2 top-2">
            <SoldOutBadge />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 px-3 py-3">
        <h3 className="font-heading text-base text-charcoal">{product.title}</h3>
        <p className="font-body text-sm text-khaki">
          {priceCents === null ? 'Price at checkout' : formatMoney(priceCents)}
        </p>
      </div>
    </Link>
  );
}
