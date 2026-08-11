import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import SoldOutBadge from '@/components/sold-out-badge';

describe('SoldOutBadge', () => {
  test('shows the "Sold out" label', () => {
    render(<SoldOutBadge />);
    expect(screen.getByText(/sold out/i)).toBeInTheDocument();
  });

  test('sits on the olive-deep structure color, not charcoal (Woven spec §3)', () => {
    render(<SoldOutBadge />);
    expect(screen.getByText(/sold out/i)).toHaveClass('bg-olive-deep', 'text-cream');
    expect(screen.getByText(/sold out/i)).not.toHaveClass('bg-charcoal');
  });
});
