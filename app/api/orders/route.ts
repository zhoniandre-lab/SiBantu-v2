import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { STORE_CONFIG } from '@/lib/store-config';

type OrderRequest = {
  customer?: {
    name?: string;
    whatsapp?: string;
    address?: string;
    landmark?: string;
    latitude?: number;
    longitude?: number;
  };
  items?: { productId?: number; quantity?: number; note?: string }[];
};

function cleanText(value: unknown, maxLength: number) {
  return String(value ?? '').trim().slice(0, maxLength);
}

export async function POST(request: NextRequest) {
  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, saved: false, fallback: 'whatsapp', error: 'Database belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const body = (await request.json()) as OrderRequest;
    const customer = body.customer ?? {};
    const name = cleanText(customer.name, 100);
    const phone = cleanText(customer.whatsapp, 30).replace(/[^0-9+]/g, '');
    const address = cleanText(customer.address, 500);
    const landmark = cleanText(customer.landmark, 200);
    const latitude = Number(customer.latitude);
    const longitude = Number(customer.longitude);
    const items = Array.isArray(body.items)
      ? body.items.slice(0, 100).map((item) => ({
          product_id: Number(item.productId),
          quantity: Math.round(Number(item.quantity) * 1000) / 1000,
          note: cleanText(item.note, 200),
        })).filter((item) => Number.isInteger(item.product_id) && item.product_id > 0 && item.quantity > 0 && item.quantity <= 99)
      : [];

    if (name.length < 2 || phone.replace(/\D/g, '').length < 10 || address.length < 8 || !items.length) {
      return NextResponse.json({ ok: false, error: 'Data penerima atau item belum lengkap.' }, { status: 400 });
    }

    const { data, error } = await supabase.rpc('create_guest_order', {
      p_recipient_name: name,
      p_phone: phone,
      p_address_text: address,
      p_landmark: landmark || null,
      p_latitude: Number.isFinite(latitude) ? latitude : null,
      p_longitude: Number.isFinite(longitude) ? longitude : null,
      p_delivery_fee: STORE_CONFIG.deliveryFee,
      p_items: items,
    });

    if (error) {
      console.error('create_guest_order:', error.message);
      return NextResponse.json({ ok: false, saved: false, fallback: 'whatsapp', error: 'Pesanan belum tersimpan. Lanjutkan melalui WhatsApp.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, saved: true, order: data });
  } catch (error) {
    console.error('Order API:', error);
    return NextResponse.json({ ok: false, saved: false, fallback: 'whatsapp', error: 'Pesanan tidak dapat diproses.' }, { status: 500 });
  }
}
