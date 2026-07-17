import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

function publicName(value: unknown) {
  const name = String(value ?? 'Pembeli').trim();
  const parts = name.split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[1][0]}.` : parts[0];
}

export async function GET(request: NextRequest) {
  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.json({ error: 'Database belum aktif.' }, { status: 503 });
  const productId = Number(request.nextUrl.searchParams.get('productId'));
  if (!Number.isInteger(productId)) return NextResponse.json({ error: 'Product ID tidak valid.' }, { status: 400 });
  const { data, error } = await supabase
    .from('product_reviews')
    .select('id,rating,comment,seller_reply,created_at,profiles(full_name)')
    .eq('product_id', productId)
    .eq('is_visible', true)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const reviews = (data ?? []).map((item: any) => ({
    id: item.id, rating: item.rating, comment: item.comment, sellerReply: item.seller_reply,
    createdAt: item.created_at, buyerName: publicName(Array.isArray(item.profiles) ? item.profiles[0]?.full_name : item.profiles?.full_name),
    verified: true,
  }));
  return NextResponse.json({ ok: true, reviews });
}

export async function POST(request: NextRequest) {
  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.json({ error: 'Database belum aktif.' }, { status: 503 });
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return NextResponse.json({ error: 'Login diperlukan.' }, { status: 401 });
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) return NextResponse.json({ error: 'Sesi tidak valid.' }, { status: 401 });

  const body = await request.json();
  const orderItemId = String(body.orderItemId ?? '');
  const rating = Number(body.rating);
  const comment = String(body.comment ?? '').trim().slice(0, 1000);
  if (!orderItemId || !Number.isInteger(rating) || rating < 1 || rating > 5) return NextResponse.json({ error: 'Rating atau item tidak valid.' }, { status: 400 });

  const { data: item } = await supabase
    .from('order_items')
    .select('id,product_id,store_id,order_id,orders(customer_id,status)')
    .eq('id', orderItemId)
    .maybeSingle();
  const order: any = Array.isArray(item?.orders) ? item?.orders[0] : item?.orders;
  if (!item || !item.product_id || order?.customer_id !== authData.user.id || order?.status !== 'completed') {
    return NextResponse.json({ error: 'Review hanya untuk pembelian yang sudah selesai.' }, { status: 403 });
  }

  const { data, error } = await supabase.from('product_reviews').insert({
    product_id: item.product_id, store_id: item.store_id, order_id: item.order_id, order_item_id: item.id,
    customer_id: authData.user.id, rating, comment: comment || null,
  }).select('id').single();
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Produk ini sudah kamu nilai.' }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, reviewId: data.id });
}
