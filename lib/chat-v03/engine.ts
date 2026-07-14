import { PRODUCTS } from '../catalog';
import { formatQty, rupiah } from '../format';
import { STORE_CONFIG } from '../store-config';
import type { CommerceAction } from '../types';
import { findProductById } from './matcher';
import { parseMessage } from './parser';
import { INITIAL_STATE, type ConversationState, type EngineInput, type EngineOutput } from './types';

function nextState(current?: ConversationState): ConversationState {
  return { ...(current ?? INITIAL_STATE), lastProductIds: [...(current?.lastProductIds ?? [])], lastCategoryIds: [...(current?.lastCategoryIds ?? [])], turn: (current?.turn ?? 0) + 1 };
}

function output(reply: string, state: ConversationState, options: Partial<EngineOutput> = {}): EngineOutput {
  return { reply, state, actions: [], productIds: [], suggestions: [], confidence: 1, ...options };
}

function budgetSuggestion(budget: number, people: number, preference?: 'ikan' | 'ayam' | 'sayur') {
  const bundles = [
    { key: 'ayam', name: 'ayam kecap dan tumis kangkung', ids: [20, 54, 51, 4], quantities: [0.5, 1, 0.25, 1] },
    { key: 'ikan', name: 'lele goreng dan sayur segar', ids: [11, 2, 1, 50], quantities: [0.5, 1, 1, 0.1] },
    { key: 'sayur', name: 'telur dan sayur hemat', ids: [22, 2, 1], quantities: [0.5, 1, 1] },
  ].map((bundle) => ({ ...bundle, total: bundle.ids.reduce((sum, id, index) => sum + (findProductById(id)?.price ?? 0) * bundle.quantities[index], 0) }));
  const preferred = preference ? bundles.filter((bundle) => bundle.key === preference) : bundles;
  return preferred.find((bundle) => bundle.total <= budget) ?? bundles.filter((bundle) => bundle.total <= budget).sort((a, b) => b.total - a.total)[0];
}

export function runChatEngine(input: EngineInput): EngineOutput {
  const state = nextState(input.state);
  const cart = input.cart ?? [];
  const parsed = parseMessage(input.message, state, cart);
  const { entities } = parsed;

  if (entities.products.length) state.lastProductIds = entities.products.map((product) => product.id);
  if (entities.categories.length) state.lastCategoryIds = entities.categories;
  if (entities.preference) state.preference = entities.preference;

  if (parsed.intent === 'greeting') {
    state.topic = 'general'; state.pending = 'none';
    return output('Halo, Kak! Mau belanja, cari bahan masakan, atau minta saya pilihkan sesuai budget?', state, { suggestions: ['Belanja sesuai budget', 'Cari bahan masakan', 'Lihat semua menu'] });
  }

  if (parsed.intent === 'show_store') return output('Siap, saya buka semua produk yang tersedia hari ini.', state, { actions: [{ type: 'open_store' }] });
  if (parsed.intent === 'show_cart') {
    state.pending = 'none';
    return output(cart.length ? 'Tentu. Saya buka keranjang; jumlah bisa ditambah, dikurangi, atau dihapus.' : 'Keranjang masih kosong. Saya buka semua menu dulu, ya.', state, { actions: [cart.length ? { type: 'show_cart' } : { type: 'open_store' }] });
  }
  if (parsed.intent === 'show_total') {
    state.pending = 'none';
    return output(cart.length ? 'Siap, saya buka keranjang dan hitung subtotalnya.' : 'Keranjang masih kosong, jadi belum ada total yang dihitung.', state, { actions: cart.length ? [{ type: 'show_cart' }] : [] });
  }
  if (parsed.intent === 'checkout') {
    state.pending = 'none';
    return output(cart.length ? 'Baik, kita lanjut ke alamat pengantaran.' : 'Keranjang masih kosong. Pilih barang terlebih dahulu, ya.', state, { actions: cart.length ? [{ type: 'checkout' }] : [{ type: 'open_store' }] });
  }

  if (parsed.intent === 'start_budget') {
    state.topic = 'budget';
    if (entities.budget) {
      state.budget = entities.budget; state.pending = entities.people ? 'preference' : 'people';
      if (entities.people) state.people = entities.people;
    } else state.pending = 'budget';
    if (!state.budget) return output('Siap. Berapa budget belanja hari ini?', state, { suggestions: ['50 ribu', '100 ribu', '150 ribu'] });
    if (!state.people) return output(`Budget ${rupiah(state.budget)}. Untuk berapa orang?`, state, { suggestions: ['2 orang', '3 orang', '4 orang'] });
  }

  if (parsed.intent === 'start_recipe') {
    state.topic = 'recipe'; state.pending = entities.people ? 'preference' : 'people';
    if (entities.people) state.people = entities.people;
    if (!state.people) return output('Boleh. Lagi ingin menu ikan, ayam, atau sayur? Kalau bosan, saya bisa pilihkan. Untuk berapa orang?', state, { productIds: [10, 20, 2], suggestions: ['2 orang', '3 orang', '4 orang'] });
  }

  if (parsed.intent === 'answer_slot') {
    if (state.pending === 'budget' && entities.budget) { state.budget = entities.budget; state.pending = 'people'; return output(`Baik, budget ${rupiah(state.budget)}. Untuk berapa orang?`, state, { suggestions: ['2 orang', '3 orang', '4 orang'] }); }
    if (state.pending === 'people' && entities.people) { state.people = entities.people; state.pending = 'preference'; }
    if (state.pending === 'preference' && entities.preference) { state.preference = entities.preference; state.pending = 'confirmation'; }
  }

  if (state.topic === 'budget' && state.budget && state.people) {
    const bundle = budgetSuggestion(state.budget, state.people, entities.preference ?? state.preference);
    if (bundle) {
      state.pending = 'confirmation';
      return output(`Untuk ${state.people} orang dengan budget ${rupiah(state.budget)}, saya sarankan ${bundle.name} sekitar ${rupiah(bundle.total)}. Mau saya siapkan paket ini?`, state, { productIds: bundle.ids, suggestions: ['Siapkan paket ini', 'Cari paket lain', 'Ubah budget'] });
    }
    return output(`Budget ${rupiah(state.budget)} masih terbatas untuk ${state.people} orang. Mau saya cari pilihan paling hemat?`, state, { suggestions: ['Cari paling hemat', 'Ubah budget'] });
  }

  if (state.topic === 'recipe' && state.people) {
    const preference = entities.preference ?? state.preference;
    if (!preference) {
      state.pending = 'preference';
      return output(`Untuk ${state.people} orang, saya bisa siapkan menu ayam kecap, ikan nila sambal, atau menu sayur. Kakak lebih ingin yang mana?`, state, { productIds: [20, 10, 2], suggestions: ['Pilih menu ayam', 'Pilih menu ikan', 'Menu sayur saja'] });
    }
    state.pending = 'confirmation';
    if (preference === 'ayam') return output(`Untuk ${state.people} orang, saya sarankan ayam kecap dan tumis kangkung. Bahannya tersedia. Mau saya siapkan?`, state, { productIds: [20, 54, 51, 4], suggestions: ['Siapkan bahan', 'Pilih menu ikan', 'Menu lain'] });
    if (preference === 'sayur') return output(`Untuk ${state.people} orang, saya sarankan tumis kangkung dan terong balado. Mau saya siapkan bahannya?`, state, { productIds: [4, 3, 50, 51], suggestions: ['Siapkan bahan', 'Pilih menu ikan', 'Menu lain'] });
    return output(`Untuk ${state.people} orang, saya sarankan ikan nila sambal dan sayur bayam. Mau saya siapkan bahannya?`, state, { productIds: [10, 50, 51, 2], suggestions: ['Siapkan bahan', 'Pilih menu ayam', 'Menu lain'] });
  }

  if (parsed.intent === 'start_shopping') {
    state.topic = 'shopping'; state.pending = 'product';
    return output('Siap. Mau mulai dari ikan, sayur, daging, sembako, buah, atau bumbu?', state, { productIds: [10, 2, 20, 30], suggestions: ['Ikan', 'Sayur', 'Daging', 'Sembako'] });
  }

  if (entities.categories.length && !entities.products.length) {
    const products = PRODUCTS.filter((product) => entities.categories.includes(product.category) && product.stock > 0).slice(0, 4);
    state.topic = 'shopping'; state.pending = 'product';
    return output(`Ada beberapa pilihan ${entities.categories.join(' dan ')}. Mau pilih yang mana?`, state, { productIds: products.map((product) => product.id) });
  }

  const products = entities.products.length
    ? entities.products
    : state.lastProductIds.map(findProductById).filter((product): product is NonNullable<typeof product> => Boolean(product));
  if (parsed.intent === 'ask_price' && products.length) {
    const product = products[0]!;
    return output(`${product.name} harganya ${rupiah(product.price)} per ${product.unit}. Mau berapa?`, state, { productIds: [product.id] });
  }
  if (parsed.intent === 'ask_availability' && products.length) {
    const product = products[0]!;
    return output(product.stock > 0 ? `${product.name} tersedia, ${rupiah(product.price)} per ${product.unit}. Mau berapa?` : `${product.name} sedang habis. Mau saya carikan pengganti?`, state, { productIds: [product.id] });
  }

  if (['add_items', 'update_items', 'remove_items'].includes(parsed.intent) && products.length) {
    const quantities = entities.quantities;
    if (parsed.intent !== 'remove_items' && quantities.length !== products.length && !(quantities.length === 1 && /\b(masing|semua|tiap)\b/.test(parsed.normalized))) {
      state.pending = 'quantity'; state.lastProductIds = products.map((product) => product.id);
      return output(`Saya menangkap ${products.map((product) => product.name).join(' dan ')}. Sebutkan jumlah masing-masing, ya.`, state, { productIds: products.map((product) => product.id) });
    }
    const assigned = quantities.length === 1 ? products.map(() => quantities[0]) : quantities;
    const actions: CommerceAction[] = products.map((product, index) => parsed.intent === 'remove_items' ? { type: 'remove', productId: product.id } : parsed.intent === 'update_items' ? { type: 'set', productId: product.id, qty: assigned[index] } : { type: 'add', productId: product.id, qty: assigned[index] });
    const wantsTotal = /(total|hitung|berapa semua|jumlah belanja)/.test(parsed.normalized);
    if (wantsTotal) actions.push({ type: 'show_cart' });
    state.pending = wantsTotal ? 'none' : 'confirmation';
    const suffix = wantsTotal ? ' Saya buka keranjang untuk menghitung totalnya.' : ' Mau lihat keranjang, tambah lagi, atau lanjut checkout?';
    return output(`Siap, ${products.map((product, index) => parsed.intent === 'remove_items' ? `${product.name} dihapus` : `${product.name} ${formatQty(assigned[index])} ${product.unit}`).join(' dan ')} sudah diproses.${suffix}`, state, {
      actions,
      productIds: products.map((product) => product.id),
      suggestions: wantsTotal ? [] : ['Lihat keranjang', 'Tambah lagi', 'Lanjut checkout'],
    });
  }

  if (parsed.intent === 'ask_seller') return output(`Saya bantu hubungkan ke pedagang di ${STORE_CONFIG.pickupName}.`, state, { handoff: { reason: 'customer_request', message: 'Pelanggan ingin berbicara dengan pedagang.' } });

  return output('Saya belum yakin maksudnya. Bisa sebutkan barang, jumlah, atau pilih bantuan di bawah?', state, { confidence: parsed.confidence, suggestions: ['Belanja sesuai budget', 'Cari bahan masakan', 'Lihat semua menu'], handoff: parsed.confidence < 0.5 ? { reason: 'low_confidence', message: input.message } : undefined });
}
