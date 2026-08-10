/**
 * `POST /api/checkout` — the only way a cart becomes a payment link.
 *
 * Thin by design: parse the body, hand it to `createCheckout`, map the result to
 * a status. Availability and price are decided by `lib/square/service.ts`
 * against live Square data; re-checking either here would be a second, weaker
 * source of truth.
 *
 * Failure bodies are closed codes the UI switches on. No SDK message, no token,
 * no internal text ever reaches the client — those go to the server log only.
 */
import { checkoutBodySchema } from '@/lib/api-schemas';
// The gateway singleton and its test seam live in lib/square/runtime.ts: a Next
// route module may export only its handlers and route config, so anything else
// has to have a home elsewhere.
import { squareGateway } from '@/lib/square/runtime';
import { createCheckout, type CheckoutResult } from '@/lib/square/service';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    // Malformed JSON is a malformed request, not a server fault.
    return invalidBody();
  }

  const parsed = checkoutBodySchema.safeParse(body);
  // Deliberately no zod issue detail in the response: the client already knows
  // the contract, and echoing parser output is free reconnaissance.
  if (!parsed.success) return invalidBody();

  let result: CheckoutResult;
  try {
    result = await createCheckout(parsed.data.lines, squareGateway());
  } catch (error) {
    // `createCheckout` contains its own failures; this catches the one thing it
    // cannot — a gateway that will not even construct (misconfigured env).
    console.error('[api/checkout] checkout could not be attempted', error);
    return unavailable();
  }

  if (result.ok) return Response.json({ url: result.url });

  switch (result.error) {
    case 'SOLD_OUT':
      return Response.json(
        { error: 'SOLD_OUT', soldOutIds: result.soldOutIds ?? [] },
        { status: 409 },
      );
    case 'PRICE_CHANGED':
      // The fresh catalog prices go back with the refusal so the cart can
      // correct itself. Without them the shopper's stale localStorage price is
      // re-sent on every retry and the 409 never clears.
      return Response.json(
        { error: 'PRICE_CHANGED', prices: result.prices ?? {} },
        { status: 409 },
      );
    case 'EMPTY_CART':
      // Unreachable through this route — zod rejects an empty `lines` array
      // first — but mapped rather than defaulted, so the switch stays exhaustive
      // if the service's rules ever change.
      return invalidBody();
    case 'SQUARE_UNAVAILABLE':
      return unavailable();
  }
}

function invalidBody(): Response {
  return Response.json({ error: 'INVALID_REQUEST' }, { status: 400 });
}

function unavailable(): Response {
  return Response.json({ error: 'SQUARE_UNAVAILABLE' }, { status: 503 });
}
