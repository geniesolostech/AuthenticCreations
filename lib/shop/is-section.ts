import { SECTIONS } from '@/lib/constants';
import type { Section } from '@/lib/types';

/** Type guard for the `section` route param — shared by every `/shop/[section]/...` page. */
export function isSection(value: string): value is Section {
  return (SECTIONS as readonly string[]).includes(value);
}
