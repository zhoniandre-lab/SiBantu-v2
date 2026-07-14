import { CATEGORIES, PRODUCTS, findProduct } from './catalog';
import { formatQty, rupiah } from './format';
import { adminWhatsAppUrl, STORE_CONFIG } from './store-config';
import type { CartItem, ChatMessage, ChatResponse, CommerceAction, Product } from './types';

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
  seperempat: 0.25,
};

export function normalizeText(input: string) {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(sya|sy)\b/g, 'saya')
    .replace(/\b(ckup|cukub|cukuup)\b/g, 'cukup')
    .replace(/\b(stengah|setngah|stngah)\b/g, 'setengah')
    .replace(/\b(sprapat|seprapat|sepermpat)\b/g, 'seperempat')
    .replace(/\b(rbu|ribu2|reb[u])\b/g, 'ribu')
    .replace(/\b(gireng|gorng)\b/g, 'goreng')
    .replace(/\b(ikam|ikn)\b/g, 'ikan')
    .replace(/\b(aj|ja)\b/g, 'aja')
    .replace(/\b(pesen|psan)\b/g, 'pesan')
    .replace(/\b(pesnaan|psanan|pesaan)\b/g, 'pesanan')
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
  if (decimal) return Math.max(0.1, Math.min(99, Number(decimal[1].replace(',', '.'))));
  for (const [word, value] of Object.entries(NUMBER_WORDS)) {
    if (new RegExp(`\\b${word}\\b`).test(text)) return value;
  }
  return 1;
}

function readAllQuantities(text: string) {
  const numberPattern = Object.keys(NUMBER_WORDS).join('|');
  const matches = text.match(new RegExp(`\\b(\\d+(?:[.,]\\d+)?|${numberPattern})\\b`, 'g')) ?? [];
  return matches.map((value) => {
    const normalized = value.toLowerCase();
    const numeric = NUMBER_WORDS[normalized] ?? Number(normalized.replace(',', '.'));
    return Math.max(0.1, Math.min(99, numeric || 1));
  });
}

function readBudget(text: string) {
  const thousand = text.match(/(?:rp\s*)?(\d+(?:[.,]\d+)?)\s*(ribu|rb|k)\b/);
  if (thousand) return Math.round(Number(thousand[1].replace(',', '.')) * 1000);

  const full = text.match(/(?:rp\s*)?(\d{4,9})\b/);
  if (full) return Number(full[1]);
  return undefined;
}

function readPeopleCount(text: string) {
  const numberPattern = Object.keys(NUMBER_WORDS).join('|');
  const before = text.match(new RegExp(`\\b(\\d+|${numberPattern})\\s*(?:orang|porsi)\\b`));
  const after = text.match(new RegExp(`\\b(?:orang|porsi)\\s*(\\d+|${numberPattern})\\b`));
  const raw = before?.[1] ?? after?.[1];
  if (!raw) return undefined;
  return NUMBER_WORDS[raw] ?? Number(raw);
}

function productTextPosition(text: string, product: Product) {
  const candidates = [product.name.toLowerCase(), ...product.aliases.map((alias) => alias.toLowerCase())];
  const positions = candidates.map((candidate) => {
    const escaped = candidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = new RegExp(`(^|\\s)${escaped}(?:nya)?(?=\\s|$|[,.])`).exec(text);
    return match ? match.index + match[1].length : -1;
  }).filter((position) => position >= 0);
  return positions.length ? Math.min(...positions) : Number.MAX_SAFE_INTEGER;
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

function resolveSaleQuantity(product: Product, requestedQty: number, text: string) {
  const requestsBaseUnit = product.baseUnit === 'kg' && /\b(kg|kilo|kilogram)\b/.test(text);
  if (!product.packageSize || !product.baseUnit || !requestsBaseUnit) {
    return { cartQty: requestedQty };
  }

  const packageCount = requestedQty / product.packageSize;
  const isWholePackage = Math.abs(packageCount - Math.round(packageCount)) < 0.00001 && packageCount >= 1;
  if (product.allowPartial === false && !isWholePackage) {
    const adminMessage = `Halo Admin SiBantu, pelanggan ingin memesan ${product.name} ${formatQty(requestedQty)} ${product.baseUnit}. Apakah bisa dibuat pesanan khusus di luar ${product.unit}?`;
    return {
      error: {
        reply: `Belum bisa langsung, Kak. ${product.name} saat ini hanya dijual utuh per ${product.unit} seharga ${rupiah(product.price)}. Permintaan ${formatQty(requestedQty)} ${product.baseUnit} belum tersedia. Kalau Kakak mau, saya bantu tanyakan pesanan khusus ke admin ${STORE_CONFIG.adminPhoneDisplay}.`,
        action: { type: 'none' } as CommerceAction,
        productIds: [product.id],
        cta: {
          label: 'Tanya admin via WhatsApp',
          url: adminWhatsAppUrl(adminMessage),
        },
      } satisfies ChatResponse,
    };
  }

  return { cartQty: Math.round(packageCount) };
}

function budgetRecommendation(budget: number, people: number, preference?: 'ikan' | 'ayam' | 'sayur'): ChatResponse {
  const bundles = [
    { name: 'ayam kecap + tumis kangkung', items: [{ id: 20, qty: 0.5 }, { id: 54, qty: 1 }, { id: 51, qty: 0.25 }, { id: 4, qty: 1 }] },
    { name: 'lele goreng + sayur segar', items: [{ id: 11, qty: 0.5 }, { id: 2, qty: 1 }, { id: 1, qty: 1 }, { id: 50, qty: 0.1 }, { id: 51, qty: 0.25 }] },
    { name: 'ikan nila sambal + sayur bayam', items: [{ id: 10, qty: 1 }, { id: 50, qty: 0.1 }, { id: 51, qty: 0.25 }, { id: 2, qty: 1 }] },
    { name: 'telur dan sayur hemat', items: [{ id: 22, qty: 0.5 }, { id: 2, qty: 1 }, { id: 1, qty: 1 }] },
  ].map((bundle) => ({
    ...bundle,
    total: bundle.items.reduce((sum, item) => sum + (findProduct(item.id)?.price ?? 0) * item.qty, 0),
  }));

  const preferredBundles = preference
    ? bundles.filter((bundle) =>
        preference === 'ikan'
          ? /(ikan|lele)/.test(bundle.name)
          : preference === 'ayam'
            ? /ayam/.test(bundle.name)
            : /(sayur|telur)/.test(bundle.name),
      )
    : bundles;
  const selected = preferredBundles.filter((bundle) => bundle.total <= budget).sort((a, b) => b.total - a.total)[0]
    ?? bundles.filter((bundle) => bundle.total <= budget).sort((a, b) => b.total - a.total)[0];
  if (!selected) {
    return {
      reply: `Dengan budget ${rupiah(budget)}, pilihannya masih terbatas untuk ${formatQty(people)} orang. Saya bisa mulai dari telur dan satu jenis sayur, atau Kakak bisa menaikkan budget sedikit. Mau yang paling hemat?`,
      action: { type: 'none' },
      productIds: [22, 2, 1],
      suggestions: ['Pilih yang paling hemat', 'Naikkan budget', 'Lihat semua menu'],
    };
  }

  return {
    reply: `Untuk ${formatQty(people)} orang dengan budget ${rupiah(budget)}, pilihan yang paling pas adalah ${selected.name} sekitar ${rupiah(selected.total)}. Masih ada sisa sekitar ${rupiah(Math.max(0, budget - selected.total))}. Mau saya siapkan paket ini?`,
    action: { type: 'none' },
    productIds: selected.items.slice(0, 4).map((item) => item.id),
    suggestions: ['Siapkan paket ini', 'Cari paket lain', 'Ubah budget'],
  };
}

function recipeRecommendation(people: number): ChatResponse {
  return {
    reply: `Untuk ${formatQty(people)} orang, saya punya dua ide: ayam kecap dengan tumis kangkung, atau ikan nila sambal dengan sayur bayam. Bahannya tersedia di toko. Kakak lebih ingin menu ayam atau ikan?`,
    action: { type: 'none' },
    productIds: [20, 4, 10, 2],
    suggestions: ['Pilih menu ayam', 'Pilih menu ikan', 'Saya mau menu sayur saja'],
  };
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
  const previousHistory = history.length && normalizeText(history[history.length - 1]?.text ?? '') === text
    ? history.slice(0, -1)
    : history;
  const recentMessages = previousHistory.slice(-8).map((message) => normalizeText(message.text));
  const recentContext = recentMessages.join(' | ');
  const recipeInContext = /(masak apa|makan apa|menu apa|rekomendasi masak|pilihkan menu|jumlah orang)/.test(recentContext);
  const budgetInContext = /(budget|anggaran|dana|belanja pintar)/.test(recentContext);
  const asksRecipeNow = /(masak apa|makan apa|menu apa|rekomendasi.*masak|pilihkan.*menu|enaknya masak)/.test(text);
  const asksBudgetNow = /(budget|anggaran|dana|belanja pintar)/.test(text);
  const budgetNow = readBudget(text);
  const previousBudget = [...recentMessages].reverse().map(readBudget).find((value) => value !== undefined);
  const peopleNow = readPeopleCount(text);
  const previousPeople = [...recentMessages].reverse().map(readPeopleCount).find((value) => value !== undefined);
  const preferenceNow = /\bikan\b/.test(text) ? 'ikan' : /\bayam\b/.test(text) ? 'ayam' : /\bsayur\b/.test(text) ? 'sayur' : undefined;
  const statesPeopleNow = peopleNow !== undefined;

  if (!text) return { reply: 'Tulis kebutuhan Kakak, ya.', action: { type: 'none' } };

  if (/\b(halo|hai|pagi|siang|sore|malam)\b/.test(text)) {
    return {
      reply: 'Halo, Kak! Mau belanja kebutuhan rumah, cari bahan masakan, atau lihat promo hari ini?',
      action: { type: 'none' },
      suggestions: ['Bantu pilih menu hari ini', 'Lihat semua menu', 'Saya mau belanja'],
    };
  }

  if (asksBudgetNow && !budgetNow) {
    return {
      reply: 'Siap, Kak. Berapa budget belanja hari ini? Setelah itu beri tahu untuk berapa orang supaya saya pilihkan barang yang pas.',
      action: { type: 'none' },
      suggestions: ['Budget 50 ribu', 'Budget 100 ribu', 'Budget 150 ribu'],
    };
  }

  if (budgetNow && (asksBudgetNow || budgetInContext)) {
    const people = peopleNow ?? previousPeople;
    if (people) return budgetRecommendation(budgetNow, people, preferenceNow);
    return {
      reply: `Baik, budgetnya ${rupiah(budgetNow)}. Belanja ini untuk berapa orang? Biar jumlah dan menunya tidak kurang atau berlebihan.`,
      action: { type: 'none' },
      suggestions: ['Untuk 2 orang', 'Untuk 3 orang', 'Untuk 4 orang'],
    };
  }

  if (statesPeopleNow && previousBudget) {
    return budgetRecommendation(previousBudget, peopleNow!, preferenceNow);
  }

  if ((asksRecipeNow && statesPeopleNow) || (recipeInContext && statesPeopleNow)) {
    return recipeRecommendation(peopleNow ?? qty);
  }

  if (asksRecipeNow) {
    return {
      reply: 'Boleh, Kak. Lagi ingin menu ikan, ayam, atau sayuran? Kalau sudah bosan, saya bisa pilihkan resep sederhana dari bahan yang tersedia. Untuk berapa orang?',
      action: { type: 'none' },
      productIds: [10, 20, 2],
      suggestions: ['Untuk 2 orang', 'Untuk 3 orang', 'Untuk 4 orang'],
    };
  }

  if (recipeInContext && /\b(ikan|ayam|sayur|pilihkan)\b/.test(text)) {
    if (/\b(ayam)\b/.test(text)) {
      return {
        reply: 'Pilihan bagus. Kita bisa buat ayam kecap dengan tumis kangkung. Ayam, kecap, bawang, dan kangkung tersedia. Mau saya siapkan bahan-bahannya?',
        action: { type: 'none' },
        productIds: [20, 54, 51, 4],
        suggestions: ['Siapkan bahan menu ayam', 'Lihat menu ikan', 'Pilih menu lain'],
      };
    }
    if (/\b(sayur)\b/.test(text)) {
      return {
        reply: 'Kalau ingin sayur saja, saya sarankan tumis kangkung dan terong balado. Bahannya ringan dan tersedia. Mau pilih salah satu atau keduanya?',
        action: { type: 'none' },
        productIds: [4, 3, 50, 51],
        suggestions: ['Pilih tumis kangkung', 'Pilih terong balado', 'Keduanya'],
      };
    }
    return {
      reply: 'Kita pilih menu ikan nila sambal dengan sayur bayam. Ikan nila, cabai, bawang, dan bayam tersedia. Mau saya siapkan daftar bahannya?',
      action: { type: 'none' },
      productIds: [10, 50, 51, 2],
      suggestions: ['Siapkan bahan menu ikan', 'Lihat menu ayam', 'Pilih menu lain'],
    };
  }

  if (/(semua menu|lihat menu|buka toko|lihat semua|semua barang|katalog)/.test(text)) {
    return {
      reply: 'Siap. Saya buka Toko SiBantu—semua barang bisa dicari dan difilter berdasarkan kategori.',
      action: { type: 'open_store' },
    };
  }

  const explicitProducts = products
    .filter((product) => productTextPosition(text, product) !== Number.MAX_SAFE_INTEGER)
    .sort((a, b) => productTextPosition(text, a) - productTextPosition(text, b));

  if (explicitProducts.length >= 2) {
    const quantities = readAllQuantities(text);
    let assignedQuantities: number[] = [];

    if (quantities.length >= explicitProducts.length) {
      assignedQuantities = quantities.slice(0, explicitProducts.length);
    } else if (quantities.length === 1 && /\b(masing|semuanya|sama sama|tiap)\b/.test(text)) {
      assignedQuantities = explicitProducts.map(() => quantities[0]);
    }

    if (assignedQuantities.length !== explicitProducts.length) {
      return {
        reply: `Saya menangkap ${explicitProducts.map((product) => product.name).join(' dan ')}. Sebutkan jumlah masing-masing, ya. Contoh: “Nila 1 kg dan Lele 2 kg”.`,
        action: { type: 'none' },
        productIds: explicitProducts.slice(0, 4).map((product) => product.id),
      };
    }

    const resolvedQuantities = explicitProducts.map((product, index) =>
      resolveSaleQuantity(product, assignedQuantities[index], text),
    );
    const quantityError = resolvedQuantities.find((result) => result.error)?.error;
    if (quantityError) return quantityError;
    const cartQuantities = resolvedQuantities.map((result) => result.cartQty ?? 1);

    const addingMore = /\b(tambah|tambahkan|lagi)\b/.test(text);
    const actions: CommerceAction[] = explicitProducts.map((product, index) => {
      const existing = cart.find((item) => item.productId === product.id);
      const qty = cartQuantities[index];
      return existing && !addingMore
        ? { type: 'set', productId: product.id, qty }
        : { type: 'add', productId: product.id, qty };
    });

    const details = explicitProducts.map((product, index) => {
      const existing = cart.find((item) => item.productId === product.id);
      const verb = existing && !addingMore ? 'diubah menjadi' : 'ditambahkan';
      return `${product.name} ${verb} ${formatQty(cartQuantities[index])} ${product.unit}`;
    });

    return {
      reply: `Siap, ${details.join(' dan ')}. Mau tambah barang lain atau lihat keranjang?`,
      action: { type: 'none' },
      actions,
      productIds: explicitProducts.slice(0, 4).map((product) => product.id),
    };
  }

  const mentionedCategoryIds = [...new Set([
    ...CATEGORIES
      .filter((item) => item.id !== 'semua' && text.includes(item.label.toLowerCase()))
      .map((item) => item.id),
    ...products.map((product) => product.category),
  ])].filter((id) => id !== 'semua');

  if (mentionedCategoryIds.length >= 2) {
    const labels = mentionedCategoryIds.map((id) => CATEGORIES.find((item) => item.id === id)?.label.toLowerCase()).filter(Boolean);
    const recommendations = mentionedCategoryIds.flatMap((id) =>
      PRODUCTS.filter((product) => product.category === id && product.stock > 0).slice(0, 2),
    );
    return {
      reply: `Siap, Kak. Kita bisa belanja ${labels.join(' dan ')} sekaligus. Saya tampilkan beberapa pilihan yang tersedia—mau pilih yang mana dulu?`,
      action: { type: 'none' },
      productIds: [...new Set(recommendations.map((product) => product.id))].slice(0, 4),
    };
  }

  if (/(keranjang|belanjaan saya)/.test(text) && !/(tambah|masukkan)/.test(text)) {
    return {
      reply: cart.length
        ? `Ada ${cart.length} jenis barang dengan subtotal ${rupiah(cartTotal(cart))}. Silakan diperiksa.`
        : 'Keranjang Kakak masih kosong. Mau saya buka semua menu?',
      action: cart.length ? { type: 'show_cart' } : { type: 'open_store' },
    };
  }

  if (/(ubah|ganti|edit|koreksi)/.test(text) && /(pesanan|belanjaan|keranjang)/.test(text)) {
    return cart.length
      ? {
          reply: 'Tentu bisa. Saya buka keranjang Kakak—jumlah bisa ditambah, dikurangi, atau barangnya dihapus.',
          action: { type: 'show_cart' },
        }
      : {
          reply: 'Keranjang masih kosong, jadi belum ada pesanan yang bisa diubah. Saya buka semua menu dulu, ya.',
          action: { type: 'open_store' },
        };
  }

  if (/(hitung|total|berapa semua|jumlah belanja|lanjut pesan)/.test(text)) {
    return cart.length
      ? {
          reply: `Siap. Subtotal ${cart.length} jenis barang adalah ${rupiah(cartTotal(cart))}. Saya buka keranjang agar Kakak bisa memeriksa sebelum lanjut ke alamat pengantaran.`,
          action: { type: 'show_cart' },
        }
      : {
          reply: 'Keranjang masih kosong, jadi belum ada total yang perlu dihitung. Saya buka semua menu dulu, ya.',
          action: { type: 'open_store' },
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

    if (/\b(juga|selain|lagi|berikutnya)\b/.test(text)) {
      return {
        reply: `Siap, ${category.label.toLowerCase()} juga. Yang tersedia antara lain ${categoryProducts.slice(0, 4).map((product) => product.name).join(', ')}. Mau yang mana?`,
        action: { type: 'none' },
        productIds: categoryProducts.slice(0, 4).map((product) => product.id),
      };
    }

    const ignoredWords = new Set([
      'saya', 'mau', 'ingin', 'beli', 'pesan', 'lihat', 'ada', 'cari', 'belanja',
      'yang', 'dong', 'aja', 'saja', 'berapa', 'harga', 'kg', 'kilo', 'kan', 'terus',
      'juga', 'selain', 'lagi', 'kategori', 'apa', category.label.toLowerCase(),
    ]);
    const unknownSpecificWords = text
      .split(' ')
      .filter((word) => word.length > 2 && !ignoredWords.has(word));

    if (unknownSpecificWords.length > 0) {
      return {
        reply: `Saya belum menemukan ${unknownSpecificWords.join(' ')} di kategori ${category.label.toLowerCase()}. Saya cek pilihan yang tersedia dulu, ya.`,
        action: { type: 'none' },
        productIds: categoryProducts.slice(0, 3).map((product) => product.id),
        needsAI: true,
      };
    }

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
      reply: `Baik, jumlah ${contextualProduct.name} saya ubah menjadi ${formatQty(qty)} ${contextualProduct.unit}.`,
      action: { type: 'set', productId: contextualProduct.id, qty },
      productIds: [contextualProduct.id],
    };
  }

  if (contextualProduct) {
    const askingPrice = /(harga|berapa|per kg|perkilo|sekilo)/.test(text);
    const askingAvailability = /(ada|tersedia|stok)/.test(text);
    const explicitQuantity = /\b(\d+(?:[.,]\d+)?|satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|setengah|seperempat)\b/.test(text);
    const addingMore = /\b(tambah|tambahkan|lagi)\b/.test(text);
    const buying = /(mau|beli|pesan|ambil|tambah|masukkan)/.test(text) && !askingPrice && !askingAvailability;
    const contextualQuantityAnswer = explicitQuantity && !askingPrice && !askingAvailability;
    const resolvedQuantity = resolveSaleQuantity(contextualProduct, qty, text);
    if (resolvedQuantity.error) return resolvedQuantity.error;
    const cartQty = resolvedQuantity.cartQty;

    if (askingPrice && explicitQuantity) {
      const requestLabel = contextualProduct.packageSize && /\b(kg|kilo|kilogram)\b/.test(text)
        ? `${formatQty(qty)} kg (${formatQty(cartQty)} ${contextualProduct.unit})`
        : `${formatQty(cartQty)} ${contextualProduct.unit}`;
      return {
        reply: `${requestLabel} ${contextualProduct.name} harganya ${rupiah(contextualProduct.price * cartQty)}. Mau saya masukkan ke keranjang?`,
        action: { type: 'none' },
        productIds: [contextualProduct.id],
      };
    }

    if (buying || contextualQuantityAnswer) {
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

      const existingItem = cart.find((item) => item.productId === contextualProduct.id);
      if (existingItem && explicitQuantity && !addingMore) {
        return {
          reply: `Baik, jumlah ${contextualProduct.name} saya ubah dari ${formatQty(existingItem.qty)} menjadi ${formatQty(cartQty)} ${contextualProduct.unit}.`,
          action: { type: 'set', productId: contextualProduct.id, qty: cartQty },
          productIds: [contextualProduct.id],
        };
      }

      return {
        reply: `Siap, ${formatQty(cartQty)} ${contextualProduct.unit} ${contextualProduct.name} saya masukkan. Mau tambah yang lain atau lihat keranjang?`,
        action: { type: 'add', productId: contextualProduct.id, qty: cartQty },
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
      reply: 'Saya bisa bantu menyusun pilihan berdasarkan menu atau anggaran. Ceritakan kebutuhan dan jumlah orangnya, ya.',
      action: { type: 'none' },
      productIds: [10, 2, 30],
      needsAI: true,
    };
  }

  if (/(mau|ingin|pengen).*(pesan|belanja|beli)/.test(text) || /(pesan|belanja|beli).*(apa|dong|aja)/.test(text)) {
    return {
      reply: 'Siap, Kak. Mau mulai dari ikan, sayur, daging, sembako, buah, atau bumbu? Bisa sebutkan barangnya atau pilih salah satu di bawah.',
      action: { type: 'none' },
      productIds: [10, 2, 20, 30],
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
