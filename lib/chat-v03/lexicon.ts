import type { CategoryId } from '../types';

export const TYPO_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\b(sya|sy|sayaah)\b/g, 'saya'],
  [/\b(bl[iy]|bliin|bell?i|beliin)\b/g, 'beli'],
  [/\b(pesen|psan|pesenkan)\b/g, 'pesan'],
  [/\b(ckup|cukub|cukuup)\b/g, 'cukup'],
  [/\b(stengah|setngah|stngah)\b/g, 'setengah'],
  [/\b(sprapat|seprapat|sepermpat)\b/g, 'seperempat'],
  [/\b(ikam|ikn)\b/g, 'ikan'],
  [/\b(gireng|gorng)\b/g, 'goreng'],
  [/\b(syur|sayurr|sayran|syuran)\b/g, 'sayur'],
  [/\b(sayuran|sayur mayur)\b/g, 'sayur'],
  [/\b(cabe)\b/g, 'cabai'],
  [/\b(minya|minyk)\b/g, 'minyak'],
  [/\b(kranjang|keranjng)\b/g, 'keranjang'],
  [/\b(brp)\b/g, 'berapa'],
  [/\b(rbu|reb[u])\b/g, 'ribu'],
  [/\b(gk|ga|ngga|ngak|enggak)\b/g, 'tidak'],
  [/\b(aj|ja)\b/g, 'aja'],
];

export const CATEGORY_ALIASES: Record<CategoryId, string[]> = {
  sayur: ['sayur', 'sayur mayur', 'sayuran', 'vegetable'],
  ikan: ['ikan', 'hasil laut', 'seafood'],
  buah: ['buah', 'buah buahan', 'buahan'],
  sembako: ['sembako', 'bahan pokok', 'kebutuhan pokok'],
  daging: ['daging', 'ayam', 'protein hewani'],
  bumbu: ['bumbu', 'rempah', 'bahan dapur'],
  rumah: ['kebutuhan rumah', 'alat rumah', 'sabun', 'deterjen'],
};

export const NUMBER_WORDS: Record<string, number> = {
  nol: 0,
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

export const CONNECTOR_WORDS = new Set([
  'dan', 'sama', 'serta', 'terus', 'juga', 'selain', 'lalu', 'kemudian',
  'yang', 'itu', 'tadi', 'aja', 'saja', 'dong', 'tolong', 'mohon',
]);
