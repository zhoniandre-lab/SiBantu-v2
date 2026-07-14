import { PRODUCTS } from '../catalog';
import type { Product } from '../types';
import { normalizeText } from './normalize';

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function levenshtein(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const saved = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = saved;
    }
  }
  return row[b.length];
}

type Match = { product: Product; score: number; position: number; exact: boolean };

function matchProduct(text: string, product: Product): Match | null {
  const candidates = [product.name, ...product.aliases].map(normalizeText).sort((a, b) => b.length - a.length);
  for (const candidate of candidates) {
    const regex = new RegExp(`(^|\\s)${escapeRegex(candidate).replace(/\\ /g, '\\s+')}(?:nya)?(?=\\s|$|[,.])`);
    const match = regex.exec(text);
    if (match) return { product, score: 100 + candidate.length, position: match.index + match[1].length, exact: true };
  }

  const words = text.split(' ');
  let best: Match | null = null;
  for (const candidate of candidates.filter((item) => !item.includes(' ') && item.length >= 4)) {
    words.forEach((word, index) => {
      if (word.length < 4 || Math.abs(word.length - candidate.length) > 1) return;
      const distance = levenshtein(word, candidate);
      if (distance <= 1) {
        const position = words.slice(0, index).join(' ').length + (index ? 1 : 0);
        const match = { product, score: 70 - distance, position, exact: false };
        if (!best || match.score > best.score) best = match;
      }
    });
  }
  return best;
}

export function findProducts(input: string) {
  const text = normalizeText(input);
  const matches = PRODUCTS.map((product) => matchProduct(text, product)).filter((item): item is Match => Boolean(item));
  const exactMatches = matches.filter((item) => item.exact);
  const selected = exactMatches.length ? exactMatches : matches.filter((item) => item.score === Math.max(...matches.map((match) => match.score)));
  return selected.sort((a, b) => a.position - b.position);
}

export function findProductById(id: number) {
  return PRODUCTS.find((product) => product.id === id);
}
