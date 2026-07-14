import { NextRequest, NextResponse } from 'next/server';
import { runAIAdapter } from '@/lib/chat-v03/ai-adapter';
import { shouldUseCanary } from '@/lib/chat-v03/canary';
import { runChatEngine } from '@/lib/chat-v03/engine';
import { verifyOptInToken } from '@/lib/chat-v03/opt-in';
import { signConversationState, verifyConversationState } from '@/lib/chat-v03/state-token';
import { createTelemetryEvent, logTelemetry } from '@/lib/chat-v03/telemetry';
import type { CartItem } from '@/lib/types';

function configuredPercentage() {
  return Math.max(0, Math.min(100, Number(process.env.CHAT_V03_CANARY_PERCENT) || 0));
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'SiBantu Chat V0.3 Canary',
    version: '0.3.0',
    percentage: configuredPercentage(),
    productionDefault: false,
  });
}

export async function POST(request: NextRequest) {
  const startedAt = performance.now();
  try {
    const body = (await request.json()) as {
      message?: string;
      stateToken?: string;
      cart?: CartItem[];
      sessionId?: string;
    };
    const sessionId = String(body.sessionId ?? '').slice(0, 80);
    if (!sessionId) return NextResponse.json({ error: 'Session ID wajib diisi.' }, { status: 400 });

    const percentage = configuredPercentage();
    const forceV03 = verifyOptInToken(request.cookies.get('sibantu_v03_force')?.value);
    if (!forceV03 && !shouldUseCanary(sessionId, percentage)) {
      return NextResponse.json({ useLegacy: true, version: 'legacy', percentage }, { status: 409 });
    }

    const message = String(body.message ?? '').slice(0, 1000).trim();
    if (!message) return NextResponse.json({ error: 'Pesan wajib diisi.' }, { status: 400 });

    const state = verifyConversationState(body.stateToken);
    const coreResult = runChatEngine({ message, state, cart: Array.isArray(body.cart) ? body.cart.slice(0, 100) : [] });
    const needsAI = coreResult.confidence < 0.65 && Boolean(coreResult.handoff);
    const aiStartedAt = performance.now();
    const aiResult = needsAI ? await runAIAdapter(message, coreResult.state, coreResult) : null;
    const aiLatencyMs = Math.round((performance.now() - aiStartedAt) * 100) / 100;

    const finalResult = aiResult
      ? { ...coreResult, reply: aiResult.reply, actions: aiResult.actions, productIds: aiResult.productIds, handoff: aiResult.handoff, confidence: 0.75 }
      : coreResult;
    const aiStatus = !needsAI ? 'not_needed' : aiResult ? 'active' : 'fallback';
    const latencyMs = Math.round((performance.now() - startedAt) * 100) / 100;
    logTelemetry(createTelemetryEvent(sessionId, finalResult, latencyMs, aiStatus));

    return NextResponse.json({
      ...finalResult,
      stateToken: signConversationState(finalResult.state),
      version: '0.3.0',
      canary: true,
      forcedOptIn: forceV03,
      percentage,
      aiStatus,
      modelUsed: aiResult?.modelUsed,
      latencyMs,
      aiLatencyMs,
    });
  } catch (error) {
    console.error('Chat V0.3 canary error:', error);
    return NextResponse.json({ error: 'Permintaan tidak dapat diproses.' }, { status: 500 });
  }
}
