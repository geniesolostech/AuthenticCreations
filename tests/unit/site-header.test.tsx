import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

// The chip row reads the page being viewed straight off the router. Rather
// than mounting an app-router provider around every render, each test sets
// `router.pathname` and this stub answers with it — the same shape
// `usePathname` has, and the only part of next/navigation the header uses.
const router = vi.hoisted(() => ({ pathname: '/' }));

vi.mock('next/navigation', () => ({
  usePathname: () => router.pathname,
}));

import HeaderBand from '@/components/header-band';
import SiteHeader from '@/components/site-header';
import { NAV_LINKS } from '@/lib/nav-links';
import { QUILT_ROTATION } from '@/lib/quilt';

/** Renders the header as the visitor would see it on `pathname`. */
function renderHeaderAt(pathname: string) {
  router.pathname = pathname;
  return render(<SiteHeader />);
}

/** jsdom never scrolls, so the position the hook reads is set directly. */
function setScrollY(value: number) {
  Object.defineProperty(window, 'scrollY', { value, configurable: true, writable: true });
}

afterEach(() => {
  router.pathname = '/';
  setScrollY(0);
  vi.restoreAllMocks();
});

describe('SiteHeader — chip row', () => {
  test('keeps one link per destination, with the names and hrefs the suite navigates by', () => {
    renderHeaderAt('/cart');

    for (const { name, href } of NAV_LINKS) {
      expect(screen.getByRole('link', { name })).toHaveAttribute('href', href);
    }
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
  });

  test('dresses each chip in the quilt entry for its position (Woven spec §3)', () => {
    renderHeaderAt('/cart');

    NAV_LINKS.forEach(({ name }, index) => {
      const { frame, fill } = QUILT_ROTATION[index];
      expect(screen.getByRole('link', { name })).toHaveClass(frame, fill);
    });
  });

  test('the rotation is fixed by position, so opening a page never recolors the rest', () => {
    const { unmount } = renderHeaderAt('/cart');
    const atRest = NAV_LINKS.map(({ name }) => screen.getByRole('link', { name }).className);
    unmount();

    renderHeaderAt('/blog');
    NAV_LINKS.forEach(({ name, href }, index) => {
      if (href === '/blog') return;
      expect(screen.getByRole('link', { name }).className).toBe(atRest[index]);
    });
  });

  test('marks the page being viewed — one chip, in the action voice, with aria-current', () => {
    for (const { name: currentName, href } of NAV_LINKS) {
      const { unmount } = renderHeaderAt(href);

      for (const { name } of NAV_LINKS) {
        const chip = screen.getByRole('link', { name });
        if (name === currentName) {
          expect(chip).toHaveAttribute('aria-current', 'page');
          expect(chip).toHaveClass('bg-rust', 'text-cream', 'border-rust');
        } else {
          expect(chip).not.toHaveAttribute('aria-current');
          expect(chip).not.toHaveClass('bg-rust');
        }
      }

      unmount();
    }
  });

  test('a product page lights its section chip, not Home', () => {
    renderHeaderAt('/shop/hats/crochet-beanie');

    expect(screen.getByRole('link', { name: 'Hats' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
  });

  test('a post page lights Blog', () => {
    renderHeaderAt('/blog/some-post');

    expect(screen.getByRole('link', { name: 'Blog' })).toHaveAttribute('aria-current', 'page');
  });

  test('a page outside the nav lights nothing', () => {
    renderHeaderAt('/cart');

    for (const { name } of NAV_LINKS) {
      expect(screen.getByRole('link', { name })).not.toHaveAttribute('aria-current');
    }
  });

  test('the chips scroll sideways in their own row instead of wrapping', () => {
    renderHeaderAt('/');
    const nav = screen.getByRole('navigation', { name: 'Main' });

    expect(nav).toHaveClass('overflow-x-auto', 'w-full', 'pr-4');
    expect(nav).not.toHaveClass('flex-wrap');
    // Hidden in both engines: the half-shown chip is the affordance.
    expect(nav).toHaveClass('[scrollbar-width:none]', '[&::-webkit-scrollbar]:hidden');
    // Nothing may shrink a chip below its label, or the row cannot overflow.
    expect(screen.getByRole('link', { name: 'Accessories' })).toHaveClass('shrink-0');
  });
});

describe('SiteHeader — brand', () => {
  test('the mark links home under a name that does not repeat the wordmark', () => {
    renderHeaderAt('/blog');

    const brand = screen.getByRole('link', { name: 'Authentic Creations home' });
    expect(brand).toHaveAttribute('href', '/');
    // alt="" keeps the mark out of the accessible name: from sm: up the
    // wordmark beside it already says those words (docs/known-issues.md
    // records the double announcement as a bug on the hero logo).
    expect(screen.queryByRole('img', { name: /authentic creations/i })).toBeNull();
  });

  test('renders the circular mark with its intrinsic size, so the band cannot reflow', () => {
    const { container } = renderHeaderAt('/');

    const mark = container.querySelector('img[src="/logo-mark.png"]');
    expect(mark).not.toBeNull();
    expect(mark).toHaveAttribute('alt', '');
    expect(mark).toHaveAttribute('width', '320');
    expect(mark).toHaveAttribute('height', '320');
    expect(mark).toHaveClass('h-11', 'w-11', 'sm:h-12', 'sm:w-12');
  });

  test('the wordmark stands down below sm:, where the mark carries the brand alone', () => {
    renderHeaderAt('/');

    const wordmark = screen.getByText('Authentic Creations');
    expect(wordmark).toHaveClass('hidden', 'sm:inline');
    expect(wordmark).toHaveClass('text-2xl', 'sm:text-3xl');
  });
});

describe('SiteHeader — band', () => {
  test('sticks to the top under the mini-cart, on the hero gradient', () => {
    renderHeaderAt('/');
    const band = screen.getByRole('banner');

    expect(band).toHaveClass('sticky', 'top-0');
    expect(band).toHaveClass(
      'bg-[linear-gradient(135deg,var(--color-sand),var(--color-sand-deep))]',
    );
    // Below the mini-cart's scrim (z-40) and panel (z-50) in
    // components/mini-cart.tsx — the slide-over has to cover the header.
    expect(band).toHaveClass('z-30');
    expect(band).not.toHaveClass('z-40', 'z-50');
  });

  test('closes with a yarn strand, edge to edge and hidden from assistive tech', () => {
    renderHeaderAt('/');

    const strand = screen.getByTestId('yarn-underline');
    expect(strand).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('banner')).toContainElement(strand);
    // The path is drawn from x=2 to x=142 of a 150-wide viewBox; 150/140 wide
    // and pulled left by 2/140 is what puts that span across the whole band
    // instead of stopping short of the right edge.
    expect(strand).toHaveClass('w-[107.15%]', '-ml-[1.43%]');
    expect(strand.parentElement).toHaveClass('overflow-hidden');
  });

  test('renders the cart slot, after the nav, untouched', () => {
    router.pathname = '/';
    render(
      <SiteHeader>
        <button type="button">Open cart, empty</button>
      </SiteHeader>,
    );

    const trigger = screen.getByRole('button', { name: 'Open cart, empty' });
    expect(screen.getByRole('banner')).toContainElement(trigger);

    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(nav.compareDocumentPosition(trigger) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('HeaderBand — scrolled shadow', () => {
  function renderBand() {
    return render(
      <HeaderBand>
        <p>band</p>
      </HeaderBand>,
    );
  }

  function scrollTo(value: number) {
    act(() => {
      setScrollY(value);
      window.dispatchEvent(new Event('scroll'));
    });
  }

  test('starts flat, so the server render and the first client render agree', () => {
    renderBand();
    const band = screen.getByRole('banner');

    expect(band).toHaveAttribute('data-scrolled', 'false');
    expect(band).toHaveClass('shadow-none');
    expect(band).not.toHaveClass('shadow-card');
  });

  test('lifts off the page once it is scrolled, and settles again at the top', () => {
    renderBand();
    const band = screen.getByRole('banner');

    scrollTo(240);
    expect(band).toHaveAttribute('data-scrolled', 'true');
    expect(band).toHaveClass('shadow-card');

    scrollTo(0);
    expect(band).toHaveAttribute('data-scrolled', 'false');
    expect(band).toHaveClass('shadow-none');
  });

  test('picks up a scroll position the browser restored before mount', () => {
    setScrollY(600);
    renderBand();

    expect(screen.getByRole('banner')).toHaveClass('shadow-card');
  });

  test('only the shadow changes, so the band cannot shift the page under it', () => {
    renderBand();
    const band = screen.getByRole('banner');
    const flat = band.className;

    scrollTo(240);
    expect(band.className).toBe(flat.replace('shadow-none', 'shadow-card'));
    // The easing is depth, not movement, and it stands down for anyone who
    // asked for less motion.
    expect(band).toHaveClass('transition-shadow', 'duration-200', 'motion-reduce:transition-none');
  });

  test('stops listening when it unmounts', () => {
    const removeListener = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderBand();

    unmount();
    expect(removeListener).toHaveBeenCalledWith('scroll', expect.any(Function));
  });
});
