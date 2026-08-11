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

test('footer shows tagline and policies link', () => {
  render(<SiteFooter />);
  expect(screen.getByText(/find you in whatever you do/i)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /shipping & returns/i })).toHaveAttribute('href', '/policies');
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
