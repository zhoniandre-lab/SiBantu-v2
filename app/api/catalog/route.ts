import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

export async function GET() {
  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.json({ error: 'Database belum aktif.' }, { status: 503 });
  const { data, error } = await supabase
    .from('products')
    .select('id,name,description,emoji,image_url,store_id,stores(name),categories(slug),product_variants(label,unit,price,stock,is_default,is_active),product_aliases(alias)')
    .eq('is_active', true)
    .eq('moderation_status', 'approved')
    .order('id', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const products = (data ?? []).map((row: any) => {
    const variant = row.product_variants?.find((item: any) => item.is_default && item.is_active);
    if (!variant) return null;
    return {
      id: Number(row.id), name: row.name, description: row.description || '', emoji: row.emoji || '📦',
      category: row.categories?.slug, price: Number(variant.price), unit: variant.unit,
      aliases: (row.product_aliases || []).map((item: any) => item.alias), stock: Number(variant.stock),
      storeName: row.stores?.name || 'SiBantu', storeId: row.store_id,
    };
  }).filter(Boolean);

  return NextResponse.json({ ok: true, products }, { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' } });
}
