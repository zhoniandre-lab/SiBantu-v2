import type { CartItem, ChatMessage, ChatResponse } from '../types';

export type ChatClientResult = ChatResponse & {
  engine: 'legacy' | 'v03';
  stateToken?: string;
  latencyMs?: number;
  aiStatus?: string;
  modelUsed?: string;
};

export type ChatClientPayload = {
  message: string;
  cart: CartItem[];
  history: ChatMessage[];
  sessionId: string;
};

const assignmentKey = (sessionId: string) => `sibantu_chat_assignment_${sessionId}`;
const tokenKey = (sessionId: string) => `sibantu_v03_state_${sessionId}`;

async function legacyRequest(payload: ChatClientPayload): Promise<ChatClientResult> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error('Legacy chat gagal');
  return { ...(await response.json()), engine: 'legacy' } as ChatClientResult;
}

export async function requestChatWithCanary(payload: ChatClientPayload): Promise<ChatClientResult> {
  const assignment = sessionStorage.getItem(assignmentKey(payload.sessionId));
  if (assignment === 'legacy') return legacyRequest(payload);

  const stateToken = sessionStorage.getItem(tokenKey(payload.sessionId)) || undefined;
  const canaryResponse = await fetch('/api/chat-v03-canary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: payload.message, cart: payload.cart, sessionId: payload.sessionId, stateToken }),
  });

  if (canaryResponse.status === 409) {
    sessionStorage.setItem(assignmentKey(payload.sessionId), 'legacy');
    return legacyRequest(payload);
  }
  if (!canaryResponse.ok) {
    // Kegagalan canary tidak boleh memblokir transaksi pelanggan.
    return legacyRequest(payload);
  }

  const result = (await canaryResponse.json()) as ChatClientResult;
  sessionStorage.setItem(assignmentKey(payload.sessionId), 'v03');
  if (result.stateToken) sessionStorage.setItem(tokenKey(payload.sessionId), result.stateToken);
  return { ...result, engine: 'v03' };
}

export function resetChatAssignment(sessionId: string) {
  sessionStorage.removeItem(assignmentKey(sessionId));
  sessionStorage.removeItem(tokenKey(sessionId));
}
