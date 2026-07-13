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
};

export type CartItem = {
  productId: number;
  qty: number;
};

export type ChatMessage = {
  id: string;
  role: 'assistant' | 'user';
  text: string;
  productIds?: number[];
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
  productIds?: number[];
  needsAI?: boolean;
};
