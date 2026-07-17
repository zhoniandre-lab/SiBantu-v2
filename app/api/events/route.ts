import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { hashSessionId } from '@/lib/chat-v03/telemetry';

const PRODUCT_EVENTS = new Set(['impression','view','click','add_cart','remove_cart','checkout','purchase','chat_seller']);

export async function POST(request: NextRequest) {
  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.json({ ok: false }, { status: 503 });
  try {
    const body = await request.json();
    const sessionId = String(body.sessionId ?? '').slice(0, 100);
    if (!sessionId) return NextResponse.json({ error: 'Session diperlukan.' }, { status: 400 });
    const sessionHash = hashSessionId(sessionId);
    let profileId: string | null = null;
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (token) profileId = (await supabase.auth.getUser(token)).data.user?.id ?? null;

    if (body.eventType === 'search') {
      const query = String(body.query ?? '').toLowerCase().trim().replace(/\s+/g, ' ').slice(0, 120);
      if (query.length < 2) return NextResponse.json({ ok: true, skipped: true });
      await supabase.from('search_events').insert({ session_hash: sessionHash, profile_id: profileId, query_normalized: query, category_slug: String(body.category ?? '').slice(0, 40) || null, result_count: Math.max(0, Math.min(10000, Number(body.resultCount) || 0)), clicked_product_id: Number(body.clickedProductId) || null });
      return NextResponse.json({ ok: true });
    }

    const eventType = String(body.eventType ?? '');
    const productId = Number(body.productId);
    if (!PRODUCT_EVENTS.has(eventType) || !Number.isInteger(productId)) return NextResponse.json({ error: 'Event tidak valid.' }, { status: 400 });
    const { data: product } = await supabase.from('products').select('id,store_id').eq('id', productId).eq('is_active', true).eq('moderation_status', 'approved').maybeSingle();
    if (!product) return NextResponse.json({ ok: true, skipped: true });
    await supabase.from('product_events').insert({ event_type: eventType, session_hash: sessionHash, profile_id: profileId, product_id: product.id, store_id: product.store_id, source: String(body.source ?? 'app').slice(0, 50), metadata: typeof body.metadata === 'object' && body.metadata ? body.metadata : {} });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
}
