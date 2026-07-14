import type { CartItem } from '../types';
import { findCategories, hasAny, normalizeText, parseBudget, parseNumbers, parsePeople } from './normalize';
import { findProducts } from './matcher';
import type { ChatIntent, ConversationState, ParsedMessage } from './types';

function detectPreference(text: string) {
  if (/\bikan\b/.test(text)) return 'ikan' as const;
  if (/\bayam\b/.test(text)) return 'ayam' as const;
  if (/\b(sayur|sayuran)\b/.test(text)) return 'sayur' as const;
  return undefined;
}

function detectUnit(text: string) {
  if (/\b(kg|kilo|kilogram)\b/.test(text)) return 'kg';
  if (/\b(ikat)\b/.test(text)) return 'ikat';
  if (/\b(liter|ltr)\b/.test(text)) return 'liter';
  if (/\b(bungkus|pack|pak)\b/.test(text)) return 'bungkus';
  if (/\b(kemasan)\b/.test(text)) return 'kemasan';
  if (/\b(botol)\b/.test(text)) return 'botol';
  return undefined;
}

function detectIntent(text: string, state: ConversationState, productCount: number, cart: CartItem[]): ChatIntent {
  if (hasAny(text, [/\b(halo|hai|pagi|siang|sore|malam)\b/])) return 'greeting';
  if (/(semua menu|lihat menu|buka toko|katalog)/.test(text)) return 'show_store';
  if (/(ubah|ganti|koreksi|edit)/.test(text) && /(pesanan|belanjaan|keranjang)/.test(text)) return 'show_cart';
  if (/(keranjang|belanjaan saya)/.test(text) && !/(tambah|masukkan)/.test(text)) return 'show_cart';
  if (/(total|hitung|berapa semua|jumlah belanja)/.test(text)) return 'show_total';
  if (/(cukup|selesai|checkout|bayar sekarang)/.test(text)) return 'checkout';
  if (/(masak apa|makan apa|menu apa|resep|pilihkan menu|enaknya masak)/.test(text)) return 'start_recipe';
  if (/(budget|anggaran|dana|modal|uang saya|atur uang|belanja pintar)/.test(text) || (parseBudget(text) && /(dapat apa|bisa dapat|pilihkan|atur)/.test(text))) return 'start_budget';
  if (/(tanya pedagang|tanya admin|hubungi admin|hubungi pedagang|chat admin|wa admin)/.test(text)) return 'ask_seller';
  if (/(hapus|batal|tidak jadi)/.test(text) && productCount) return 'remove_items';
  if (/(ubah|ganti|jadi|kurangi)/.test(text) && productCount) return 'update_items';
  if (/(harga|berapa harganya|berapa per)/.test(text) && productCount) return 'ask_price';
  if (/(ada|tersedia|stok)/.test(text) && productCount) return 'ask_availability';
  if ((/(mau|beli|pesan|ambil|tambah|masukkan)/.test(text) || parseNumbers(text).length) && productCount) return 'add_items';
  if (state.pending !== 'none') return 'answer_slot';
  if (/(mau|ingin|pengen).*(pesan|belanja|beli)/.test(text)) return 'start_shopping';
  if (cart.length && /\b(lanjut)\b/.test(text)) return 'show_cart';
  return 'unknown';
}

export function parseMessage(message: string, state: ConversationState, cart: CartItem[] = []): ParsedMessage {
  const normalized = normalizeText(message);
  const productMatches = findProducts(normalized);
  const products = productMatches.map((match) => match.product);
  const quantities = parseNumbers(normalized);
  const categories = [...new Set([...findCategories(normalized), ...products.map((product) => product.category)])];
  const intent = detectIntent(normalized, state, products.length, cart);
  const confidence = products.length || intent !== 'unknown' ? (productMatches.some((match) => match.exact) ? 0.98 : 0.85) : 0.35;

  return {
    raw: message,
    normalized,
    intent,
    entities: {
      products,
      categories,
      quantities,
      unit: detectUnit(normalized),
      budget: parseBudget(normalized),
      people: parsePeople(normalized),
      preference: detectPreference(normalized),
    },
    confidence,
  };
}
