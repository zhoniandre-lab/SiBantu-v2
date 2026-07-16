'use client';

import { FormEvent, useState } from 'react';
import { getBrowserSupabase } from '@/lib/supabase/client';

const CATEGORIES = [
  ['sayur', '🥬 Sayur'], ['ikan', '🐟 Ikan'], ['daging', '🍗 Daging'],
  ['sembako', '🍚 Sembako'], ['buah', '🍎 Buah'], ['bumbu', '🌶️ Bumbu'], ['rumah', '🧼 Kebutuhan rumah'],
];

type Draft = {
  fullName: string; phone: string; storeName: string; address: string; businessType: string; categories: string[];
};

export default function SellerRegistration() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [draft, setDraft] = useState<Draft>({ fullName: '', phone: '', storeName: '', address: '', businessType: '', categories: [] });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function toggleCategory(slug: string) {
    setDraft((current) => ({ ...current, categories: current.categories.includes(slug) ? current.categories.filter((item) => item !== slug) : [...current.categories, slug] }));
  }

  async function insertApplication(userId: string) {
    const supabase = getBrowserSupabase();
    const { error: insertError } = await supabase.from('seller_applications').insert({
      applicant_id: userId,
      identity_name: draft.fullName,
      business_type: draft.businessType || 'Pedagang pasar/warung',
      store_name: draft.storeName,
      whatsapp: draft.phone,
      address_text: draft.address,
      category_slugs: draft.categories,
    });
    if (insertError && !insertError.message.toLowerCase().includes('duplicate')) throw insertError;
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setMessage('');
    if (draft.fullName.length < 2 || draft.storeName.length < 2 || draft.phone.replace(/\D/g, '').length < 10 || draft.address.length < 8 || !draft.categories.length || password.length < 8) {
      setError('Lengkapi data, pilih minimal satu kategori, dan gunakan password minimal 8 karakter.'); return;
    }
    setLoading(true);
    try {
      const supabase = getBrowserSupabase();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(), password,
        options: { data: { full_name: draft.fullName, phone: draft.phone } },
      });
      if (signUpError) throw signUpError;
      if (!data.user) throw new Error('Akun belum berhasil dibuat.');

      if (data.session) {
        await insertApplication(data.user.id);
        window.location.href = '/mitra/dashboard';
      } else {
        localStorage.setItem('sibantu_seller_draft', JSON.stringify(draft));
        setMessage('Akun dibuat. Buka email verifikasi dari Supabase, lalu login untuk mengirim pendaftaran toko.');
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Pendaftaran gagal.');
    } finally { setLoading(false); }
  }

  return <form className="mitra-form" onSubmit={submit}>
    <div className="form-section"><span>1</span><div><h2>Data pemilik</h2><p>Digunakan untuk akun dan komunikasi.</p></div></div>
    <div className="fields two"><label>Nama lengkap<input value={draft.fullName} onChange={(e) => setDraft({ ...draft, fullName: e.target.value })} /></label><label>WhatsApp<input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} inputMode="tel" placeholder="08xxxxxxxxxx" /></label></div>
    <div className="fields two"><label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label><label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} /></label></div>

    <div className="form-section"><span>2</span><div><h2>Data toko</h2><p>Profil yang akan dilihat pelanggan setelah disetujui.</p></div></div>
    <div className="fields"><label>Nama toko<input value={draft.storeName} onChange={(e) => setDraft({ ...draft, storeName: e.target.value })} placeholder="Contoh: Sayur Segar Makmur" /></label><label>Jenis usaha<input value={draft.businessType} onChange={(e) => setDraft({ ...draft, businessType: e.target.value })} placeholder="Pedagang pasar, warung, petani..." /></label><label>Alamat toko<textarea value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} /></label></div>

    <div className="form-section"><span>3</span><div><h2>Kategori jualan</h2><p>Pilih minimal satu.</p></div></div>
    <div className="category-checks">{CATEGORIES.map(([slug, label]) => <button type="button" className={draft.categories.includes(slug) ? 'active' : ''} key={slug} onClick={() => toggleCategory(slug)}>{label}</button>)}</div>

    {error && <div className="form-alert error">{error}</div>}{message && <div className="form-alert success">{message}</div>}
    <button className="submit-mitra" disabled={loading}>{loading ? 'Membuat akun...' : 'Daftar sebagai Mitra SiBantu'}</button>
    <small className="legal">Dengan mendaftar, pedagang menyetujui proses verifikasi dan moderasi produk.</small>
  </form>;
}
