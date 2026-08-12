import { readFileSync } from 'node:fs';
import path from 'node:path';
import { render, screen } from '@testing-library/react';
import SiteHeader from '@/components/site-header';
import SiteFooter from '@/components/site-footer';

const globalsCssPath = path.resolve(import.meta.dirname, '../../app/globals.css');
const globalsCss = readFileSync(globalsCssPath, 'utf-8');

test('header shows brand name and main nav', () => {
  render(<SiteHeader />);
  expect(screen.getByRole('link', { name: /authentic creations/i })).toHaveAttribute('href', '/');
  for (const [name, href] of [['Home', '/'], ['Hats', '/shop/hats'], ['Accessories', '/shop/accessories'], ['About', '/about'], ['Blog', '/blog'], ['Community', '/community']] as const) {
    expect(screen.getByRole('link', { name })).toHaveAttribute('href', href);
  }
});

test('header nav reads at a comfortable size, without becoming a redesign', () => {
  render(<SiteHeader />);

  const wordmark = screen.getByRole('link', { name: /authentic creations/i });
  expect(wordmark).toHaveClass('text-2xl', 'sm:text-3xl');
  expect(wordmark).not.toHaveClass('text-xl');

  const nav = screen.getByRole('navigation', { name: 'Main' });
  expect(nav).toHaveClass('text-lg', 'font-semibold');
  expect(nav).not.toHaveClass('text-sm');

  // The parts that must not move: links still wrap, and still go rust on hover.
  expect(nav).toHaveClass('flex-wrap');
  expect(screen.getByRole('link', { name: 'Hats' })).toHaveClass('hover:text-rust');
});

test('footer shows tagline and policies link', () => {
  render(<SiteFooter />);
  expect(screen.getByText(/find you in whatever you do/i)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /shipping & returns/i })).toHaveAttribute('href', '/policies');
});

test('footer shows an md crochet motif above the tagline (Woven spec §4)', () => {
  render(<SiteFooter />);
  const motif = screen.getByTestId('granny-motif');
  expect(motif).toHaveAttribute('width', '56');
  expect(motif).toHaveAttribute('height', '56');

  const tagline = screen.getByText(/find you in whatever you do/i);
  expect(motif.compareDocumentPosition(tagline) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test('globals.css @theme defines the Woven structure + accent token set', () => {
  const expectedTokens = [
    // structure tier (spec §2)
    '--color-terracotta',
    '--color-mustard',
    '--color-olive-deep',
    '--color-clay',
    '--color-sand',
    '--color-sand-deep',
    '--color-sage-band',
    // accent tier (spec §2) — small doses only
    '--color-rose',
    '--color-plum',
    '--color-sage',
    '--color-golden',
    // tinted card fills (spec §2)
    '--color-rose-tint',
    '--color-plum-tint',
    '--color-sage-tint',
    '--color-golden-tint',
    '--color-mustard-tint',
    '--color-clay-tint',
    // card depth (spec §5)
    '--shadow-card',
    '--shadow-card-hover',
  ];

  for (const token of expectedTokens) {
    expect(globalsCss).toContain(token);
  }
});

test('globals.css reveal-grid stagger only delays entrance properties, not hover/selection feedback', () => {
  // transition-property order is [opacity, transform, box-shadow,
  // border-color, background-color]; transition-delay must be a matching
  // 5-value list so only opacity/transform (entrance) carry the stagger and
  // box-shadow/border-color/background-color (hover, selection) stay at 0s —
  // otherwise a wrapped card's hover shadow / the custom picker's selection
  // border+fill freeze for up to 660ms after reveal (final-review Finding 1).
  const delays = [
    ['1', '0s, 0s, 0s, 0s, 0s'],
    ['2', '60ms, 60ms, 0s, 0s, 0s'],
    ['3', '120ms, 120ms, 0s, 0s, 0s'],
    ['4', '180ms, 180ms, 0s, 0s, 0s'],
    ['5', '240ms, 240ms, 0s, 0s, 0s'],
    ['6', '300ms, 300ms, 0s, 0s, 0s'],
    ['7', '360ms, 360ms, 0s, 0s, 0s'],
    ['8', '420ms, 420ms, 0s, 0s, 0s'],
    ['9', '480ms, 480ms, 0s, 0s, 0s'],
    ['10', '540ms, 540ms, 0s, 0s, 0s'],
    ['11', '600ms, 600ms, 0s, 0s, 0s'],
    ['12', '660ms, 660ms, 0s, 0s, 0s'],
    ['n+13', '660ms, 660ms, 0s, 0s, 0s'],
  ] as const;

  for (const [nth, value] of delays) {
    expect(globalsCss).toContain(
      `.reveal-grid[data-revealed='true'] > *:nth-child(${nth}) { transition-delay: ${value}; }`,
    );
  }
});

test('globals.css does not alter the pre-existing brand tokens', () => {
  const existingTokens = [
    '--color-cream: #f7f1e5;',
    '--color-linen: #efe6d4;',
    '--color-rust: #c9622b;',
    '--color-rust-soft: #e8894a;',
    '--color-charcoal: #3a3734;',
    '--color-khaki: #a98f68;',
    '--color-olive: #6b7245;',
  ];

  for (const token of existingTokens) {
    expect(globalsCss).toContain(token);
  }
});
