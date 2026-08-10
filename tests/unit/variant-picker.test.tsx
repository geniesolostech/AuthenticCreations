import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import VariantPicker from '@/components/variant-picker';

const variants = [
  { label: 'Rose', squareVariationId: 'rose-1' },
  { label: 'Tulip', squareVariationId: 'tulip-1' },
  { label: 'Lavender', squareVariationId: 'lavender-1' },
];

describe('VariantPicker', () => {
  test('renders three radios for the rose/tulip/lavender fixture, selected marked checked', () => {
    render(<VariantPicker variants={variants} selectedId="rose-1" onSelect={vi.fn()} />);

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
    expect(screen.getByRole('radio', { name: 'Rose' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Tulip' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Lavender' })).not.toBeChecked();
  });

  test('reports the selected variant on change', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<VariantPicker variants={variants} selectedId="rose-1" onSelect={onSelect} />);

    await user.click(screen.getByRole('radio', { name: 'Tulip' }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(variants[1]);
  });
});
