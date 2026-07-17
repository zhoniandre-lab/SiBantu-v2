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
  const reason = String(body.reason ?? '').trim().slice(0, 300);
  if (!orderId || !ALLOWED_STATUS.includes(status)) return NextResponse.json({ error: 'Status atau order tidak valid.' }, { status: 400 });

  const { data: current, error: currentError } = await auth.supabase.from('store_orders').select('id,order_id,status').eq('id', orderId).eq('store_id', auth.store.id).maybeSingle();
  if (currentError) return NextResponse.json({ error: currentError.message }, { status: 500 });
  if (!current) return NextResponse.json({ error: 'Order bukan milik toko.' }, { status: 403 });
  if (current.status === status) return NextResponse.json({ ok: true, status, unchanged: true });

  const transitions: Record<string, string[]> = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['preparing', 'cancelled'],
    preparing: ['delivering', 'cancelled'],
    delivering: ['completed'],
    completed: [],
    cancelled: [],
  };
  if (!(transitions[current.status] ?? []).includes(status)) {
    return NextResponse.json({ error: `Status tidak dapat diubah dari ${current.status} ke ${status}.` }, { status: 409 });
  }
  if (status === 'cancelled' && reason.length < 4) {
    return NextResponse.json({ error: 'Alasan pembatalan wajib diisi.' }, { status: 400 });
  }

  const timestamps: Record<string,string> = {};
  if (status === 'confirmed') timestamps.accepted_at = new Date().toISOString();
  if (status === 'preparing') timestamps.prepared_at = new Date().toISOString();
  const { error } = await auth.supabase.from('store_orders').update({ status, ...timestamps }).eq('id', orderId).eq('store_id', auth.store.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { data: siblingOrders } = await auth.supabase.from('store_orders').select('status').eq('order_id', current.order_id);
  const statuses = (siblingOrders ?? []).map((item) => item.status);
  let parentStatus = 'pending';
  if (statuses.length && statuses.every((item) => item === 'completed')) parentStatus = 'completed';
  else if (statuses.length && statuses.every((item) => item === 'cancelled')) parentStatus = 'cancelled';
  else if (statuses.some((item) => item === 'delivering')) parentStatus = 'delivering';
  else if (statuses.some((item) => item === 'preparing')) parentStatus = 'preparing';
  else if (statuses.some((item) => item === 'confirmed' || item === 'completed')) parentStatus = 'confirmed';

  const { data: parentOrder } = await auth.supabase.from('orders').update({ status: parentStatus, updated_at: new Date().toISOString() }).eq('id', current.order_id).select('customer_id,order_number').maybeSingle();
  const historyNote = status === 'cancelled' ? `Dibatalkan oleh toko ${auth.store.name}: ${reason}` : `Status diperbarui oleh toko ${auth.store.name}`;
  await auth.supabase.from('order_status_history').insert({ order_id: current.order_id, status: parentStatus, note: historyNote });

  if (parentOrder?.customer_id) {
    const messages: Record<string, { title: string; body: string }> = {
      confirmed: { title: 'Pesanan diterima toko', body: `${parentOrder.order_number} sudah diterima dan barang sedang dicarikan.` },
      preparing: { title: 'Pesanan sedang disiapkan', body: `${parentOrder.order_number} sedang disiapkan oleh pedagang.` },
      delivering: { title: 'Pesanan siap diantar', body: `${parentOrder.order_number} sedang menuju alamatmu. Siapkan uang pas untuk COD.` },
      completed: { title: 'Pesanan selesai', body: `${parentOrder.order_number} selesai. Berikan penilaian untuk produk dan toko.` },
      cancelled: { title: 'Pesanan dibatalkan', body: `${parentOrder.order_number} dibatalkan. Hubungi admin jika perlu bantuan.` },
    };
    const notification = messages[parentStatus];
    if (notification) await auth.supabase.from('notifications').insert({ profile_id: parentOrder.customer_id, notification_type: `order_${parentStatus}`, title: notification.title, body: notification.body, link_url: '/akun/dashboard?tab=orders' });
  }

  return NextResponse.json({ ok: true, status, orderStatus: parentStatus });
}
