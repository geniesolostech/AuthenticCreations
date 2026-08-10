/** Small pill overlay shown on a product photo (grid + gallery) once a
 * tracked variation's count hits zero. Purely presentational — callers decide
 * *whether* to render it (see `lib/inventory-status.ts`). */
export default function SoldOutBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-charcoal px-3 py-1 font-body text-xs font-semibold tracking-wide text-cream uppercase">
      Sold out
    </span>
  );
}
