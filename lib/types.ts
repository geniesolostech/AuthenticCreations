import { CUSTOM_COLORS, SECTIONS } from '@/lib/constants';

export type CustomColor = (typeof CUSTOM_COLORS)[number];
export type Section = (typeof SECTIONS)[number];

export interface CartLine {
  lineId: string; // crypto.randomUUID()
  variationId: string; // Square catalog variation id
  name: string; // display name, e.g. "Crochet Beanie" or "Custom — Crochet Beanie"
  unitAmount: number; // cents at add-time (server re-checks at checkout)
  quantity: number; // 1..10
  imageUrl?: string;
  custom?: { color: CustomColor; comments: string };
}
