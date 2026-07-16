'use client';

import { useEffect, useState } from 'react';
import { getBrowserSupabase } from '@/lib/supabase/client';

type Application = {
  id:string; applicant_id:string; identity_name:string; store_name?:string; whatsapp?:string; address_text?:string;
  business_type?:string; category_slugs?:string[]; status:string; review_note?:string; created_at:string;
};

export default function MitraApprovals(){
  const [items,setItems]=useState<Application[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [processing,setProcessing]=useState('');
  useEffect(()=>{void load()},[]);
  async function token(){const {data}=await getBrowserSupabase().auth.getSession();if(!data.session){window.location.href='/mitra/login?next=/admin/mitra';throw new Error('Login diperlukan');}return data.session.access_token;}
  async function load(){setLoading(true);setError('');try{const access=await token();const response=await fetch('/api/admin/mitra',{headers:{Authorization:`Bearer ${access}`}});const data=await response.json();if(!response.ok)throw new Error(data.error||'Gagal memuat');setItems(data.applications||[]);}catch(reason){setError(reason instanceof Error?reason.message:'Gagal memuat');}finally{setLoading(false)}}
  async function decide(item:Application,action:'approve'|'reject'){const note=action==='reject'?window.prompt('Alasan penolakan:','Data belum lengkap.')||'Data belum lengkap.':'';if(action==='approve'&&!window.confirm(`Setujui toko ${item.store_name}?`))return;setProcessing(item.id);setError('');try{const access=await token();const response=await fetch('/api/admin/mitra',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${access}`},body:JSON.stringify({applicationId:item.id,action,note})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Proses gagal');await load();}catch(reason){setError(reason instanceof Error?reason.message:'Proses gagal');}finally{setProcessing('')}}
  if(loading)return <div className="admin-loading">Memuat pendaftaran...</div>;
  return <main className="admin-page"><header><div><small>SIBANTU ADMIN</small><h1>Verifikasi Mitra</h1><p>Setujui pedagang sebelum toko dan produknya tampil.</p></div><button onClick={()=>void load()}>↻ Muat ulang</button></header>{error&&<div className="admin-error">{error}</div>}<div className="admin-tabs"><b>Semua ({items.length})</b><span>Pending ({items.filter(i=>i.status==='pending').length})</span><span>Aktif ({items.filter(i=>i.status==='active').length})</span></div><section className="application-list">{!items.length&&<div className="admin-empty">Belum ada pendaftaran.</div>}{items.map(item=><article key={item.id}><div className="application-main"><div className="store-avatar">🏪</div><div><small>{new Date(item.created_at).toLocaleString('id-ID')}</small><h2>{item.store_name||'Toko tanpa nama'}</h2><p>{item.identity_name} • {item.whatsapp}</p></div><mark className={`status-${item.status}`}>{item.status}</mark></div><dl><div><dt>Jenis usaha</dt><dd>{item.business_type||'-'}</dd></div><div><dt>Alamat</dt><dd>{item.address_text||'-'}</dd></div><div><dt>Kategori</dt><dd>{item.category_slugs?.join(', ')||'-'}</dd></div></dl>{item.review_note&&<div className="review-note">Catatan: {item.review_note}</div>}{item.status==='pending'&&<footer><button disabled={processing===item.id} onClick={()=>void decide(item,'reject')}>Tolak</button><button disabled={processing===item.id} onClick={()=>void decide(item,'approve')}>{processing===item.id?'Memproses...':'Setujui toko'}</button></footer>}</article>)}</section></main>
}
