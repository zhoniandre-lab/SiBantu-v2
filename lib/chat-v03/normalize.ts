import { CATEGORY_ALIASES, NUMBER_WORDS, TYPO_REPLACEMENTS } from './lexicon';
import type { CategoryId } from '../types';

export function normalizeText(input: string) {
  let text = String(input || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9.,\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  for (const [pattern, replacement] of TYPO_REPLACEMENTS) text = text.replace(pattern, replacement);
  return text.replace(/\s+/g, ' ').trim();
}

export function tokens(input: string) {
  return normalizeText(input).split(' ').filter(Boolean);
}

export function parseNumbers(input: string) {
  const text = normalizeText(input);
  const wordPattern = Object.keys(NUMBER_WORDS).join('|');
  const matches = text.match(new RegExp(`\\b(\\d+(?:[.,]\\d+)?|${wordPattern})\\b`, 'g')) ?? [];
  return matches.map((raw) => NUMBER_WORDS[raw] ?? Number(raw.replace(',', '.'))).filter(Number.isFinite);
}

export function parseBudget(input: string) {
  const text = normalizeText(input);
  const short = text.match(/(?:rp\s*)?(\d+(?:[.,]\d+)?)\s*(ribu|rb|k)\b/);
  if (short) return Math.round(Number(short[1].replace(',', '.')) * 1000);
  const full = text.match(/(?:rp\s*)?(\d{4,9})\b/);
  return full ? Number(full[1]) : undefined;
}

export function parsePeople(input: string) {
  const text = normalizeText(input);
  const words = Object.keys(NUMBER_WORDS).join('|');
  const before = text.match(new RegExp(`\\b(\\d+|${words})\\s*(orang|porsi)\\b`));
  const after = text.match(new RegExp(`\\b(orang|porsi)\\s*(\\d+|${words})\\b`));
  const raw = before?.[1] ?? after?.[2];
  return raw ? NUMBER_WORDS[raw] ?? Number(raw) : undefined;
}

export function findCategories(input: string): CategoryId[] {
  const text = normalizeText(input);
  const result: CategoryId[] = [];
  for (const [category, aliases] of Object.entries(CATEGORY_ALIASES) as [CategoryId, string[]][]) {
    if (aliases.some((alias) => new RegExp(`(^|\\s)${alias.replace(/\s+/g, '\\s+')}(?=\\s|$|[,.])`).test(text))) result.push(category);
  }
  return [...new Set(result)];
}

export function hasAny(input: string, patterns: RegExp[]) {
  const text = normalizeText(input);
  return patterns.some((pattern) => pattern.test(text));
}
