'use client';

import { useEffect, useState } from 'react';
import { getBrowserSupabase } from '@/lib/supabase/client';

type Application={id:string;status:string;store_name?:string;business_type?:string;review_note?:string};
type Store={id:string;name:string;status:string;address_text:string};

export default function SellerDashboard(){const [loading,setLoading]=useState(true);const [application,setApplication]=useState<Application|null>(null);const [store,setStore]=useState<Store|null>(null);const [name,setName]=useState('Mitra');
 useEffect(()=>{void load()},[]);
 async function load(){try{const supabase=getBrowserSupabase();const {data:{session}}=await supabase.auth.getSession();if(!session){window.location.href='/mitra/login';return;}setName(session.user.user_metadata?.full_name||session.user.email||'Mitra');
 const [{data:apps},{data:stores}]=await Promise.all([supabase.from('seller_applications').select('id,status,store_name,business_type,review_note').eq('applicant_id',session.user.id).order('created_at',{ascending:false}).limit(1),supabase.from('stores').select('id,name,status,address_text').eq('owner_id',session.user.id).limit(1)]);setApplication(apps?.[0]||null);setStore(stores?.[0]||null);}finally{setLoading(false)}}
 async function logout(){await getBrowserSupabase().auth.signOut();window.location.href='/mitra/login'}
 if(loading)return <div className="dashboard-loading">Memuat dashboard...</div>;
 return <div className="seller-dashboard"><header><div><small>SIBANTU MITRA</small><h1>Halo, {name}</h1></div><button onClick={logout}>Keluar</button></header>
 {!application&&!store&&<section className="empty-dashboard"><span>📝</span><h2>Belum ada pendaftaran toko</h2><p>Daftarkan toko untuk mulai menjual di SiBantu.</p><a href="/mitra/daftar">Daftar toko</a></section>}
 {application&&!store&&<section className="application-status"><span>⏳</span><div><small>STATUS PENDAFTARAN</small><h2>{application.status==='pending'?'Menunggu verifikasi':application.status}</h2><p>Toko: <b>{application.store_name}</b>. Admin akan memeriksa data sebelum produk dapat dijual.</p>{application.review_note&&<em>Catatan admin: {application.review_note}</em>}</div></section>}
 {store&&<><section className="store-summary"><div><small>TOKO AKTIF</small><h2>{store.name}</h2><p>{store.address_text}</p></div><span>{store.status}</span></section><div className="dashboard-grid"><article><span>📦</span><b>Produk</b><p>Tambah dan atur produk toko.</p><button disabled>Segera hadir</button></article><article><span>🧾</span><b>Pesanan</b><p>Lihat sub-order milik toko.</p><button disabled>Segera hadir</button></article><article><span>💰</span><b>Pendapatan</b><p>Pantau komisi dan pencairan.</p><button disabled>Segera hadir</button></article></div></>}
 </div>}
