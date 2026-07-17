'use client';

import { useEffect, useMemo, useState } from 'react';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { rupiah } from '@/lib/format';

type Data={store:{name:string};period:string;summary:any;series:{date:string;sales:number;orders:number;views:number}[];sources:{source:string;count:number}[]};
const PERIODS=[['realtime','Hari ini'],['yesterday','Kemarin'],['week','7 hari'],['month','30 hari']];

export default function SellerPerformance(){const [period,setPeriod]=useState('week'),[data,setData]=useState<Data|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');useEffect(()=>{void load()},[period]);
 async function load(){setLoading(true);setError('');try{const {data:{session}}=await getBrowserSupabase().auth.getSession();if(!session){location.href='/mitra/login?next=/mitra/performa';return;}const response=await fetch(`/api/mitra/performance?period=${period}`,{headers:{Authorization:`Bearer ${session.access_token}`}});const result=await response.json();if(!response.ok)throw new Error(result.error||'Gagal memuat');setData(result);}catch(reason){setError(reason instanceof Error?reason.message:'Gagal memuat')}finally{setLoading(false)}}
 const maxSales=useMemo(()=>Math.max(1,...(data?.series||[]).map(x=>x.sales)),[data]);if(loading)return <div className="dashboard-loading">Memuat performa...</div>;if(error)return <div className="form-alert error">{error}</div>;if(!data)return null;const s=data.summary;
 return <main className="performance-page"><header><a href="/mitra/dashboard">←</a><div><small>PERFORMA TOKO</small><h1>{data.store.name}</h1></div></header><nav className="period-tabs">{PERIODS.map(([value,label])=><button className={period===value?'active':''} onClick={()=>setPeriod(value)} key={value}>{label}</button>)}</nav>
 <section className="task-summary"><article><b>{s.tasks?.pending||0}</b><span>Perlu dikonfirmasi</span></article><article><b>{s.tasks?.confirmed||0}</b><span>Perlu disiapkan</span></article><article><b>{s.cancellationCount||0}</b><span>Pembatalan</span></article><article><b>{s.needsReviewReply||0}</b><span>Ulasan perlu dibalas</span></article></section>
 <section className="performance-metrics"><article><small>PENJUALAN</small><b>{rupiah(s.grossSales)}</b></article><article><small>PESANAN</small><b>{s.orderCount}</b></article><article><small>RATA-RATA ORDER</small><b>{rupiah(s.averageOrder)}</b></article><article><small>PENGUNJUNG</small><b>{s.visitors}</b></article><article><small>DILIHAT</small><b>{s.views}</b></article><article><small>KONVERSI</small><b>{Number(s.conversionRate).toFixed(1)}%</b></article><article><small>MASUK KERANJANG</small><b>{s.addToCart}</b></article><article><small>RATING TOKO</small><b>⭐ {Number(s.averageRating).toFixed(1)}</b></article></section>
 <section className="performance-chart"><div><h2>Grafik penjualan</h2><span>{PERIODS.find(x=>x[0]===period)?.[1]}</span></div><div className="bars">{data.series.length?data.series.map(row=><article key={row.date}><div style={{height:`${Math.max(3,row.sales/maxSales*100)}%`}} title={rupiah(row.sales)}></div><small>{new Date(row.date).toLocaleDateString('id-ID',{day:'2-digit',month:'short'})}</small></article>):<p>Belum ada data pada periode ini.</p>}</div></section>
 <section className="traffic-sources"><h2>Sumber kunjungan</h2>{!data.sources.length&&<p>Belum ada event kunjungan.</p>}{data.sources.map(item=><div key={item.source}><b>{item.source}</b><span>{item.count} event</span></div>)}</section>
 </main>}
