import { NextResponse } from 'next/server';
import { respondToCustomer } from '@/lib/commerce-engine';
import type { CartItem, ChatMessage } from '@/lib/types';

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'SiBantu V2 Commerce Core',
    version: '0.1.0',
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      message?: string;
      cart?: CartItem[];
      history?: ChatMessage[];
      sessionId?: string;
    };

    const message = String(body.message ?? '').slice(0, 1000);
    if (!message.trim()) {
      return NextResponse.json({ error: 'Pesan wajib diisi.' }, { status: 400 });
    }

    const cart = Array.isArray(body.cart) ? body.cart.slice(0, 100) : [];
    const history = Array.isArray(body.history) ? body.history.slice(-12) : [];
    const result = respondToCustomer(message, cart, history);

    return NextResponse.json({
      ...result,
      sessionId: String(body.sessionId ?? '').slice(0, 80),
      source: result.needsAI ? 'commerce-core-ai-ready' : 'commerce-core',
    });
  } catch (error) {
    console.error('SiBantu V2 chat error:', error);
    return NextResponse.json({ error: 'Permintaan tidak dapat diproses.' }, { status: 500 });
  }
}
