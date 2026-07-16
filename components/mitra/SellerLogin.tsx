'use client';

import { FormEvent, useState } from 'react';
import { getBrowserSupabase } from '@/lib/supabase/client';

export default function SellerLogin() {
  const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [loading,setLoading]=useState(false); const [error,setError]=useState('');
  async function submit(event:FormEvent){event.preventDefault();setLoading(true);setError('');try{
    const supabase=getBrowserSupabase();const {data,error:authError}=await supabase.auth.signInWithPassword({email:email.trim(),password});if(authError)throw authError;
    const draftRaw=localStorage.getItem('sibantu_seller_draft');
    if(draftRaw&&data.user){const draft=JSON.parse(draftRaw);const {error:insertError}=await supabase.from('seller_applications').insert({applicant_id:data.user.id,identity_name:draft.fullName,business_type:draft.businessType||'Pedagang pasar/warung',store_name:draft.storeName,whatsapp:draft.phone,address_text:draft.address,category_slugs:draft.categories});if(!insertError||insertError.code==='23505')localStorage.removeItem('sibantu_seller_draft');}
    window.location.href='/mitra/dashboard';
  }catch(reason){setError(reason instanceof Error?reason.message:'Login gagal.');}finally{setLoading(false)}}
  return <form className="login-card" onSubmit={submit}><div className="login-icon">🏪</div><h1>Masuk Mitra</h1><p>Kelola toko dan pesanan SiBantu.</p><label>Email<input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required/></label><label>Password<input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} required/></label>{error&&<div className="form-alert error">{error}</div>}<button disabled={loading}>{loading?'Memeriksa...':'Masuk ke Dashboard'}</button><a href="/mitra/daftar">Belum punya toko? Daftar Mitra</a></form>;
}
