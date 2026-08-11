import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import RevealGrid from '@/components/reveal-grid';
import { useReveal } from '@/lib/use-reveal';

type Entry = { isIntersecting: boolean };
type ObserverCallback = (entries: Entry[]) => void;

/** Minimal IntersectionObserver stand-in: jsdom has no real implementation,
 * so tests drive `trigger()` themselves to simulate a viewport crossing. */
class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];
  callback: ObserverCallback;
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();

  constructor(callback: ObserverCallback) {
    this.callback = callback;
    MockIntersectionObserver.instances.push(this);
  }

  trigger(isIntersecting: boolean) {
    this.callback([{ isIntersecting }]);
  }
}

function mockMatchMedia(reduced: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduced,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

function Probe() {
  const { ref, revealed } = useReveal();
  return <div data-testid="probe" data-revealed={revealed} ref={ref} />;
}

beforeEach(() => {
  MockIntersectionObserver.instances = [];
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  mockMatchMedia(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useReveal', () => {
  test('starts unrevealed, then flips true once the node intersects', () => {
    render(<Probe />);
    expect(screen.getByTestId('probe')).toHaveAttribute('data-revealed', 'false');

    const [observer] = MockIntersectionObserver.instances;
    expect(observer.observe).toHaveBeenCalledTimes(1);

    act(() => {
      observer.trigger(true);
    });

    expect(screen.getByTestId('probe')).toHaveAttribute('data-revealed', 'true');
  });

  test('disconnects the observer once revealed', () => {
    render(<Probe />);
    const [observer] = MockIntersectionObserver.instances;

    act(() => {
      observer.trigger(true);
    });

    expect(observer.disconnect).toHaveBeenCalledTimes(1);
  });

  test('does not reveal on a non-intersecting entry', () => {
    render(<Probe />);
    const [observer] = MockIntersectionObserver.instances;

    act(() => {
      observer.trigger(false);
    });

    expect(screen.getByTestId('probe')).toHaveAttribute('data-revealed', 'false');
    expect(observer.disconnect).not.toHaveBeenCalled();
  });

  test('starts revealed under prefers-reduced-motion, without observing', () => {
    mockMatchMedia(true);
    render(<Probe />);

    expect(screen.getByTestId('probe')).toHaveAttribute('data-revealed', 'true');
    expect(MockIntersectionObserver.instances).toHaveLength(0);
  });

  test('starts revealed when IntersectionObserver is unavailable (SSR/E2E safety)', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    render(<Probe />);

    expect(screen.getByTestId('probe')).toHaveAttribute('data-revealed', 'true');
  });
});

describe('RevealGrid', () => {
  test('always includes the reveal-grid class, merged with a passed className', () => {
    render(
      <RevealGrid className="grid grid-cols-2">
        <span>a</span>
      </RevealGrid>,
    );
    const grid = screen.getByText('a').parentElement;
    expect(grid).toHaveClass('reveal-grid', 'grid', 'grid-cols-2');
  });

  test('includes reveal-grid even with no className passed', () => {
    render(
      <RevealGrid>
        <span>a</span>
      </RevealGrid>,
    );
    const grid = screen.getByText('a').parentElement;
    expect(grid).toHaveClass('reveal-grid');
  });

  test('starts data-revealed=false and flips true once its wrapper intersects', () => {
    render(
      <RevealGrid>
        <span>a</span>
        <span>b</span>
      </RevealGrid>,
    );
    const grid = screen.getByText('a').parentElement as HTMLElement;
    expect(grid).toHaveAttribute('data-revealed', 'false');

    const [observer] = MockIntersectionObserver.instances;
    act(() => {
      observer.trigger(true);
    });

    expect(grid).toHaveAttribute('data-revealed', 'true');
  });

  test('renders children unchanged, just wrapped', () => {
    render(
      <RevealGrid>
        <span>first</span>
        <span>second</span>
      </RevealGrid>,
    );
    expect(screen.getByText('first')).toBeInTheDocument();
    expect(screen.getByText('second')).toBeInTheDocument();
  });
});
