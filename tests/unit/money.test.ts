import { formatMoney } from '@/lib/money';

test('formats whole dollar amounts', () => {
  expect(formatMoney(4500)).toBe('$45.00');
});

test('formats zero', () => {
  expect(formatMoney(0)).toBe('$0.00');
});

test('formats amounts with thousands separators', () => {
  expect(formatMoney(1234567)).toBe('$12,345.67');
});
