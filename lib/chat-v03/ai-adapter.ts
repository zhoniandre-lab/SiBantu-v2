import { PRODUCTS } from '../catalog';
import type { CategoryId, CommerceAction } from '../types';
import type { ConversationState, EngineOutput } from './types';

const ALLOWED_CATEGORIES: CategoryId[] = ['sayur', 'ikan', 'buah', 'sembako', 'daging', 'bumbu', 'rumah'];

type AIProposal = {
  reply?: unknown;
  tool?: unknown;
  productIds?: unknown;
  category?: unknown;
};

export type AIAdapterResult = {
  reply: string;
  actions: CommerceAction[];
  productIds: number[];
  handoff?: { reason: string; message: string };
  modelUsed: string;
};

function parseJSON(content: string) {
  const text = String(content || '').trim();
  try { return JSON.parse(text) as AIProposal; } catch {}
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)) as AIProposal; } catch {}
  }
  return null;
}

export function validateAIProposal(value: AIProposal | null, modelUsed: string): AIAdapterResult | null {
  if (!value) return null;
  const reply = String(value.reply ?? '').trim();
  const tool = String(value.tool ?? 'clarify');
  const leaked = /system prompt|KATALOG|ATURAN|JSON|tool schema/i.test(reply);
  const inventedCommerceFact = /rp\s*[\d.]|total\s*(belanja)?|diskon\s*\d|ongkir\s*\d/i.test(reply);
  if (!reply || reply.length > 500 || leaked || inventedCommerceFact) return null;

  const productIds = Array.isArray(value.productIds)
    ? [...new Set(value.productIds.map(Number))].filter((id) => PRODUCTS.some((product) => product.id === id)).slice(0, 4)
    : [];

  if (tool === 'recommend') return { reply, actions: [], productIds, modelUsed };
  if (tool === 'open_store') {
    const category = String(value.category ?? '') as CategoryId;
    return {
      reply,
      actions: [{ type: 'open_store', ...(ALLOWED_CATEGORIES.includes(category) ? { category } : {}) }],
      productIds,
      modelUsed,
    };
  }
  if (tool === 'handoff') {
    return {
      reply,
      actions: [],
      productIds,
      modelUsed,
      handoff: { reason: 'ai_low_confidence', message: reply },
    };
  }
  // clarify adalah default. AI V0.3 tidak memiliki izin mutasi keranjang.
  return { reply, actions: [], productIds, modelUsed };
}

function buildPrompt(message: string, state: ConversationState, fallback: EngineOutput) {
  const catalog = PRODUCTS.map((product) =>
    `${product.id}|${product.name}|${product.category}|${product.unit}|stok:${product.stock}|alias:${product.aliases.join('/')}`,
  ).join('\n');

  return `Kamu membantu SiBantu memahami ucapan pelanggan pasar lokal. Commerce Core sudah gagal memahami pesan ini. Tugasmu hanya mengklarifikasi atau merekomendasikan produk yang benar-benar ada.

PESAN: ${message}
STATE: ${JSON.stringify({ topic: state.topic, pending: state.pending, budget: state.budget, people: state.people, preference: state.preference, lastProductIds: state.lastProductIds })}
FALLBACK: ${fallback.reply}

KATALOG:
${catalog}

TOOL YANG BOLEH:
- clarify: bertanya singkat agar maksud jelas
- recommend: menyarankan maksimal 4 productIds valid
- open_store: membuka kategori valid
- handoff: teruskan ke pedagang bila permintaan khusus/tidak yakin

DILARANG:
- add/set/remove/checkout
- mengarang harga, stok, promo, produk, atau total
- menjawab di luar kebutuhan belanja/masakan/toko

Balas satu JSON tanpa markdown:
{"reply":"jawaban ramah maksimal 60 kata","tool":"clarify|recommend|open_store|handoff","productIds":[10,2],"category":"ikan"}`;
}

export async function runAIAdapter(message: string, state: ConversationState, fallback: EngineOutput): Promise<AIAdapterResult | null> {
  const apiKey = String(process.env.AI_API_KEY ?? '').trim();
  if (!apiKey) return null;

  const endpoint = process.env.AI_ENDPOINT || 'https://api.iamhc.cn/v1/chat/completions';
  const models = [...new Set([
    process.env.AI_MODEL || 'Kimi-K2.6',
    process.env.AI_FALLBACK_MODEL || 'glm-5.1',
  ].filter(Boolean))];

  for (const model of models) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: buildPrompt(message, state, fallback) }],
          temperature: 0.35,
          max_tokens: 300,
        }),
        signal: AbortSignal.timeout(7000),
        cache: 'no-store',
      });
      if (!response.ok) continue;
      const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
      const validated = validateAIProposal(parseJSON(data.choices?.[0]?.message?.content ?? ''), model);
      if (validated) return validated;
    } catch {
      // Coba model berikutnya. Jika semuanya gagal, Commerce Core/human handoff tetap tersedia.
    }
  }
  return null;
}
