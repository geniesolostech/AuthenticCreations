'use client';

import PlaceholderImage from '@/components/placeholder-image';
import { useCart } from '@/lib/cart-context';
import { MAX_LINE_QUANTITY, MIN_LINE_QUANTITY } from '@/lib/constants';
import { formatMoney } from '@/lib/money';
import type { CartLine } from '@/lib/types';

export interface CartLineRowProps {
  line: CartLine;
  /** Set when the last checkout attempt came back SOLD_OUT for this line's
   * variation, so the shopper can see *which* item Square turned down. */
  soldOut?: boolean;
}

/**
 * One line of the cart, used at both sizes (slide-over and `/cart`) — the
 * container decides the width, the row only lays itself out.
 *
 * The stepper states its bounds instead of relying on the cart engine's silent
 * clamp: `−` is disabled at 1 and `+` at 10, where it also explains why.
 */
export default function CartLineRow({ line, soldOut = false }: CartLineRowProps) {
  const { remove, setQty } = useCart();
  const atMin = line.quantity <= MIN_LINE_QUANTITY;
  const atMax = line.quantity >= MAX_LINE_QUANTITY;

  return (
    <li
      className={`flex gap-3 py-4${soldOut ? ' border-l-4 border-rust pl-3' : ''}`}
    >
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-linen">
        {line.imageUrl ? (
          // Sanity's CDN already serves optimized images and no next/image
          // remotePatterns entry exists for it yet (see components/product-card).
          // eslint-disable-next-line @next/next/no-img-element
          <img src={line.imageUrl} alt={line.name} className="h-full w-full max-w-full object-cover" />
        ) : (
          <PlaceholderImage title={line.name} hideTitle />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-3">
          <p className="font-heading text-base text-charcoal">{line.name}</p>
          <p className="shrink-0 font-body text-sm font-semibold text-charcoal">
            {formatMoney(line.unitAmount * line.quantity)}
          </p>
        </div>

        {line.custom && (
          <div className="flex flex-col gap-0.5">
            <p className="font-body text-sm text-khaki">{`Color: ${line.custom.color}`}</p>
            {line.custom.comments !== '' && (
              <p className="line-clamp-2 font-body text-sm text-khaki">{line.custom.comments}</p>
            )}
          </div>
        )}

        {soldOut && (
          <p data-testid="line-sold-out" className="font-body text-sm font-semibold text-rust">
            {'just sold out'}
          </p>
        )}

        <div className="mt-1 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-full border border-khaki">
            <button
              type="button"
              aria-label={`Decrease quantity of ${line.name}`}
              disabled={atMin}
              onClick={() => setQty(line.lineId, line.quantity - 1)}
              className="h-8 w-8 rounded-full font-body text-lg text-charcoal transition hover:text-rust disabled:cursor-not-allowed disabled:text-khaki disabled:hover:text-khaki"
            >
              −
            </button>
            <span aria-live="polite" className="min-w-6 text-center font-body text-sm text-charcoal">
              {line.quantity}
            </span>
            <button
              type="button"
              aria-label={`Increase quantity of ${line.name}`}
              disabled={atMax}
              onClick={() => setQty(line.lineId, line.quantity + 1)}
              className="h-8 w-8 rounded-full font-body text-lg text-charcoal transition hover:text-rust disabled:cursor-not-allowed disabled:text-khaki disabled:hover:text-khaki"
            >
              +
            </button>
          </div>

          {atMax && <span className="font-body text-xs text-khaki">{`max ${MAX_LINE_QUANTITY} per order`}</span>}

          <button
            type="button"
            aria-label={`Remove ${line.name} from cart`}
            onClick={() => remove(line.lineId)}
            className="font-body text-sm text-khaki underline underline-offset-2 transition hover:text-rust"
          >
            Remove
          </button>
        </div>
      </div>
    </li>
  );
}
