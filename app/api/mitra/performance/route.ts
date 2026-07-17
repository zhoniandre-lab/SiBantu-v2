import { NextRequest, NextResponse } from 'next/server';
import { ownedStore } from '@/lib/supabase/auth-server';

const DAYS: Record<string, number> = { realtime: 1, yesterday: 2, week: 7, month: 30 };

export async function GET(request: NextRequest) {
  const auth = await ownedStore(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const period = request.nextUrl.searchParams.get('period') || 'week';
  const days = DAYS[period] ?? 7;
  const start = new Date(); start.setHours(0,0,0,0); start.setDate(start.getDate() - (period === 'yesterday' ? 1 : days - 1));
  const startDate = start.toISOString().slice(0,10);

  const [salesRes, trafficRes, reviewsRes, productsRes, tasksRes, sourcesRes] = await Promise.all([
    auth.supabase.from('seller_performance_daily').select('*').eq('store_id', auth.store.id).gte('metric_date', startDate).order('metric_date'),
    auth.supabase.from('seller_traffic_daily').select('*').eq('store_id', auth.store.id).gte('metric_date', startDate).order('metric_date'),
    auth.supabase.from('seller_review_tasks').select('*').eq('store_id', auth.store.id).maybeSingle(),
    auth.supabase.from('products').select('id,moderation_status,is_active',{count:'exact'}).eq('store_id',auth.store.id),
    auth.supabase.from('store_orders').select('status').eq('store_id',auth.store.id),
    auth.supabase.from('product_events').select('source,event_type').eq('store_id',auth.store.id).gte('created_at',start.toISOString()).limit(5000),
  ]);
  const sales = salesRes.data ?? []; const traffic = trafficRes.data ?? [];
  const sum = (rows:any[],key:string) => rows.reduce((total,row)=>total+Number(row[key]||0),0);
  const orderCount=sum(sales,'order_count'), grossSales=sum(sales,'gross_sales'), completedCount=sum(sales,'completed_count');
  const views=sum(traffic,'views'), clicks=sum(traffic,'clicks'), addToCart=sum(traffic,'add_to_cart'), purchases=sum(traffic,'purchases'), visitors=sum(traffic,'unique_visitors');
  const dateKeys=[...new Set([...sales.map((r:any)=>r.metric_date),...traffic.map((r:any)=>r.metric_date)])].sort();
  const series=dateKeys.map(date=>({date,sales:Number(sales.find((r:any)=>r.metric_date===date)?.gross_sales||0),orders:Number(sales.find((r:any)=>r.metric_date===date)?.order_count||0),views:Number(traffic.find((r:any)=>r.metric_date===date)?.views||0)}));
  const tasks=(tasksRes.data??[]).reduce((acc:Record<string,number>,row:any)=>{acc[row.status]=(acc[row.status]||0)+1;return acc},{});
  const sourceMap=(sourcesRes.data??[]).reduce((acc:Record<string,number>,row:any)=>{acc[row.source||'unknown']=(acc[row.source||'unknown']||0)+1;return acc},{});
  const sources=Object.entries(sourceMap).map(([source,count])=>({source,count})).sort((a,b)=>b.count-a.count);

  return NextResponse.json({ok:true,store:auth.store,period,summary:{grossSales,orderCount,averageOrder:orderCount?grossSales/orderCount:0,completedCount,visitors,views,clicks,addToCart,purchases,conversionRate:visitors?purchases/visitors*100:0,clickRate:views?clicks/views*100:0,cancellationCount:sum(sales,'cancellation_count'),productCount:productsRes.count??0,approvedProducts:(productsRes.data??[]).filter((p:any)=>p.moderation_status==='approved').length,needsReviewReply:Number(reviewsRes.data?.needs_reply||0),averageRating:Number(reviewsRes.data?.average_rating||0),tasks},series,sources});
}
