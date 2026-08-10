/**
 * Hand-rolled stand-in for the real Square gateway, shared by the route tests.
 *
 * Mirrors the real gateway's contract exactly: unknown ids are omitted from
 * `getVariations`, and untracked ids are omitted from `getInventoryCounts`
 * (Square has no IN_STOCK row for them). Set `failOn.<method>` to make that
 * method reject, which is how the routes' 503 paths are exercised.
 */
import type { SquareGateway, VariationInfo } from '@/lib/square/gateway';

export class FakeGateway implements SquareGateway {
  variations = new Map<string, VariationInfo>();
  inventory = new Map<string, number>();
  paymentLinkUrl = 'https://square.link/u/fake';

  /** Set to make the next call of the named method reject. */
  failOn: Partial<Record<keyof SquareGateway, Error>> = {};

  calls = {
    getVariations: [] as string[][],
    getInventoryCounts: [] as string[][],
    createPaymentLink: [] as Parameters<SquareGateway['createPaymentLink']>[0][],
  };

  withVariation(info: VariationInfo): this {
    this.variations.set(info.id, info);
    return this;
  }

  withCount(id: string, count: number): this {
    this.inventory.set(id, count);
    return this;
  }

  async getVariations(ids: string[]): Promise<Map<string, VariationInfo>> {
    this.calls.getVariations.push([...ids]);
    if (this.failOn.getVariations) throw this.failOn.getVariations;
    const out = new Map<string, VariationInfo>();
    for (const id of ids) {
      const info = this.variations.get(id);
      if (info) out.set(id, info);
    }
    return out;
  }

  async getInventoryCounts(ids: string[]): Promise<Map<string, number>> {
    this.calls.getInventoryCounts.push([...ids]);
    if (this.failOn.getInventoryCounts) throw this.failOn.getInventoryCounts;
    const out = new Map<string, number>();
    for (const id of ids) {
      const count = this.inventory.get(id);
      // Untracked variations simply have no count row.
      if (count !== undefined) out.set(id, count);
    }
    return out;
  }

  async createPaymentLink(
    input: Parameters<SquareGateway['createPaymentLink']>[0],
  ): Promise<{ url: string }> {
    this.calls.createPaymentLink.push(input);
    if (this.failOn.createPaymentLink) throw this.failOn.createPaymentLink;
    return { url: this.paymentLinkUrl };
  }
}
