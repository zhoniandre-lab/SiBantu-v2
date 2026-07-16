import { NextRequest, NextResponse } from 'next/server';
import { ownedStore } from '@/lib/supabase/auth-server';

const ALLOWED_STATUS = ['confirmed','preparing','delivering','completed','cancelled'];

export async function GET(request: NextRequest) {
  const auth = await ownedStore(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { data, error } = await auth.supabase
    .from('store_orders')
    .select('id,status,items_subtotal,platform_fee,seller_net,created_at,orders(order_number,created_at,addresses(recipient_name,phone,address_text,landmark,latitude,longitude)),order_items(product_name,variant_label,unit_price,quantity,line_total,note)')
    .eq('store_id', auth.store.id)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const totals = (data ?? []).filter((item) => item.status === 'completed').reduce((sum, item) => sum + Number(item.seller_net || 0), 0);
  return NextResponse.json({ ok: true, store: auth.store, orders: data ?? [], completedRevenue: totals });
}

export async function PATCH(request: NextRequest) {
  const auth = await ownedStore(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await request.json(); const orderId = String(body.orderId ?? ''); const status = String(body.status ?? '');
  if (!orderId || !ALLOWED_STATUS.includes(status)) return NextResponse.json({ error: 'Status atau order tidak valid.' }, { status: 400 });
  const timestamps: Record<string,string> = {};
  if (status === 'confirmed') timestamps.accepted_at = new Date().toISOString();
  if (status === 'preparing') timestamps.prepared_at = new Date().toISOString();
  const { data, error } = await auth.supabase.from('store_orders').update({ status, ...timestamps }).eq('id', orderId).eq('store_id', auth.store.id).select('order_id').maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Order bukan milik toko.' }, { status: 403 });
  await auth.supabase.from('order_status_history').insert({ order_id: data.order_id, status, note: `Status diperbarui oleh toko ${auth.store.name}` });
  return NextResponse.json({ ok: true, status });
}
