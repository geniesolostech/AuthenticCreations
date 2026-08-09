const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** Formats integer cents as a display string, e.g. 4500 -> "$45.00". */
export function formatMoney(cents: number): string {
  return formatter.format(cents / 100);
}
