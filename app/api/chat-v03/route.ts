import { NextResponse } from 'next/server';
import { runAIAdapter } from '@/lib/chat-v03/ai-adapter';
import { runChatEngine } from '@/lib/chat-v03/engine';
import { signConversationState, verifyConversationState } from '@/lib/chat-v03/state-token';
import { createTelemetryEvent, logTelemetry } from '@/lib/chat-v03/telemetry';
import type { ConversationState } from '@/lib/chat-v03/types';
import type { CartItem } from '@/lib/types';

function authorized(request: Request) {
  const key = process.env.CHAT_LAB_KEY;
  return Boolean(key && request.headers.get('x-chat-lab-key') === key);
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({
    ok: true,
    service: 'SiBantu Chat Engine V0.3 Shadow',
    version: '0.3.0',
    mode: 'shadow',
    productionDefault: false,
    regressionTests: 103,
    aiConfigured: Boolean(process.env.AI_API_KEY),
    stateProtection: 'hmac-sha256',
  });
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const startedAt = performance.now();
  try {
    const body = (await request.json()) as {
      message?: string;
      state?: ConversationState;
      stateToken?: string;
      cart?: CartItem[];
      sessionId?: string;
    };
    const message = String(body.message ?? '').slice(0, 1000).trim();
    if (!message) return NextResponse.json({ error: 'Pesan wajib diisi.' }, { status: 400 });

    const state = body.state ?? verifyConversationState(body.stateToken);
    const coreResult = runChatEngine({
      message,
      state,
      cart: Array.isArray(body.cart) ? body.cart.slice(0, 100) : [],
    });

    const needsAI = coreResult.confidence < 0.65 && Boolean(coreResult.handoff);
    const aiStartedAt = performance.now();
    const aiResult = needsAI ? await runAIAdapter(message, coreResult.state, coreResult) : null;
    const aiLatencyMs = Math.round((performance.now() - aiStartedAt) * 100) / 100;

    const finalResult = aiResult
      ? {
          ...coreResult,
          reply: aiResult.reply,
          actions: aiResult.actions,
          productIds: aiResult.productIds,
          handoff: aiResult.handoff,
          confidence: 0.75,
        }
      : coreResult;

    const aiStatus = !needsAI ? 'not_needed' : aiResult ? 'active' : 'fallback';
    const latencyMs = Math.round((performance.now() - startedAt) * 100) / 100;
    const sessionId = String(body.sessionId ?? '').slice(0, 80);
    logTelemetry(createTelemetryEvent(sessionId, finalResult, latencyMs, aiStatus));

    return NextResponse.json({
      ...finalResult,
      stateToken: signConversationState(finalResult.state),
      version: '0.3.0',
      mode: 'shadow',
      aiStatus,
      modelUsed: aiResult?.modelUsed,
      sessionId,
      latencyMs,
      aiLatencyMs,
    });
  } catch (error) {
    console.error('Chat V0.3 shadow error:', error);
    return NextResponse.json({ error: 'Permintaan tidak dapat diproses.' }, { status: 500 });
  }
}
