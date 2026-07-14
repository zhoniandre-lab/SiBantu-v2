import type { CartItem, CategoryId, CommerceAction, Product } from '../types';

export type ChatTopic = 'general' | 'shopping' | 'recipe' | 'budget' | 'checkout';
export type PendingSlot = 'none' | 'product' | 'quantity' | 'budget' | 'people' | 'preference' | 'confirmation';

export type ConversationState = {
  topic: ChatTopic;
  pending: PendingSlot;
  budget?: number;
  people?: number;
  preference?: 'ikan' | 'ayam' | 'sayur';
  lastProductIds: number[];
  lastCategoryIds: CategoryId[];
  turn: number;
};

export type ParsedEntity = {
  products: Product[];
  categories: CategoryId[];
  quantities: number[];
  unit?: string;
  budget?: number;
  people?: number;
  preference?: 'ikan' | 'ayam' | 'sayur';
};

export type ChatIntent =
  | 'greeting'
  | 'show_store'
  | 'start_shopping'
  | 'ask_availability'
  | 'ask_price'
  | 'add_items'
  | 'update_items'
  | 'remove_items'
  | 'show_cart'
  | 'show_total'
  | 'checkout'
  | 'start_budget'
  | 'start_recipe'
  | 'answer_slot'
  | 'ask_seller'
  | 'unknown';

export type ParsedMessage = {
  raw: string;
  normalized: string;
  intent: ChatIntent;
  entities: ParsedEntity;
  confidence: number;
};

export type EngineInput = {
  message: string;
  state?: ConversationState;
  cart?: CartItem[];
};

export type EngineOutput = {
  reply: string;
  state: ConversationState;
  actions: CommerceAction[];
  productIds: number[];
  suggestions: string[];
  confidence: number;
  handoff?: { reason: string; message: string };
};

export const INITIAL_STATE: ConversationState = {
  topic: 'general',
  pending: 'none',
  lastProductIds: [],
  lastCategoryIds: [],
  turn: 0,
};
