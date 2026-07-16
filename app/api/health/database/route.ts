import { NextResponse } from 'next/server';
import { databaseConfigured, getServerSupabase } from '@/lib/supabase/server';

export async function GET() {
  if (!databaseConfigured()) {
    return NextResponse.json({ ok: false, configured: false, message: 'Supabase Environment Variables belum diatur.' }, { status: 503 });
  }

  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.json({ ok: false, configured: false }, { status: 503 });

  const started = performance.now();
  const { error, count } = await supabase.from('categories').select('*', { count: 'exact', head: true });
  const latencyMs = Math.round((performance.now() - started) * 100) / 100;
  if (error) {
    return NextResponse.json({ ok: false, configured: true, connected: false, latencyMs, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, configured: true, connected: true, categories: count ?? 0, latencyMs });
}
