import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

const one = (value: any) => Array.isArray(value) ? value[0] : value;

export async function GET() {
  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.json({ error: 'Database belum aktif.' }, { status: 503 });
  const { data, error } = await supabase
    .from('products')
    .select('id,name,description,emoji,image_url,store_id,stores(name,slug,logo_url,is_accepting_orders,preparation_minutes,min_order),categories(slug),product_variants(label,unit,price,stock,is_default,is_active),product_aliases(alias),product_media(id,media_type,url,thumbnail_url,sort_order,moderation_status)')
    .eq('is_active', true)
    .eq('moderation_status', 'approved')
    .order('id', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const productIds = (data ?? []).map((row: any) => Number(row.id));
  const storeIds = [...new Set((data ?? []).map((row: any) => row.store_id))];
  const [ratingsResult, salesResult, storesResult] = await Promise.all([
    productIds.length ? supabase.from('product_rating_summary').select('product_id,review_count,average_rating').in('product_id', productIds) : Promise.resolve({ data: [] }),
    productIds.length ? supabase.from('product_sales_summary').select('product_id,sold_quantity,completed_orders').in('product_id', productIds) : Promise.resolve({ data: [] }),
    storeIds.length ? supabase.from('store_rating_summary').select('store_id,review_count,average_rating').in('store_id', storeIds) : Promise.resolve({ data: [] }),
  ]);
  const ratingMap = new Map((ratingsResult.data ?? []).map((item: any) => [Number(item.product_id), item]));
  const salesMap = new Map((salesResult.data ?? []).map((item: any) => [Number(item.product_id), item]));
  const storeRatingMap = new Map((storesResult.data ?? []).map((item: any) => [item.store_id, item]));

  const products = (data ?? []).map((row: any) => {
    const variant = row.product_variants?.find((item: any) => item.is_default && item.is_active);
    if (!variant) return null;
    const rating: any = ratingMap.get(Number(row.id));
    const sales: any = salesMap.get(Number(row.id));
    const storeRating: any = storeRatingMap.get(row.store_id);
    const media = (row.product_media ?? [])
      .filter((item: any) => item.moderation_status === 'approved')
      .sort((a: any, b: any) => a.sort_order - b.sort_order)
      .map((item: any) => ({ id: item.id, type: item.media_type, url: item.url, thumbnailUrl: item.thumbnail_url, sortOrder: item.sort_order }));
    return {
      id: Number(row.id), name: row.name, description: row.description || '', emoji: row.emoji || '📦',
      imageUrl: row.image_url || media.find((item: any) => item.type === 'image')?.url,
      media, category: one(row.categories)?.slug, price: Number(variant.price), unit: variant.unit,
      aliases: (row.product_aliases || []).map((item: any) => item.alias), stock: Number(variant.stock),
      storeName: one(row.stores)?.name || 'SiBantu', storeId: row.store_id,
      storeSlug: one(row.stores)?.slug, storeLogoUrl: one(row.stores)?.logo_url,
      storeIsAcceptingOrders: Boolean(one(row.stores)?.is_accepting_orders),
      storePreparationMinutes: Number(one(row.stores)?.preparation_minutes || 30),
      storeMinOrder: Number(one(row.stores)?.min_order || 0),
      averageRating: Number(rating?.average_rating || 0), reviewCount: Number(rating?.review_count || 0),
      soldCount: Number(sales?.sold_quantity || 0), storeRating: Number(storeRating?.average_rating || 0),
      storeReviewCount: Number(storeRating?.review_count || 0),
    };
  }).filter(Boolean);

  return NextResponse.json({ ok: true, products }, { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' } });
}
