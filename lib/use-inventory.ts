'use client';

import { useEffect, useState } from 'react';

const POLL_INTERVAL_MS = 60_000;

interface InventoryResponse {
  counts: Record<string, number>;
}

function isInventoryResponse(value: unknown): value is InventoryResponse {
  if (value === null || typeof value !== 'object') return false;
  const counts = (value as { counts?: unknown }).counts;
  return typeof counts === 'object' && counts !== null;
}

/**
 * Client-side live refresh of `/api/inventory` for a fixed set of variation
 * ids. Seeds from the server-rendered `initialCounts` so there is never a
 * flash of "unknown" on mount, then polls on mount and every 60s while the
 * tab is visible.
 *
 * Degrades gracefully: a non-OK response (e.g. 503 SQUARE_UNAVAILABLE) or a
 * thrown fetch (network down) is swallowed and the previous counts are kept
 * as-is — a Square hiccup must never flicker a product to "available" or
 * "sold out" on bad information.
 */
export function useInventory(
  ids: string[],
  initialCounts: Record<string, number> = {},
): Record<string, number> {
  const [counts, setCounts] = useState<Record<string, number>>(initialCounts);
  const key = ids.join(',');

  useEffect(() => {
    if (key === '') return;
    let cancelled = false;

    async function refresh() {
      if (document.hidden) return;
      try {
        const query = key
          .split(',')
          .map((id) => encodeURIComponent(id))
          .join(',');
        const response = await fetch(`/api/inventory?ids=${query}`);
        if (!response.ok) return; // e.g. 503 SQUARE_UNAVAILABLE — keep prior counts
        const data: unknown = await response.json();
        if (!cancelled && isInventoryResponse(data)) {
          setCounts(data.counts);
        }
      } catch {
        // Network failure — keep prior counts.
      }
    }

    function onVisibilityChange() {
      if (!document.hidden) void refresh();
    }

    void refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [key]);

  return counts;
}
