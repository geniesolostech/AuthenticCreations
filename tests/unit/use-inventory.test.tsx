import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { useInventory } from '@/lib/use-inventory';

function Probe({ ids, initial }: { ids: string[]; initial?: Record<string, number> }) {
  const counts = useInventory(ids, initial);
  return <pre data-testid="counts">{JSON.stringify(counts)}</pre>;
}

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { value: hidden, configurable: true });
}

/** Flushes the microtask chain of an in-flight fetch (and any timer due
 * within `ms`) under fake timers — `advanceTimersByTimeAsync` interleaves
 * timer callbacks with promise microtasks, which plain `advanceTimersByTime`
 * does not. */
async function flush(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  setHidden(false);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  setHidden(false);
});

describe('useInventory', () => {
  test('fetches counts on mount and reflects them', async () => {
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ counts: { 'var-a': 3 } }), { status: 200 }));

    render(<Probe ids={['var-a']} />);
    await flush();

    expect(screen.getByTestId('counts').textContent).toContain('"var-a":3');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('/api/inventory?ids=var-a');
  });

  test('degrades gracefully on a 503, keeping the last known counts', async () => {
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ counts: { 'var-a': 3 } }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'SQUARE_UNAVAILABLE' }), { status: 503 }),
      );

    render(<Probe ids={['var-a']} />);
    await flush();
    expect(screen.getByTestId('counts').textContent).toContain('"var-a":3');

    await flush(60_000);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('counts').textContent).toContain('"var-a":3');
  });

  test('degrades gracefully on a network failure, keeping the last known counts', async () => {
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ counts: { 'var-a': 3 } }), { status: 200 }))
      .mockRejectedValueOnce(new Error('network down'));

    render(<Probe ids={['var-a']} />);
    await flush();
    expect(screen.getByTestId('counts').textContent).toContain('"var-a":3');

    await flush(60_000);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('counts').textContent).toContain('"var-a":3');
  });

  test('does not fetch when there are no ids to ask about', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));

    render(<Probe ids={[]} />);
    await flush();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('skips a poll while the document is hidden', async () => {
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ counts: { 'var-a': 3 } }), { status: 200 }));

    render(<Probe ids={['var-a']} />);
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    setHidden(true);
    await flush(60_000);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('stops polling after unmount', async () => {
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ counts: { 'var-a': 3 } }), { status: 200 }));

    const { unmount } = render(<Probe ids={['var-a']} />);
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    unmount();
    await flush(120_000);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
