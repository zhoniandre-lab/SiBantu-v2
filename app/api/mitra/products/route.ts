import { NextRequest, NextResponse } from 'next/server';
import { ownedStore } from '@/lib/supabase/auth-server';
import { evaluateProductRisk } from '@/lib/marketplace/product-risk';

function text(value: unknown, max = 200) { return String(value ?? '').trim().slice(0, max); }

export async function GET(request: NextRequest) {
  const auth = await ownedStore(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { data, error } = await auth.supabase
    .from('products')
    .select('id,name,description,emoji,image_url,moderation_status,moderation_note,is_active,created_at,categories(slug,name),product_variants(id,label,unit,price,stock,is_default,is_active),product_media(id,media_type,url,thumbnail_url,sort_order,moderation_status),product_aliases(alias)')
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
  const imageUrls = Array.isArray(body.imageUrls) ? body.imageUrls.map((item: unknown) => text(item, 1000)).filter(Boolean).slice(0, 8) : [];
  const legacyImageUrl = text(body.imageUrl, 1000);
  if (!imageUrls.length && legacyImageUrl) imageUrls.push(legacyImageUrl);
  const videoUrl = text(body.videoUrl, 1000);
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const allowedImagePrefix = `${baseUrl}/storage/v1/object/public/product-images/`;
  const allowedVideoPrefix = `${baseUrl}/storage/v1/object/public/product-videos/`;
  if (imageUrls.some((url: string) => !url.startsWith(allowedImagePrefix))) return NextResponse.json({ error: 'URL gambar tidak valid.' }, { status: 400 });
  if (videoUrl && !videoUrl.startsWith(allowedVideoPrefix)) return NextResponse.json({ error: 'URL video tidak valid.' }, { status: 400 });
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
  const risk = evaluateProductRisk({ name, description, category: categorySlug, price, stock, duplicate: (duplicateCount ?? 0) > 0, uploadsLastHour: recentCount ?? 0, imageCount: imageUrls.length });
  const moderationStatus = risk.safe ? 'approved' : 'pending';
  const moderationNote = risk.safe ? 'Lolos validasi otomatis.' : `Menunggu review: ${risk.reasons.join('; ')}`;

  const { data: product, error: productError } = await auth.supabase.from('products').insert({ store_id: auth.store.id, category_id: category.id, name, description, emoji, image_url: imageUrls[0] || null, moderation_status: moderationStatus, moderation_note: moderationNote, is_active: risk.safe }).select('id').single();
  if (productError || !product) return NextResponse.json({ error: productError?.message || 'Produk gagal dibuat.' }, { status: 500 });

  const sku = `MIT-${auth.store.id.slice(0, 5).toUpperCase()}-${product.id}`;
  const { error: variantError } = await auth.supabase.from('product_variants').insert({ product_id: product.id, label, unit, unit_amount: 1, price, stock, sku, is_default: true, is_active: true });
  if (variantError) { await auth.supabase.from('products').delete().eq('id', product.id); return NextResponse.json({ error: variantError.message }, { status: 500 }); }

  const mediaRows = [
    ...imageUrls.map((url: string, index: number) => ({ product_id: product.id, store_id: auth.store.id, media_type: 'image', url, sort_order: index, moderation_status: 'approved' })),
    ...(videoUrl ? [{ product_id: product.id, store_id: auth.store.id, media_type: 'video', url: videoUrl, sort_order: imageUrls.length, moderation_status: 'approved' }] : []),
  ];
  if (mediaRows.length) {
    const { error: mediaError } = await auth.supabase.from('product_media').insert(mediaRows);
    if (mediaError) { await auth.supabase.from('products').delete().eq('id', product.id); return NextResponse.json({ error: mediaError.message }, { status: 500 }); }
  }

  const aliasRows = [...new Set([name.toLowerCase(), ...aliases])].map((alias) => ({ product_id: product.id, alias }));
  if (aliasRows.length) await auth.supabase.from('product_aliases').insert(aliasRows);
  return NextResponse.json({ ok: true, productId: product.id, status: moderationStatus, autoPublished: risk.safe, riskScore: risk.score, reasons: risk.reasons, mediaCount: mediaRows.length, imageCount: imageUrls.length, videoSaved: Boolean(videoUrl) });
}

export async function PATCH(request: NextRequest) {
  const auth = await ownedStore(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await request.json();
  const productId = Number(body.productId);
  if (!Number.isInteger(productId)) return NextResponse.json({ error: 'Product ID tidak valid.' }, { status: 400 });

  const { data: current, error: currentError } = await auth.supabase
    .from('products')
    .select('id,name,description,emoji,category_id,image_url,moderation_status,is_active,product_media(id,media_type,url)')
    .eq('id', productId).eq('store_id', auth.store.id).maybeSingle();
  if (currentError) return NextResponse.json({ error: currentError.message }, { status: 500 });
  if (!current) return NextResponse.json({ error: 'Produk bukan milik toko.' }, { status: 403 });

  const metadataChanged = ['name','description','emoji','category'].some((key) => Object.prototype.hasOwnProperty.call(body, key));
  const mediaChanged = Array.isArray(body.imageUrls) || Object.prototype.hasOwnProperty.call(body, 'videoUrl');
  const nextName = Object.prototype.hasOwnProperty.call(body,'name') ? text(body.name,120) : current.name;
  const nextDescription = Object.prototype.hasOwnProperty.call(body,'description') ? text(body.description,500) : (current.description || '');
  const nextEmoji = Object.prototype.hasOwnProperty.call(body,'emoji') ? text(body.emoji,8) || '📦' : current.emoji;

  let categoryId = current.category_id;
  let categorySlug = text(body.category,40);
  if (Object.prototype.hasOwnProperty.call(body,'category')) {
    const { data: category } = await auth.supabase.from('categories').select('id,slug').eq('slug',categorySlug).eq('is_active',true).maybeSingle();
    if (!category) return NextResponse.json({ error:'Kategori tidak valid.' },{status:400});
    categoryId = category.id;
  } else {
    const { data: category } = await auth.supabase.from('categories').select('slug').eq('id',categoryId).maybeSingle();
    categorySlug = category?.slug || '';
  }

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const imagePrefix = `${baseUrl}/storage/v1/object/public/product-images/`;
  const videoPrefix = `${baseUrl}/storage/v1/object/public/product-videos/`;
  const imageUrls = Array.isArray(body.imageUrls) ? body.imageUrls.map((item:unknown)=>text(item,1000)).filter(Boolean).slice(0,8) : null;
  const videoUrl = Object.prototype.hasOwnProperty.call(body,'videoUrl') ? text(body.videoUrl,1000) : null;
  if (imageUrls?.some((url:string)=>!url.startsWith(imagePrefix))) return NextResponse.json({error:'URL gambar tidak valid.'},{status:400});
  if (videoUrl && !videoUrl.startsWith(videoPrefix)) return NextResponse.json({error:'URL video tidak valid.'},{status:400});

  let moderationStatus = current.moderation_status;
  let moderationNote: string | undefined;
  let nextActive = typeof body.isActive === 'boolean' ? body.isActive : current.is_active;
  if (metadataChanged || mediaChanged) {
    const existingImages = (current.product_media || []).filter((item:any)=>item.media_type==='image').length;
    const imageCount = imageUrls ? imageUrls.length : existingImages;
    const { count: duplicateCount } = await auth.supabase.from('products').select('*',{count:'exact',head:true}).eq('store_id',auth.store.id).ilike('name',nextName).neq('id',productId);
    const variant = await auth.supabase.from('product_variants').select('price,stock').eq('product_id',productId).eq('is_default',true).maybeSingle();
    const price = Number(body.price ?? variant.data?.price ?? 0);
    const stock = Number(body.stock ?? variant.data?.stock ?? 0);
    const risk = evaluateProductRisk({name:nextName,description:nextDescription,category:categorySlug,price,stock,duplicate:(duplicateCount??0)>0,uploadsLastHour:0,imageCount});
    moderationStatus = risk.safe ? 'approved' : 'pending';
    moderationNote = risk.safe ? 'Perubahan lolos validasi otomatis.' : `Menunggu review: ${risk.reasons.join('; ')}`;
    nextActive = risk.safe && nextActive;
  }

  const { error: updateError } = await auth.supabase.from('products').update({name:nextName,description:nextDescription,emoji:nextEmoji,category_id:categoryId,moderation_status:moderationStatus,moderation_note:moderationNote,is_active:moderationStatus==='approved'?nextActive:false,...(imageUrls?{image_url:imageUrls[0]||null}:{})}).eq('id',productId).eq('store_id',auth.store.id);
  if (updateError) return NextResponse.json({error:updateError.message},{status:500});

  const variantUpdate: Record<string, number | boolean | string> = {};
  if (Number.isFinite(Number(body.price)) && Number(body.price) >= 0) variantUpdate.price = Number(body.price);
  if (Number.isFinite(Number(body.stock)) && Number(body.stock) >= 0) variantUpdate.stock = Number(body.stock);
  if (Object.prototype.hasOwnProperty.call(body,'unit') && text(body.unit,40)) { variantUpdate.unit = text(body.unit,40); variantUpdate.label = `1 ${text(body.unit,40)}`; }
  if (typeof body.variantActive === 'boolean') variantUpdate.is_active = body.variantActive;
  if (Object.keys(variantUpdate).length) await auth.supabase.from('product_variants').update(variantUpdate).eq('product_id', productId).eq('is_default', true);

  if (mediaChanged) {
    await auth.supabase.from('product_media').delete().eq('product_id',productId).eq('store_id',auth.store.id);
    const rows = [
      ...(imageUrls||[]).map((url:string,index:number)=>({product_id:productId,store_id:auth.store.id,media_type:'image',url,sort_order:index,moderation_status:'approved'})),
      ...(videoUrl?[{product_id:productId,store_id:auth.store.id,media_type:'video',url:videoUrl,sort_order:(imageUrls||[]).length,moderation_status:'approved'}]:[]),
    ];
    if (rows.length) {
      const {error:mediaError}=await auth.supabase.from('product_media').insert(rows);
      if (mediaError) return NextResponse.json({error:mediaError.message},{status:500});
    }
  }

  if (Array.isArray(body.aliases)) {
    await auth.supabase.from('product_aliases').delete().eq('product_id',productId);
    const aliasRows=[...new Set([nextName.toLowerCase(),...body.aliases.map((item:unknown)=>text(item,80).toLowerCase()).filter(Boolean)])].map(alias=>({product_id:productId,alias}));
    if(aliasRows.length)await auth.supabase.from('product_aliases').insert(aliasRows);
  }

  const finalMedia = mediaChanged ? [...(imageUrls || []), ...(videoUrl ? [videoUrl] : [])] : (current.product_media || []).map((item:any)=>item.url);
  return NextResponse.json({ok:true,status:moderationStatus,autoPublished:moderationStatus==='approved',active:moderationStatus==='approved'&&nextActive,mediaCount:finalMedia.length,imageCount:mediaChanged?(imageUrls||[]).length:(current.product_media||[]).filter((item:any)=>item.media_type==='image').length,videoSaved:mediaChanged?Boolean(videoUrl):(current.product_media||[]).some((item:any)=>item.media_type==='video')});
}
