import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import RichText from '@/components/portable-text';
import type { PortableTextBlock } from '@/lib/sanity/queries';

describe('RichText', () => {
  test('renders an h2 block with the heading font class', () => {
    const value: PortableTextBlock[] = [
      {
        _type: 'block',
        _key: 'a',
        style: 'h2',
        children: [{ _type: 'span', _key: 'a1', text: 'Meet CJ', marks: [] }],
      },
    ];

    render(<RichText value={value} />);

    const heading = screen.getByRole('heading', { level: 2, name: 'Meet CJ' });
    expect(heading).toHaveClass('font-heading');
  });

  test('renders a link mark with the rust text color and the correct href', () => {
    const value: PortableTextBlock[] = [
      {
        _type: 'block',
        _key: 'p1',
        style: 'normal',
        markDefs: [{ _type: 'link', _key: 'link1', href: '/shop/hats' }],
        children: [{ _type: 'span', _key: 'p1s', text: 'our hats', marks: ['link1'] }],
      },
    ];

    render(<RichText value={value} />);

    const link = screen.getByRole('link', { name: 'our hats' });
    expect(link).toHaveClass('text-rust');
    expect(link).toHaveAttribute('href', '/shop/hats');
  });

  test('an internal link gets no target or rel attributes', () => {
    const value: PortableTextBlock[] = [
      {
        _type: 'block',
        _key: 'p1',
        style: 'normal',
        markDefs: [{ _type: 'link', _key: 'link1', href: '/about' }],
        children: [{ _type: 'span', _key: 'p1s', text: 'read more', marks: ['link1'] }],
      },
    ];

    render(<RichText value={value} />);

    const link = screen.getByRole('link', { name: 'read more' });
    expect(link).not.toHaveAttribute('target');
    expect(link).not.toHaveAttribute('rel');
  });

  test('an external link (http/https href) gets rel="noopener noreferrer" and opens in a new tab', () => {
    const value: PortableTextBlock[] = [
      {
        _type: 'block',
        _key: 'p2',
        style: 'normal',
        markDefs: [{ _type: 'link', _key: 'link2', href: 'https://instagram.com/authenticcreations' }],
        children: [{ _type: 'span', _key: 'p2s', text: 'follow along', marks: ['link2'] }],
      },
    ];

    render(<RichText value={value} />);

    const link = screen.getByRole('link', { name: 'follow along' });
    expect(link).toHaveAttribute('href', 'https://instagram.com/authenticcreations');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveAttribute('target', '_blank');
  });

  test('renders an inline image with alt text sourced from the image field', () => {
    const value: PortableTextBlock[] = [
      {
        _type: 'image',
        _key: 'img1',
        asset: { _ref: 'image-test123abc-800x600-jpg', _type: 'reference' },
        alt: 'A finished rust bucket hat laid flat',
      },
    ];

    render(<RichText value={value} />);

    expect(
      screen.getByRole('img', { name: 'A finished rust bucket hat laid flat' }),
    ).toBeInTheDocument();
  });

  test('an inline image with no alt field falls back to an empty alt, not "undefined"', () => {
    const value: PortableTextBlock[] = [
      { _type: 'image', _key: 'img2', asset: { _ref: 'image-test456def-800x600-jpg', _type: 'reference' } },
    ];

    const { container } = render(<RichText value={value} />);

    const img = container.querySelector('img');
    expect(img).toHaveAttribute('alt', '');
  });

  test('paragraphs render with a comfortable line-height class', () => {
    const value: PortableTextBlock[] = [
      {
        _type: 'block',
        _key: 'p3',
        style: 'normal',
        children: [{ _type: 'span', _key: 'p3s', text: 'A cozy paragraph.', marks: [] }],
      },
    ];

    render(<RichText value={value} />);

    expect(screen.getByText('A cozy paragraph.')).toHaveClass('leading-relaxed');
  });

  test('renders nothing for an empty value', () => {
    const { container } = render(<RichText value={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  test('renders nothing for a missing value', () => {
    const { container } = render(<RichText value={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });
});
