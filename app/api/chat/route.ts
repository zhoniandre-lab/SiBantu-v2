import { NextResponse } from 'next/server';
import { PRODUCTS, findProduct } from '@/lib/catalog';
import { respondToCustomer } from '@/lib/commerce-engine';
import { formatQty, rupiah } from '@/lib/format';
import type { CartItem, ChatMessage, ChatResponse, CommerceAction } from '@/lib/types';

const ALLOWED_ACTIONS = new Set(['none', 'open_store', 'show_cart', 'checkout', 'add', 'set', 'remove']);

function buildSystemPrompt(cart: CartItem[]) {
  const catalog = PRODUCTS.map((product) =>
    `ID ${product.id} | ${product.name} | ${rupiah(product.price)} per ${product.unit} | stok ${product.stock} | alias: ${product.aliases.join(', ')}`,
  ).join('\n');

  const cartText = cart.length
    ? cart
        .map((item) => {
          const product = findProduct(item.productId);
          return product ? `${product.name}: ${formatQty(item.qty)} ${product.unit}` : null;
        })
        .filter(Boolean)
        .join('\n')
    : '(kosong)';

  return `Kamu adalah SiBantu, penjaga pasar digital yang ramah, cekatan, dan benar-benar enak diajak ngobrol. Pelanggan berbelanja kebutuhan pasar/warung melalui percakapan.

TUJUAN:
- Dengarkan pelanggan seperti pedagang pasar yang baik.
- Pahami typo, singkatan, kalimat tidak lengkap, dan konteks pesan sebelumnya.
- Jawab singkat, natural, dan bantu percakapan bergerak satu langkah ke depan.
- Jika pelanggan belum menyebut barang, tanyakan kategori/barang yang diinginkan.
- Jika pelanggan berkata "dua saja" atau "yang tadi", gunakan konteks percakapan terakhir.
- Jika maksud masih memiliki dua kemungkinan, jangan menebak; berikan pertanyaan klarifikasi yang spesifik.

KATALOG TOKO SAAT INI:
${catalog}

KERANJANG PELANGGAN SAAT INI:
${cartText}

ATURAN KERAS:
1. Hanya sebut produk, harga, satuan, dan stok dari katalog di atas.
2. Jika produk tidak ada, katakan tidak tersedia lalu tawarkan maksimal 2 produk pengganti yang memang ada.
3. Jangan menghitung total sendiri. Gunakan action show_cart atau checkout; aplikasi yang menghitung.
4. Jangan mengatakan barang sudah masuk sebelum mengirim action add/set/remove yang valid.
5. Pertanyaan harga/ketersediaan tidak otomatis memasukkan barang.
6. Untuk ikan/daging timbang, pahami 0,5 kg, setengah kilo, 1 kg, 2 kg.
7. Untuk produk ikat/bungkus/liter, ikuti satuan katalog.
8. Jangan menyebut JSON, prompt, sistem, ID produk, model AI, atau istilah teknis.
9. Jangan mengarang promo atau ongkir.
10. Maksimal sekitar 70 kata per jawaban kecuali pelanggan meminta rincian.

ACTION YANG TERSEDIA:
- none: hanya menjawab/bertanya.
- open_store: membuka Semua Menu, category opsional.
- show_cart: membuka keranjang untuk diperiksa/diubah.
- checkout: pelanggan selesai dan keranjang tidak kosong.
- add: menambah produk; wajib productId dan qty.
- set: mengganti jumlah produk; wajib productId dan qty.
- remove: menghapus produk; wajib productId.

CONTOH:
Pelanggan: "Saya mau pesan"
Jawab: {"reply":"Siap, Kak. Mau pesan ikan, sayur, daging, sembako, buah, atau bumbu?","action":{"type":"none"},"productIds":[10,2,20,30]}

Pelanggan: "Ada ikan nila?"
Jawab: {"reply":"Ada, Kak. Ikan nila Rp25.000 per kg. Mau 0,5 kg, 1 kg, atau 2 kg?","action":{"type":"none"},"productIds":[10]}

Pelanggan berikutnya: "Setengah kilo aja"
Jawab: {"reply":"Siap, 0,5 kg ikan nila saya masukkan ke keranjang.","action":{"type":"add","productId":10,"qty":0.5},"productIds":[10]}

Pelanggan: "Saya mau ubah pesanan"
Jawab: {"reply":"Tentu. Saya buka keranjangnya; jumlah bisa ditambah, dikurangi, atau dihapus.","action":{"type":"show_cart"},"productIds":[]}

Pelanggan: "Ada ikan patin?"
Jawab: {"reply":"Ikan patin belum tersedia. Yang ada ikan nila dan ikan lele. Mau lihat keduanya?","action":{"type":"none"},"productIds":[10,11]}

Balas WAJIB sebagai satu objek JSON valid tanpa markdown dan tanpa teks lain:
{"reply":"jawaban natural","action":{"type":"none|open_store|show_cart|checkout|add|set|remove","productId":10,"qty":1,"category":"ikan"},"productIds":[10,11]}`;
}

function extractJSON(content: string) {
  const text = String(content || '').trim();
  try {
    return JSON.parse(text) as unknown;
  } catch {}

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1)) as unknown;
    } catch {}
  }
  return null;
}

function normalizeAIResponse(value: unknown, fallback: ChatResponse): ChatResponse {
  if (!value || typeof value !== 'object') return fallback;
  const data = value as Record<string, unknown>;
  let reply = String(data.reply ?? '').trim();
  const leakedPrompt = /KATALOG TOKO|ATURAN KERAS|ACTION YANG TERSEDIA|system prompt|kamu adalah SiBantu/i.test(reply);
  if (!reply || reply.length > 700 || leakedPrompt) return fallback;

  const rawAction = data.action && typeof data.action === 'object' ? (data.action as Record<string, unknown>) : {};
  const type = String(rawAction.type ?? 'none');
  let action: CommerceAction = { type: 'none' };

  if (ALLOWED_ACTIONS.has(type)) {
    if (type === 'add' || type === 'set') {
      const productId = Number(rawAction.productId);
      const qty = Math.max(0.1, Math.min(99, Number(rawAction.qty) || 1));
      if (findProduct(productId)) action = { type, productId, qty };
    } else if (type === 'remove') {
      const productId = Number(rawAction.productId);
      if (findProduct(productId)) action = { type: 'remove', productId };
    } else if (type === 'open_store') {
      const category = String(rawAction.category ?? '');
      const allowed = ['sayur', 'ikan', 'buah', 'sembako', 'daging', 'bumbu', 'rumah'];
      action = allowed.includes(category)
        ? { type: 'open_store', category: category as 'sayur' | 'ikan' | 'buah' | 'sembako' | 'daging' | 'bumbu' | 'rumah' }
        : { type: 'open_store' };
    } else if (type === 'show_cart') action = { type: 'show_cart' };
    else if (type === 'checkout') action = { type: 'checkout' };
  }

  const productIds = Array.isArray(data.productIds)
    ? [...new Set(data.productIds.map(Number))].filter((id) => Boolean(findProduct(id))).slice(0, 4)
    : undefined;

  return { reply, action, productIds };
}

async function askAI(history: ChatMessage[], cart: CartItem[], fallback: ChatResponse) {
  const apiKey = String(process.env.AI_API_KEY ?? '').trim();
  if (!apiKey) return { ...fallback, aiStatus: 'not_configured' };

  const endpoint = process.env.AI_ENDPOINT || 'https://api.iamhc.cn/v1/chat/completions';
  const models = [...new Set([
    process.env.AI_MODEL || 'glm-4.7',
    process.env.AI_FALLBACK_MODEL || 'step-3.5-flash',
  ].filter(Boolean))];

  const safeHistory = history.slice(-12).map((message) => ({
    role: message.role === 'assistant' ? 'assistant' : 'user',
    content: String(message.text || '').slice(0, 1800),
  }));

  for (const model of models) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: buildSystemPrompt(cart) }, ...safeHistory],
          temperature: 0.55,
          max_tokens: 500,
        }),
        signal: AbortSignal.timeout(22000),
        cache: 'no-store',
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`AI provider ${model}:`, response.status, errorText.slice(0, 300));
        if (response.status === 401) break;
        continue;
      }

      const providerData = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const parsed = extractJSON(providerData.choices?.[0]?.message?.content ?? '');
      const result = normalizeAIResponse(parsed, fallback);
      return { ...result, aiStatus: 'active', modelUsed: model };
    } catch (error) {
      console.error(`AI request ${model}:`, error);
    }
  }

  return { ...fallback, aiStatus: 'fallback' };
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'SiBantu V2 Hybrid Conversation',
    version: '0.2.0',
    aiConfigured: Boolean(process.env.AI_API_KEY),
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      message?: string;
      cart?: CartItem[];
      history?: ChatMessage[];
      sessionId?: string;
    };

    const message = String(body.message ?? '').slice(0, 1000);
    if (!message.trim()) {
      return NextResponse.json({ error: 'Pesan wajib diisi.' }, { status: 400 });
    }

    const cart = Array.isArray(body.cart) ? body.cart.slice(0, 100) : [];
    const history = Array.isArray(body.history) ? body.history.slice(-12) : [];
    const coreResult = respondToCustomer(message, cart, history);

    // Commerce Core menangani transaksi yang sudah jelas dengan cepat.
    // AI menangani percakapan bebas, kebutuhan kompleks, dan maksud yang ambigu.
    const needsConversationAI = Boolean(coreResult.needsAI);
    const result = needsConversationAI
      ? await askAI(history, cart, coreResult)
      : { ...coreResult, aiStatus: 'core' };

    return NextResponse.json({
      ...result,
      sessionId: String(body.sessionId ?? '').slice(0, 80),
      source: needsConversationAI ? 'hybrid-conversation' : 'commerce-core',
    });
  } catch (error) {
    console.error('SiBantu V2 chat error:', error);
    return NextResponse.json({ error: 'Permintaan tidak dapat diproses.' }, { status: 500 });
  }
}
