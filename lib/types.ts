export type CategoryId =
  | 'sayur'
  | 'ikan'
  | 'buah'
  | 'sembako'
  | 'daging'
  | 'bumbu'
  | 'rumah';

export type Product = {
  id: number;
  name: string;
  category: CategoryId;
  price: number;
  unit: string;
  emoji: string;
  aliases: string[];
  stock: number;
  description: string;
  badge?: string;
  step?: number;
  quickQuantities?: number[];
  baseUnit?: string;
  packageSize?: number;
  allowPartial?: boolean;
  serviceOptions?: string[];
};

export type CartItem = {
  productId: number;
  qty: number;
  note?: string;
};

export type ChatMessage = {
  id: string;
  role: 'assistant' | 'user';
  text: string;
  productIds?: number[];
  cta?: { label: string; url: string };
  suggestions?: string[];
};

export type CommerceAction =
  | { type: 'none' }
  | { type: 'open_store'; category?: CategoryId }
  | { type: 'show_cart' }
  | { type: 'checkout' }
  | { type: 'add'; productId: number; qty: number }
  | { type: 'set'; productId: number; qty: number }
  | { type: 'remove'; productId: number };

export type ChatResponse = {
  reply: string;
  action: CommerceAction;
  actions?: CommerceAction[];
  productIds?: number[];
  cta?: { label: string; url: string };
  suggestions?: string[];
  needsAI?: boolean;
};
