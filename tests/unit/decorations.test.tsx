import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import GrannyCornerMotif from '@/components/granny-corner-motif';
import YarnUnderline from '@/components/yarn-underline';

describe('GrannyCornerMotif', () => {
  test('renders an svg that is hidden from assistive tech', () => {
    render(<GrannyCornerMotif />);
    const svg = screen.getByTestId('granny-motif');
    expect(svg.tagName.toLowerCase()).toBe('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('focusable', 'false');
  });

  test('renders 9 rounded-square rects in fixed fill order', () => {
    render(<GrannyCornerMotif />);
    const svg = screen.getByTestId('granny-motif');
    const rects = svg.querySelectorAll('rect');
    expect(rects).toHaveLength(9);

    const expectedFills = [
      'fill-terracotta',
      'fill-mustard',
      'fill-olive-deep',
      'fill-sage',
      'fill-rose',
      'fill-plum',
      'fill-golden',
      'fill-clay',
      'fill-terracotta',
    ];
    rects.forEach((rect, index) => {
      expect(rect).toHaveAttribute('rx', '2');
      expect(rect).toHaveClass(expectedFills[index]);
    });
  });

  test('defaults to sm size (36px)', () => {
    render(<GrannyCornerMotif />);
    const svg = screen.getByTestId('granny-motif');
    expect(svg).toHaveAttribute('width', '36');
    expect(svg).toHaveAttribute('height', '36');
  });

  test('md size renders at 56px', () => {
    render(<GrannyCornerMotif size="md" />);
    const svg = screen.getByTestId('granny-motif');
    expect(svg).toHaveAttribute('width', '56');
    expect(svg).toHaveAttribute('height', '56');
  });

  test('merges a passed className onto the svg root', () => {
    render(<GrannyCornerMotif className="ml-4" />);
    const svg = screen.getByTestId('granny-motif');
    expect(svg).toHaveClass('ml-4');
  });
});

describe('YarnUnderline', () => {
  const expectedPath =
    'M2 5 Q 12 0, 22 5 T 42 5 T 62 5 T 82 5 T 102 5 T 122 5 T 142 5';

  test('renders an svg that is hidden from assistive tech', () => {
    render(<YarnUnderline />);
    const svg = screen.getByTestId('yarn-underline');
    expect(svg.tagName.toLowerCase()).toBe('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('focusable', 'false');
  });

  test('renders the approved wavy-strand path geometry', () => {
    render(<YarnUnderline />);
    const svg = screen.getByTestId('yarn-underline');
    expect(svg).toHaveAttribute('viewBox', '0 0 150 10');
    expect(svg).toHaveAttribute('preserveAspectRatio', 'none');

    const path = svg.querySelector('path');
    expect(path).not.toBeNull();
    expect(path).toHaveAttribute('d', expectedPath);
    expect(path).toHaveAttribute('stroke-width', '2.5');
    expect(path).toHaveAttribute('stroke-linecap', 'round');
    expect(path).toHaveAttribute('fill', 'none');
  });

  test('defaults to the rose stroke color', () => {
    render(<YarnUnderline />);
    const path = screen.getByTestId('yarn-underline').querySelector('path');
    expect(path).toHaveClass('stroke-rose');
  });

  test('applies the requested accent color', () => {
    render(<YarnUnderline color="plum" />);
    const path = screen.getByTestId('yarn-underline').querySelector('path');
    expect(path).toHaveClass('stroke-plum');
  });

  test('merges a passed className onto the svg root', () => {
    render(<YarnUnderline className="mt-1" />);
    const svg = screen.getByTestId('yarn-underline');
    expect(svg).toHaveClass('mt-1');
  });
});
