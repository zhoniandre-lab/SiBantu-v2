export type ProductRiskInput = {
  name: string;
  description: string;
  category: string;
  price: number;
  stock: number;
  duplicate: boolean;
  uploadsLastHour: number;
  imageCount?: number;
};

export type ProductRiskResult = {
  safe: boolean;
  score: number;
  reasons: string[];
};

const PROHIBITED_PATTERNS: Array<[RegExp, string]> = [
  [/\b(narkoba|sabu|ganja|ekstasi)\b/i, 'Produk terlarang/narkotika'],
  [/\b(senjata api|pistol|amunisi)\b/i, 'Senjata atau amunisi'],
  [/\b(judi|slot online)\b/i, 'Konten perjudian'],
  [/\b(pornografi|konten dewasa)\b/i, 'Konten dewasa'],
  [/\b(obat keras|resep dokter)\b/i, 'Produk kesehatan memerlukan pemeriksaan'],
];

const ALLOWED_CATEGORIES = new Set(['sayur','ikan','daging','sembako','buah','bumbu','rumah']);

export function evaluateProductRisk(input: ProductRiskInput): ProductRiskResult {
  const reasons: string[] = [];
  let score = 0;
  const combined = `${input.name} ${input.description}`;

  for (const [pattern, reason] of PROHIBITED_PATTERNS) {
    if (pattern.test(combined)) { reasons.push(reason); score += 100; }
  }
  if (!ALLOWED_CATEGORIES.has(input.category)) { reasons.push('Kategori tidak diizinkan'); score += 100; }
  if (input.name.trim().length < 2) { reasons.push('Nama terlalu pendek'); score += 40; }
  if (input.name.length > 120) { reasons.push('Nama terlalu panjang'); score += 30; }
  if (!Number.isFinite(input.price) || input.price < 100) { reasons.push('Harga terlalu rendah/tidak valid'); score += 40; }
  if (input.price > 50_000_000) { reasons.push('Harga sangat tinggi'); score += 40; }
  if (!Number.isFinite(input.stock) || input.stock < 0) { reasons.push('Stok tidak valid'); score += 50; }
  if (input.stock > 100_000) { reasons.push('Stok tidak wajar'); score += 25; }
  if (input.duplicate) { reasons.push('Nama produk duplikat di toko'); score += 50; }
  if (input.uploadsLastHour >= 20) { reasons.push('Terlalu banyak upload dalam satu jam'); score += 60; }
  if ((input.imageCount ?? 0) < 2) { reasons.push('Minimal 2 foto produk diperlukan'); score += 30; }
  if ((input.imageCount ?? 0) > 8) { reasons.push('Maksimal 8 foto produk'); score += 40; }
  if (/(wa\.me|https?:\/\/|t\.me|telegram)/i.test(combined)) { reasons.push('Tautan eksternal pada produk'); score += 40; }

  return { safe: score === 0, score, reasons };
}
