export interface CreditPack {
  id: string;
  name: string;
  credits: number;
  price: number; // cents AUD
  popular?: boolean;
}

export const CREDIT_PACKS: CreditPack[] = [
  { id: 'starter', name: 'Starter', credits: 20, price: 990 },
  { id: 'pro', name: 'Pro', credits: 100, price: 3900, popular: true },
  { id: 'business', name: 'Business', credits: 500, price: 14900 },
];

export const CREDIT_COSTS = {
  AI_DESCRIPTION: 1,
  AI_OTHER: 1,
  SHOPIFY_UPLOAD: 0,
} as const;
