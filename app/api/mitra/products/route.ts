import { NextRequest, NextResponse } from 'next/server';
import { ownedStore } from '@/lib/supabase/auth-server';
import { evaluateProductRisk } from '@/lib/marketplace/product-risk';

function text(value: unknown, max = 200) { return String(value ?? '').trim().slice(0, max); }

export async function GET(request: NextRequest) {
  const auth = await ownedStore(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { data, error } = await auth.supabase
    .from('products')
    .select('id,name,description,emoji,image_url,moderation_status,moderation_note,is_active,created_at,categories(slug,name),product_variants(id,label,unit,price,stock,is_default,is_active)')
    .eq('store_id', auth.store.id)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, store: auth.store, products: data ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await ownedStore(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await request.json();
  const name = text(body.name, 120); const description = text(body.description, 500); const emoji = text(body.emoji, 8) || '📦';
  const categorySlug = text(body.category, 40); const unit = text(body.unit, 40); const label = text(body.label, 80) || `1 ${unit}`;
  const price = Number(body.price); const stock = Number(body.stock);
  const aliases = Array.isArray(body.aliases) ? body.aliases.map((item: unknown) => text(item, 80).toLowerCase()).filter(Boolean).slice(0, 20) : [];
  if (name.length < 2 || !categorySlug || !unit || !Number.isFinite(price) || price < 0 || !Number.isFinite(stock) || stock < 0) return NextResponse.json({ error: 'Data produk belum lengkap.' }, { status: 400 });

  const { data: category } = await auth.supabase.from('categories').select('id').eq('slug', categorySlug).eq('is_active', true).maybeSingle();
  if (!category) return NextResponse.json({ error: 'Kategori tidak valid.' }, { status: 400 });

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const [{ count: duplicateCount }, { count: recentCount }] = await Promise.all([
    auth.supabase.from('products').select('*', { count: 'exact', head: true }).eq('store_id', auth.store.id).ilike('name', name),
    auth.supabase.from('products').select('*', { count: 'exact', head: true }).eq('store_id', auth.store.id).gte('created_at', oneHourAgo),
  ]);
  const risk = evaluateProductRisk({ name, description, category: categorySlug, price, stock, duplicate: (duplicateCount ?? 0) > 0, uploadsLastHour: recentCount ?? 0 });
  const moderationStatus = risk.safe ? 'approved' : 'pending';
  const moderationNote = risk.safe ? 'Lolos validasi otomatis.' : `Menunggu review: ${risk.reasons.join('; ')}`;

  const { data: product, error: productError } = await auth.supabase.from('products').insert({ store_id: auth.store.id, category_id: category.id, name, description, emoji, moderation_status: moderationStatus, moderation_note: moderationNote, is_active: risk.safe }).select('id').single();
  if (productError || !product) return NextResponse.json({ error: productError?.message || 'Produk gagal dibuat.' }, { status: 500 });

  const sku = `MIT-${auth.store.id.slice(0, 5).toUpperCase()}-${product.id}`;
  const { error: variantError } = await auth.supabase.from('product_variants').insert({ product_id: product.id, label, unit, unit_amount: 1, price, stock, sku, is_default: true, is_active: true });
  if (variantError) { await auth.supabase.from('products').delete().eq('id', product.id); return NextResponse.json({ error: variantError.message }, { status: 500 }); }

  const aliasRows = [...new Set([name.toLowerCase(), ...aliases])].map((alias) => ({ product_id: product.id, alias }));
  if (aliasRows.length) await auth.supabase.from('product_aliases').insert(aliasRows);
  return NextResponse.json({ ok: true, productId: product.id, status: moderationStatus, autoPublished: risk.safe, riskScore: risk.score, reasons: risk.reasons });
}

export async function PATCH(request: NextRequest) {
  const auth = await ownedStore(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await request.json(); const productId = Number(body.productId);
  if (!Number.isInteger(productId)) return NextResponse.json({ error: 'Product ID tidak valid.' }, { status: 400 });
  const { data: product } = await auth.supabase.from('products').select('id,moderation_status').eq('id', productId).eq('store_id', auth.store.id).maybeSingle();
  if (!product) return NextResponse.json({ error: 'Produk bukan milik toko.' }, { status: 403 });

  const variantUpdate: Record<string, number | boolean> = {};
  if (Number.isFinite(Number(body.price)) && Number(body.price) >= 0) variantUpdate.price = Number(body.price);
  if (Number.isFinite(Number(body.stock)) && Number(body.stock) >= 0) variantUpdate.stock = Number(body.stock);
  if (typeof body.variantActive === 'boolean') variantUpdate.is_active = body.variantActive;
  if (Object.keys(variantUpdate).length) await auth.supabase.from('product_variants').update(variantUpdate).eq('product_id', productId).eq('is_default', true);
  if (typeof body.isActive === 'boolean') {
    const nextActive = product.moderation_status === 'approved' ? body.isActive : false;
    await auth.supabase.from('products').update({ is_active: nextActive }).eq('id', productId).eq('store_id', auth.store.id);
  }
  return NextResponse.json({ ok: true });
}
