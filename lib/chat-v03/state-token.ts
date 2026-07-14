import { createHmac, timingSafeEqual } from 'node:crypto';
import { INITIAL_STATE, type ConversationState } from './types';

function encode(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function decode(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function getSecret() {
  const secret = process.env.CHAT_STATE_SECRET;
  if (secret) return secret;
  // Shadow mode only. Production canary wajib mengatur CHAT_STATE_SECRET.
  return 'sibantu-v03-shadow-development-secret';
}

function signature(payload: string) {
  return createHmac('sha256', getSecret()).update(payload).digest('base64url');
}

export function signConversationState(state: ConversationState) {
  const payload = encode(JSON.stringify(state));
  return `${payload}.${signature(payload)}`;
}

export function verifyConversationState(token?: string): ConversationState {
  if (!token) return { ...INITIAL_STATE, lastProductIds: [], lastCategoryIds: [] };
  const [payload, providedSignature] = token.split('.');
  if (!payload || !providedSignature) return { ...INITIAL_STATE, lastProductIds: [], lastCategoryIds: [] };

  const expected = signature(payload);
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(providedSignature);
  if (expectedBuffer.length !== providedBuffer.length || !timingSafeEqual(expectedBuffer, providedBuffer)) {
    return { ...INITIAL_STATE, lastProductIds: [], lastCategoryIds: [] };
  }

  try {
    const parsed = JSON.parse(decode(payload)) as Partial<ConversationState>;
    return {
      ...INITIAL_STATE,
      ...parsed,
      lastProductIds: Array.isArray(parsed.lastProductIds) ? parsed.lastProductIds.filter(Number.isFinite).slice(0, 10) : [],
      lastCategoryIds: Array.isArray(parsed.lastCategoryIds) ? parsed.lastCategoryIds.slice(0, 10) : [],
      turn: Math.max(0, Math.min(1000, Number(parsed.turn) || 0)),
    };
  } catch {
    return { ...INITIAL_STATE, lastProductIds: [], lastCategoryIds: [] };
  }
}
