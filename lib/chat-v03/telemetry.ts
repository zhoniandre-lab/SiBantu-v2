import { createHash } from 'node:crypto';
import type { EngineOutput } from './types';

export type ChatTelemetry = {
  event: 'chat_v03_shadow';
  sessionHash: string;
  topic: string;
  pending: string;
  confidence: number;
  actionCount: number;
  productCount: number;
  handoff: boolean;
  latencyMs: number;
  aiStatus: string;
  timestamp: string;
};

export function hashSessionId(sessionId: string) {
  return createHash('sha256').update(sessionId || 'anonymous').digest('hex').slice(0, 16);
}

export function createTelemetryEvent(
  sessionId: string,
  result: EngineOutput,
  latencyMs: number,
  aiStatus: string,
): ChatTelemetry {
  return {
    event: 'chat_v03_shadow',
    sessionHash: hashSessionId(sessionId),
    topic: result.state.topic,
    pending: result.state.pending,
    confidence: result.confidence,
    actionCount: result.actions.length,
    productCount: result.productIds.length,
    handoff: Boolean(result.handoff),
    latencyMs,
    aiStatus,
    timestamp: new Date().toISOString(),
  };
}

export function logTelemetry(event: ChatTelemetry) {
  // Tidak menyimpan pesan mentah, nama, nomor telepon, alamat, atau isi keranjang.
  console.info(JSON.stringify(event));
}
