export interface SoldOutBadgeProps {
  /** A single sold piece of a sell-by-piece product reads "Sold", not "Sold
   * out": the product itself may still have other pieces for sale, so the
   * shorter word is the true one. Same pill either way. */
  label?: string;
}

/** Small pill overlay shown on a product photo (grid + gallery) once a
 * tracked variation's count hits zero. Purely presentational — callers decide
 * *whether* to render it (see `lib/inventory-status.ts`). */
export default function SoldOutBadge({ label = 'Sold out' }: SoldOutBadgeProps = {}) {
  return (
    <span className="inline-flex items-center rounded-full bg-olive-deep px-3 py-1 font-body text-xs font-semibold tracking-wide text-cream uppercase">
      {label}
    </span>
  );
}
