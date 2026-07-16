import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

function allowedEmails() {
  return new Set(String(process.env.SIBANTU_ADMIN_EMAILS ?? '').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean));
}

async function authorize(request: NextRequest) {
  const supabase = getServerSupabase();
  if (!supabase) return { error: 'Database belum aktif.', status: 503 } as const;
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return { error: 'Login admin diperlukan.', status: 401 } as const;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.email) return { error: 'Sesi tidak valid.', status: 401 } as const;
  if (!allowedEmails().has(data.user.email.toLowerCase())) return { error: 'Akun bukan admin SiBantu.', status: 403 } as const;
  return { supabase, user: data.user } as const;
}

export async function GET(request: NextRequest) {
  const auth = await authorize(request);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data, error } = await auth.supabase
    .from('seller_applications')
    .select('id,applicant_id,identity_name,store_name,whatsapp,address_text,business_type,category_slugs,status,review_note,created_at')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, applications: data ?? [], admin: auth.user.email });
}

export async function POST(request: NextRequest) {
  const auth = await authorize(request);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = (await request.json()) as { applicationId?: string; action?: 'approve' | 'reject'; note?: string };
  const applicationId = String(body.applicationId ?? '');
  const note = String(body.note ?? '').trim().slice(0, 500);
  if (!applicationId || !['approve', 'reject'].includes(String(body.action))) {
    return NextResponse.json({ error: 'Permintaan tidak valid.' }, { status: 400 });
  }

  // Fungsi approval memverifikasi role admin. Email allowlist di server menjadi bootstrap admin.
  await auth.supabase.from('profiles').update({ role: 'admin' }).eq('id', auth.user.id);

  if (body.action === 'reject') {
    const { error } = await auth.supabase.from('seller_applications').update({ status: 'rejected', review_note: note || 'Pendaftaran belum memenuhi persyaratan.', reviewed_by: auth.user.id, reviewed_at: new Date().toISOString() }).eq('id', applicationId).eq('status', 'pending');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, status: 'rejected' });
  }

  const { data, error } = await auth.supabase.rpc('approve_seller_application', { p_application_id: applicationId, p_admin_id: auth.user.id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, status: 'active', storeId: data });
}
