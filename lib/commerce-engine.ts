import { CATEGORIES, PRODUCTS, findProduct } from './catalog';
import { rupiah } from './format';
import type { CartItem, ChatMessage, ChatResponse, Product } from './types';

const NUMBER_WORDS: Record<string, number> = {
  satu: 1,
  dua: 2,
  tiga: 3,
  empat: 4,
  lima: 5,
  enam: 6,
  tujuh: 7,
  delapan: 8,
  sembilan: 9,
  sepuluh: 10,
  setengah: 0.5,
};

export function normalizeText(input: string) {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(sya|sy)\b/g, 'saya')
    .replace(/\b(ckup|cukub|cukuup)\b/g, 'cukup')
    .replace(/\b(gireng|gorng)\b/g, 'goreng')
    .replace(/\b(ikam|ikn)\b/g, 'ikan')
    .replace(/\b(pesen|psan)\b/g, 'pesan')
    .replace(/\b(gk|ga|ngga|ngak)\b/g, 'tidak')
    .replace(/[^a-z0-9.,\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function distance(a: string, b: string) {
  const matrix = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return matrix[a.length][b.length];
}

function productScore(text: string, product: Product) {
  const candidates = [product.name.toLowerCase(), ...product.aliases.map((alias) => alias.toLowerCase())];
  let score = 0;
  for (const candidate of candidates) {
    if (text.includes(candidate)) score = Math.max(score, 100 + candidate.length);
    const words = text.split(' ');
    const candidateWords = candidate.split(' ');
    if (candidateWords.length === 1) {
      for (const word of words) {
        const d = distance(word, candidate);
        if (candidate.length >= 4 && d <= 1) score = Math.max(score, 70 - d);
      }
    }
  }
  return score;
}

export function searchProducts(text: string) {
  return PRODUCTS.map((product) => ({ product, score: productScore(text, product) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.product);
}

function readQuantity(text: string) {
  const decimal = text.match(/\b(\d+(?:[.,]\d+)?)\b/);
  if (decimal) return Math.max(0.5, Math.min(99, Number(decimal[1].replace(',', '.'))));
  for (const [word, value] of Object.entries(NUMBER_WORDS)) {
    if (new RegExp(`\\b${word}\\b`).test(text)) return value;
  }
  return 1;
}

function lastMentionedProduct(history: ChatMessage[]) {
  for (const message of [...history].reverse()) {
    if (message.productIds?.length === 1) return findProduct(message.productIds[0]);
    const found = searchProducts(normalizeText(message.text));
    if (found.length === 1) return found[0];
  }
  return undefined;
}

function cartTotal(cart: CartItem[]) {
  return cart.reduce((sum, item) => {
    const product = findProduct(item.productId);
    return sum + (product?.price ?? 0) * item.qty;
  }, 0);
}

function categoryFromText(text: string): { id: Exclude<(typeof CATEGORIES)[number]['id'], 'semua'>; label: string; emoji: string } | undefined {
  const found = CATEGORIES.find(
    (category) =>
      category.id !== 'semua' &&
      (text.includes(category.label.toLowerCase()) || text.includes(String(category.id))),
  );
  if (!found || found.id === 'semua') return undefined;
  return { ...found, id: found.id };
}

export function respondToCustomer(
  rawMessage: string,
  cart: CartItem[] = [],
  history: ChatMessage[] = [],
): ChatResponse {
  const text = normalizeText(rawMessage);
  const products = searchProducts(text);
  const exactProduct = products[0];
  const category = categoryFromText(text);
  const qty = readQuantity(text);

  if (!text) return { reply: 'Tulis kebutuhan Kakak, ya.', action: { type: 'none' } };

  if (/\b(halo|hai|pagi|siang|sore|malam)\b/.test(text)) {
    return {
      reply: 'Halo, Kak! Mau belanja kebutuhan rumah, cari bahan masakan, atau lihat promo hari ini?',
      action: { type: 'none' },
    };
  }

  if (/(semua menu|lihat menu|buka toko|lihat semua|semua barang|katalog)/.test(text)) {
    return {
      reply: 'Siap. Saya buka Toko SiBantu—semua barang bisa dicari dan difilter berdasarkan kategori.',
      action: { type: 'open_store' },
    };
  }

  if (/(keranjang|belanjaan saya)/.test(text) && !/(tambah|masukkan)/.test(text)) {
    return {
      reply: cart.length
        ? `Ada ${cart.reduce((sum, item) => sum + item.qty, 0)} item dengan subtotal ${rupiah(cartTotal(cart))}. Silakan diperiksa.`
        : 'Keranjang Kakak masih kosong. Mau saya buka semua menu?',
      action: cart.length ? { type: 'show_cart' } : { type: 'open_store' },
    };
  }

  if (/(cukup|selesai|checkout|bayar sekarang|lanjut bayar)/.test(text)) {
    return cart.length
      ? {
          reply: `Baik, subtotal sementara ${rupiah(cartTotal(cart))}. Pilih lokasi pengantaran untuk menghitung ongkir dan melanjutkan pesanan.`,
          action: { type: 'checkout' },
        }
      : {
          reply: 'Keranjang masih kosong, jadi belum ada yang perlu dihitung. Saya buka menu supaya Kakak bisa memilih.',
          action: { type: 'open_store' },
        };
  }

  if (category && !exactProduct) {
    const categoryProducts = PRODUCTS.filter((product) => product.category === category.id && product.stock > 0);
    return {
      reply: `Ada ${categoryProducts.length} pilihan ${category.label.toLowerCase()} yang tersedia. Pilih salah satu atau buka semua produknya.`,
      action: { type: 'open_store', category: category.id },
      productIds: categoryProducts.slice(0, 5).map((product) => product.id),
    };
  }

  const contextualProduct = exactProduct ?? (/\b(yang tadi|itu|jadi|aja|saja)\b/.test(text) ? lastMentionedProduct(history) : undefined);

  if (/(tidak jadi|batal|hapus|buang)/.test(text) && contextualProduct) {
    return {
      reply: `Baik, ${contextualProduct.name} saya hapus dari keranjang. Mau cari penggantinya?`,
      action: { type: 'remove', productId: contextualProduct.id },
    };
  }

  if (/(jadi|ubah|ganti|kurangi)/.test(text) && contextualProduct && /\b(\d+|satu|dua|tiga|empat|lima)\b/.test(text)) {
    return {
      reply: `Baik, jumlah ${contextualProduct.name} saya ubah menjadi ${qty} ${contextualProduct.unit}.`,
      action: { type: 'set', productId: contextualProduct.id, qty },
      productIds: [contextualProduct.id],
    };
  }

  if (contextualProduct) {
    const askingPrice = /(harga|berapa|per kg|perkilo|sekilo)/.test(text);
    const askingAvailability = /(ada|tersedia|stok)/.test(text);
    const buying = /(mau|beli|pesan|ambil|tambah|masukkan)/.test(text) && !askingPrice && !askingAvailability;

    if (buying || (/^(\d+|satu|dua|tiga|empat|lima)(\s|$)/.test(text) && lastMentionedProduct(history))) {
      if (contextualProduct.stock <= 0) {
        const alternatives = PRODUCTS.filter(
          (product) => product.category === contextualProduct.category && product.id !== contextualProduct.id && product.stock > 0,
        ).slice(0, 3);
        return {
          reply: `${contextualProduct.name} sedang habis. Saya punya ${alternatives.map((p) => p.name).join(' atau ')}. Mau lihat penggantinya?`,
          action: { type: 'none' },
          productIds: alternatives.map((product) => product.id),
        };
      }
      return {
        reply: `Siap, ${contextualProduct.name} ${qty} × ${contextualProduct.unit} saya masukkan. Mau tambah yang lain atau lihat keranjang?`,
        action: { type: 'add', productId: contextualProduct.id, qty },
        productIds: [contextualProduct.id],
      };
    }

    return {
      reply: `${contextualProduct.name} tersedia, harganya ${rupiah(contextualProduct.price)} per ${contextualProduct.unit}. Mau berapa?`,
      action: { type: 'none' },
      productIds: [contextualProduct.id],
    };
  }

  if (/(makan apa|masak apa|rekomendasi|budget|anggaran|bahan untuk)/.test(text)) {
    return {
      reply: 'Saya bisa bantu menyusun pilihan berdasarkan menu atau anggaran. Fitur rekomendasi pintar akan memakai katalog dan stok toko secara langsung.',
      action: { type: 'none' },
      productIds: [10, 2, 30],
      needsAI: true,
    };
  }

  if (/\b(ikan|sayur|buah|beras|sembako|daging|bumbu)\b/.test(text)) {
    return {
      reply: `Saya belum menemukan barang persis dengan nama itu. ${category ? `Ada beberapa pilihan ${category.label.toLowerCase()}.` : 'Coba tulis nama barang atau buka Semua Menu.'}`,
      action: category ? { type: 'open_store', category: category.id } : { type: 'open_store' },
    };
  }

  return {
    reply: 'Saya belum yakin barang yang dimaksud. Bisa tulis nama barang, jumlah, atau tekan “Semua Menu” untuk melihat toko lengkap.',
    action: { type: 'none' },
    needsAI: true,
  };
}
