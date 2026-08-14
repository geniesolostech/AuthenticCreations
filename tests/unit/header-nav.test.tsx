import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

// `usePathname` reads a context only the App Router provides, so outside a
// running app it answers null and nothing is ever current. This stands in for
// the router so each render below can say which page it is standing on.
const router = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => router.pathname }));

import HeaderNav, { isNavLinkActive } from '@/components/header-nav';

// jsdom implements no layout — every getBoundingClientRect answers zeros, so
// the mount-time scroll effect sees nothing off-screen and does nothing. The
// scrolling tests below stub the rects to describe the geometry they need.
afterEach(() => {
  vi.restoreAllMocks();
});

function rect(left: number, right: number): DOMRect {
  return {
    left,
    right,
    top: 0,
    bottom: 0,
    x: left,
    y: 0,
    width: right - left,
    height: 0,
    toJSON: () => ({}),
  } as DOMRect;
}

function renderAt(pathname: string) {
  router.pathname = pathname;
  return render(<HeaderNav />);
}

/** The strand slot every link reserves, active or not: the link's last child. */
function strandSlots(): Element[] {
  return screen.getAllByRole('link').map((link) => {
    const slot = link.lastElementChild;
    if (!slot) throw new Error(`nav link "${link.textContent}" reserves no strand slot`);
    return slot;
  });
}

describe('isNavLinkActive', () => {
  test('Home owns the root and nothing below it', () => {
    expect(isNavLinkActive('/', '/')).toBe(true);
    for (const pathname of ['/about', '/blog', '/shop/hats', '/cart']) {
      expect(isNavLinkActive('/', pathname)).toBe(false);
    }
  });

  test('every other link owns its own subtree', () => {
    const inside = [
      ['/shop/hats', '/shop/hats'],
      ['/shop/hats', '/shop/hats/crochet-beanie'],
      ['/shop/hats', '/shop/hats/custom'],
      ['/shop/accessories', '/shop/accessories'],
      ['/shop/accessories', '/shop/accessories/granny-square-bag'],
      ['/about', '/about'],
      ['/blog', '/blog'],
      ['/blog', '/blog/some-post'],
      ['/community', '/community'],
      ['/community', '/community/october-circle'],
    ] as const;

    for (const [href, pathname] of inside) {
      expect(isNavLinkActive(href, pathname)).toBe(true);
    }
  });

  test('a subtree test, not a string-prefix one', () => {
    expect(isNavLinkActive('/shop/hats', '/shop/hats-and-scarves')).toBe(false);
    expect(isNavLinkActive('/about', '/about-cj')).toBe(false);
    expect(isNavLinkActive('/blog', '/blogroll')).toBe(false);
  });

  test('paths under no nav link match nothing', () => {
    for (const pathname of ['/cart', '/thanks', '/policies', '/studio', '/studio/desk/post']) {
      for (const href of ['/', '/shop/hats', '/shop/accessories', '/about', '/blog', '/community']) {
        expect(isNavLinkActive(href, pathname)).toBe(false);
      }
    }
  });

  test('no pathname (rendered outside a router) marks nothing', () => {
    expect(isNavLinkActive('/', null)).toBe(false);
    expect(isNavLinkActive('/blog', null)).toBe(false);
  });
});

describe('HeaderNav', () => {
  test('the current link carries aria-current and a strand; the others carry neither', () => {
    renderAt('/blog');

    const blog = screen.getByRole('link', { name: 'Blog' });
    expect(blog).toHaveAttribute('aria-current', 'page');
    expect(blog.querySelector('[data-testid="yarn-underline"]')).not.toBeNull();

    for (const name of ['Home', 'Hats', 'Accessories', 'About', 'Community']) {
      const link = screen.getByRole('link', { name });
      expect(link).not.toHaveAttribute('aria-current');
      expect(link.querySelector('[data-testid="yarn-underline"]')).toBeNull();
    }

    expect(screen.getAllByTestId('yarn-underline')).toHaveLength(1);
  });

  test('a subpage still marks its section', () => {
    renderAt('/shop/hats/crochet-beanie');

    expect(screen.getByRole('link', { name: 'Hats' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Accessories' })).not.toHaveAttribute('aria-current');
  });

  test('each link wears the yarn color its own page underlines its title with', () => {
    const expected = [
      // First color of the home page's section rotation (app/page.tsx).
      ['/', 'Home', 'stroke-rose'],
      // Both sections share app/shop/[section]/page.tsx's rose title underline.
      ['/shop/hats', 'Hats', 'stroke-rose'],
      ['/shop/accessories', 'Accessories', 'stroke-rose'],
      ['/about', 'About', 'stroke-golden'],
      ['/blog', 'Blog', 'stroke-sage'],
      ['/community', 'Community', 'stroke-plum'],
    ] as const;

    for (const [pathname, name, stroke] of expected) {
      const { unmount } = renderAt(pathname);
      const strand = screen.getByRole('link', { name }).querySelector('[data-testid="yarn-underline"]');
      expect(strand?.querySelector('path')).toHaveClass(stroke);
      unmount();
    }
  });

  test('a page under no nav link underlines nothing', () => {
    for (const pathname of ['/cart', '/thanks', '/policies', '/studio']) {
      const { unmount } = renderAt(pathname);
      expect(screen.queryAllByTestId('yarn-underline')).toHaveLength(0);
      expect(screen.queryByRole('link', { current: 'page' })).toBeNull();
      unmount();
    }
  });

  test('every link reserves the strand slot, so the row is one height on every page', () => {
    // The mechanism, not the pixels. Height: every link carries pb-2 whether or
    // not it holds a strand, so neither the row's height nor the other links'
    // positions can depend on which page is open. Width: the slot is
    // absolutely positioned — in flow, a flex-item link sizes to the
    // max-content of its children, and the strand SVG's intrinsic width is
    // wider than a short word ("Hats" grew a strand overshooting its text on
    // desktop). Out of flow with inset-x-0, the strand is exactly as wide as
    // the text that sizes the link.
    const matched = renderAt('/about');
    const matchedLinks = screen.getAllByRole('link');
    expect(matchedLinks).toHaveLength(6);
    for (const link of matchedLinks) {
      expect(link).toHaveClass('relative', 'pb-2');
    }
    const matchedSlots = strandSlots();
    expect(matchedSlots).toHaveLength(6);
    for (const slot of matchedSlots) {
      // h-2, not the strand's h-1.5: the SVG's own 2px marginTop has to fit
      // INSIDE the slot, or it becomes vertical scrollable overflow in the
      // mobile nav and the strand's lower half hides under the row edge.
      expect(slot).toHaveClass('absolute', 'inset-x-0', 'bottom-0', 'h-2');
      expect(slot).toHaveAttribute('aria-hidden', 'true');
    }
    matched.unmount();

    const unmatched = renderAt('/cart');
    const unmatchedSlots = strandSlots();
    expect(unmatchedSlots).toHaveLength(6);
    for (const slot of unmatchedSlots) {
      expect(slot).toHaveClass('absolute', 'inset-x-0', 'bottom-0', 'h-2');
      expect(slot.children).toHaveLength(0);
    }
    unmatched.unmount();
  });

  test('the strand is scaled down to sit under a nav link, not a heading row', () => {
    renderAt('/community');
    // Overrides YarnUnderline's own height attribute; the path geometry and
    // stroke are untouched, so it still reads as the same wavy yarn.
    expect(screen.getByTestId('yarn-underline')).toHaveClass('h-1.5');
  });

  test('slides the row sideways to an off-screen active link, and only sideways', () => {
    // The nav is a scroll container on BOTH axes on phones (overflow-x forces
    // overflow-y), and scrollIntoView once nudged it vertically, hiding the
    // strand's bottom under the row edge. The effect therefore writes
    // scrollLeft by hand: Community sits 120px past the right edge here, so
    // the row slides exactly that far and the vertical axis is never written.
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ) {
      if (this.tagName === 'NAV') return rect(0, 200);
      if (this.textContent === 'Community') return rect(250, 320);
      return rect(0, 100);
    });
    renderAt('/community');

    const nav = screen.getByRole('navigation');
    expect(nav.scrollLeft).toBe(120);
    expect(nav.scrollTop).toBe(0);
  });

  test('does not move the row when the active link is already visible', () => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ) {
      if (this.tagName === 'NAV') return rect(0, 400);
      return rect(10, 60);
    });
    renderAt('/');

    expect(screen.getByRole('navigation').scrollLeft).toBe(0);
  });

  test('nothing to scroll to when no link is active', () => {
    renderAt('/cart');
    expect(screen.getByRole('navigation').scrollLeft).toBe(0);
  });
});
