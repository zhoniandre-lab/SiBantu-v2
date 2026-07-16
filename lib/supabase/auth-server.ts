import type { NextRequest } from 'next/server';
import { getServerSupabase } from './server';

export async function authenticateRequest(request: NextRequest) {
  const supabase = getServerSupabase();
  if (!supabase) return { ok: false as const, error: 'Database belum aktif.', status: 503 };
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return { ok: false as const, error: 'Login diperlukan.', status: 401 };
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return { ok: false as const, error: 'Sesi tidak valid.', status: 401 };
  return { ok: true as const, supabase, user: data.user };
}

export async function ownedStore(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return auth;
  const { data, error } = await auth.supabase.from('stores').select('id,name,status,commission_rate').eq('owner_id', auth.user.id).limit(1).maybeSingle();
  if (error) return { ok: false as const, error: error.message, status: 500 };
  if (!data || data.status !== 'active') return { ok: false as const, error: 'Toko aktif tidak ditemukan.', status: 403 };
  return { ok: true as const, supabase: auth.supabase, user: auth.user, store: data };
}
