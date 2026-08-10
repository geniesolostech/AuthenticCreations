import { render, screen } from '@testing-library/react';
import SiteHeader from '@/components/site-header';
import SiteFooter from '@/components/site-footer';

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
