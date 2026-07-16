# SiBantu V2 — Product & Engineering Roadmap

**Terakhir diperbarui:** 16 Juli 2026  
**Status proyek:** Aktif — Marketplace foundation + seller onboarding  
**Production:** https://sibantu-v2-app.vercel.app  
**Repository:** https://github.com/zhoniandre-lab/SiBantu-v2  
**Last verified production commit:** `a4a18ec` — Mitra Phase 2, Vercel Success

---

## 1. North Star

> **Pasar lokal yang bisa diajak ngobrol, lalu belanjaannya diantar ke rumah.**

SiBantu bukan marketplace biasa. Tiga nilai utama:

1. **Conversational commerce** — pelanggan dapat berbicara/mengetik seperti belanja di pasar.
2. **Marketplace lokal multi-penjual** — pedagang ikan, sayur, buah, sembako, dan warung dapat membuka toko.
3. **Hyperlocal delivery** — order dari beberapa pedagang dikoordinasikan dan diantar ke lokasi pelanggan.

Dokumen prinsip produk: `SIBANTU_PRODUCT_NORTH_STAR.md`.

---

## 2. Aturan Eksekusi Proyek

Aturan ini tidak boleh dilewati:

1. Satu fase harus memiliki **Definition of Done**.
2. Jangan mulai fase baru sebelum gate fase aktif lulus.
3. Error tidak boleh mengubah visi produk; hanya implementasinya yang diperbaiki.
4. Tidak ada patch percakapan tanpa regression test.
5. AI tidak boleh mengarang harga, stok, produk, promo, ongkir, atau total.
6. Harga dan total transaksi selalu dihitung Commerce Core/database.
7. Setiap perubahan harus lulus:
   - tests;
   - TypeScript;
   - production build;
   - endpoint check;
   - smoke test mobile.
8. Upload file harus selesai seluruhnya sebelum menilai deployment.
9. Commit merah di tengah upload boleh diabaikan; commit terakhir harus hijau.
10. Secret tidak boleh dikirim ke chat atau GitHub.

---

## 3. Keputusan Bisnis yang Sudah Dikunci

| Item | Keputusan |
|---|---|
| Nama | SiBantu |
| Konsep | Pasar yang bisa diajak ngobrol |
| Lokasi asal | Pasar Inpres, Desa Kepala Pasar, Kecamatan Kaur Selatan |
| Area awal | Kaur Selatan dan sekitarnya |
| WhatsApp admin | 085273139959 |
| Pembayaran awal | COD / bayar saat diterima |
| Ongkir awal | Flat Rp5.000 |
| GPS | Browser geolocation + link Google Maps |
| Produk awal | 30 produk demo, 7 kategori |
| Satuan | Hybrid: kg, ikat, liter, bungkus, botol, kemasan |
| Beras | Kemasan 5 kg; permintaan 1 kg diarahkan ke admin |
| Multi-penjual | Ya, satu checkout dapat dipecah ke beberapa toko |
| Moderasi | Hybrid: toko disetujui admin sekali; produk normal auto-publish setelah validasi; produk berisiko/terlapor masuk review admin |
| AI | Core deterministik + AI tools + human handoff |

---

## 4. Status Fase

Legenda:

- ✅ Selesai dan aktif
- 🟡 Sedang dikerjakan / sebagian aktif
- ⏳ Belum dimulai
- 🔒 Gate sebelum lanjut

### Fase 0 — Product Definition ✅

- [x] North Star
- [x] Value proposition
- [x] Marketplace multi-penjual
- [x] Conversational commerce
- [x] Human handoff
- [x] Delivery lokal

**DoD:** visi dan aturan produk terdokumentasi.

---

### Fase 1 — Storefront Foundation ✅

- [x] Next.js + TypeScript
- [x] Mobile-first UI
- [x] Chat-first homepage
- [x] Semua Menu ala marketplace
- [x] Search dan kategori
- [x] Product cards
- [x] Pilihan satuan/jumlah
- [x] Keranjang per session
- [x] Session isolation
- [x] Product picker
- [x] Toast masuk keranjang
- [x] Lanjut ngobrol dari katalog
- [x] Permintaan potong/bersihkan
- [x] Tanya pedagang via WhatsApp

**DoD:** pelanggan dapat memilih produk dan mengelola keranjang tanpa database/AI.

---

### Fase 2 — Chat Engine V0.3 🟡

#### Sudah selesai

- [x] Engine V0.3 terpisah dari legacy
- [x] Normalisasi Bahasa Indonesia
- [x] Alias kategori
- [x] Typo umum
- [x] Product matcher dengan boundary aman
- [x] `bayam` tidak dibaca `ayam`
- [x] Multi-produk
- [x] Context jumlah
- [x] Budget slot memory
- [x] Recipe slot memory
- [x] Confirmation state
- [x] State token HMAC
- [x] AI Tool Adapter
- [x] Human handoff
- [x] Privacy telemetry
- [x] Shadow lab
- [x] Legacy vs V0.3 comparison
- [x] Canary endpoint
- [x] Owner opt-in
- [x] Canary 5%
- [x] Automatic fallback ke legacy
- [x] 199 local regression tests terakhir

#### Belum selesai

- [ ] Deploy seluruh perbaikan confirmation terbaru bila belum ada di production
- [ ] Kumpulkan canary metrics
- [ ] Perbaiki semua benchmark gagal
- [ ] Naikkan canary 5% → 25%
- [ ] Naikkan canary 25% → 50%
- [ ] Default V0.3 100%
- [ ] Hapus legacy hanya setelah stabil

**Gate:** tidak naik canary jika error/fallback rate belum diketahui.

**DoD:** 100% sesi memakai V0.3, transaksi tidak regresi, context retention teruji.

---

### Fase 3 — Checkout, GPS & Order ✅

- [x] Checkout 3 langkah
- [x] Data penerima
- [x] Alamat tujuan
- [x] Patokan
- [x] Browser GPS
- [x] Google Maps link
- [x] Review produk
- [x] Subtotal
- [x] Flat ongkir Rp5.000
- [x] Total
- [x] COD
- [x] WhatsApp message lengkap
- [x] Nomor order
- [x] Checkout validation feedback
- [x] WhatsApp fallback jika database gagal

**Belum:**

- [ ] Ongkir berdasarkan jarak/zona
- [ ] Map pin interaktif
- [ ] Jadwal pengantaran
- [ ] Payment QRIS

---

### Fase 4 — Supabase Database ✅

- [x] Project Supabase `sibantu-v2`
- [x] Region aktif/healthy
- [x] `schema.sql`
- [x] `seed.sql`
- [x] `order-function.sql`
- [x] `auth-functions.sql`
- [x] Project URL di Vercel
- [x] Publishable key di Vercel
- [x] Secret/service key di Vercel
- [x] Database health endpoint
- [x] Categories = 7
- [x] Atomic order RPC
- [x] Order API
- [x] Test order berhasil
- [x] Parent order
- [x] Store sub-order
- [x] Order items snapshot
- [x] Komisi/seller net
- [x] Order status history

**DoD:** checkout dapat tersimpan atomik dan fallback ke WhatsApp.

---

### Fase 5 — SiBantu Mitra Phase 1 ✅

- [x] Seller signup
- [x] Email verification
- [x] Seller login
- [x] Seller application
- [x] Pilih kategori jualan
- [x] Status pending
- [x] Admin email allowlist
- [x] Admin approval API
- [x] Admin approval page
- [x] Store creation
- [x] Seller role
- [x] Store owner membership
- [x] Toko pertama disetujui

**DoD:** pedagang dapat mendaftar dan admin dapat mengaktifkan toko.

---

### Fase 6 — SiBantu Mitra Phase 2 🔒 AKTIF SEKARANG

#### Sudah dikembangkan lokal

- [x] Seller auth server helper
- [x] Product API
- [x] Store order API
- [x] Product creation form
- [x] Product list
- [x] Harga/stok
- [x] Moderation status
- [x] Order list
- [x] Update order status
- [x] Seller revenue summary
- [x] Local tests/typecheck/build lulus

#### Production status

- [x] Upload 5 file Phase 2
- [x] Vercel deployment Ready
- [x] Product API terlindungi (401 tanpa login)
- [x] Order API terlindungi (401 tanpa login)
- [x] Dashboard Mitra aktif (HTTP 200)
- [ ] Test create product
- [ ] Terapkan auto-publish untuk produk normal dari toko aktif
- [ ] Terapkan validation/risk flags
- [ ] Buat admin moderation hanya untuk produk flagged/reported
- [ ] Produk seller tampil di marketplace
- [ ] Test store order nyata
- [ ] Test status order
- [ ] Test seller net

**NEXT ACTION:** upload `copy-sibantu-mitra-phase2.html` sampai seluruh file selesai.

**DoD:** seller dapat mengelola produk dan order miliknya, admin dapat memoderasi produk.

---

### Fase 7 — Admin Operations ⏳

- [ ] Dashboard semua order
- [ ] Moderasi produk seller
- [ ] Moderasi perubahan harga
- [ ] Store suspension
- [ ] Refund/cancellation workflow
- [ ] Komisi platform
- [ ] Payout seller
- [ ] Analytics
- [ ] Export order

---

### Fase 8 — Delivery & Courier ⏳

- [ ] Courier role/login
- [ ] Assignment
- [ ] Pickup multi-store
- [ ] Route order
- [ ] Delivery status
- [ ] Proof of delivery
- [ ] Live location opsional
- [ ] Ongkir jarak

---

### Fase 9 — Customer Account ⏳

- [ ] Customer login opsional
- [ ] Guest-to-account migration
- [ ] Saved addresses
- [ ] Order history
- [ ] Repeat order
- [ ] Favorites
- [ ] Subscription weekly basket
- [ ] Notifications

---

### Fase 10 — Advanced Differentiators ⏳

- [ ] Voice order final
- [ ] Foto daftar belanja/OCR
- [ ] Recipe-to-cart
- [ ] Budget optimizer
- [ ] Substitution engine
- [ ] Personal recommendation
- [ ] Bahasa lokal
- [ ] Seller live chat
- [ ] Promotion engine

---

## 5. Current Production Status

| Sistem | Status |
|---|---|
| Main storefront | ✅ Online |
| Database health | ✅ Connected, 7 categories |
| Order API | ✅ Saved order test |
| WhatsApp fallback | ✅ |
| GPS checkout | ✅ |
| Chat legacy | ✅ fallback |
| Chat V0.3 | 🟡 Canary 5% |
| Seller signup/login | ✅ |
| Admin seller approval | ✅ |
| First seller/store | ✅ Active |
| Seller product/order API | ✅ Production, auth protected |
| Seller Phase 2 functional test | 🟡 Belum diuji dengan akun seller |

---

## 6. Environment Variable Checklist

Nilai tidak dicatat dalam roadmap.

### AI

- [x] `AI_API_KEY`
- [x] `AI_ENDPOINT`
- [x] `AI_MODEL`
- [x] `AI_FALLBACK_MODEL`

### Chat V0.3

- [x] `CHAT_STATE_SECRET`
- [x] `CHAT_LAB_KEY`
- [x] `CHAT_V03_CANARY_PERCENT=5`

### Supabase

- [x] `NEXT_PUBLIC_SUPABASE_URL`
- [x] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [x] `SUPABASE_SERVICE_ROLE_KEY`

### Admin

- [x] `SIBANTU_ADMIN_EMAILS`

---

## 7. Database Assets

SQL yang sudah dijalankan:

- [x] `supabase/schema.sql`
- [x] `supabase/seed.sql`
- [x] `supabase/order-function.sql`
- [x] `supabase/auth-functions.sql`

Tabel penting:

- profiles
- guest_sessions
- stores
- seller_applications
- store_members
- categories
- products
- product_variants
- product_aliases
- carts/cart_items
- conversations/messages
- addresses
- delivery_zones
- orders
- store_orders
- order_items
- order_status_history
- seller_payouts
- store_reviews
- promotions

---

## 8. Release Checklist

Sebelum setiap deployment:

- [ ] Semua file release sudah masuk
- [ ] Tidak ada file missing/import error
- [ ] Test suite lulus
- [ ] TypeScript lulus
- [ ] Next build lulus
- [ ] Environment Variables tersedia
- [ ] SQL migration dijalankan bila ada
- [ ] Deployment commit terakhir Ready
- [ ] Endpoint check
- [ ] Mobile smoke test
- [ ] Tidak ada secret di GitHub/screenshot

Setelah deployment:

- [ ] Cek GitHub status
- [ ] Cek Vercel status
- [ ] Cek endpoint baru
- [ ] Cek RLS/authorization
- [ ] Uji happy path
- [ ] Uji error/fallback
- [ ] Update roadmap

---

## 9. Recovery Protocol — Jika Ada Error/Rusak

Jangan menghapus repository atau project.

Urutan pemulihan:

1. Catat URL, commit, endpoint, dan screenshot error.
2. Hentikan perubahan baru.
3. Periksa commit terakhir yang masih hijau di GitHub/Vercel.
4. Gunakan **Vercel Rollback** ke deployment terakhir yang Ready bila produksi rusak.
5. Perbaikan dilakukan pada file/fase aktif saja.
6. Jalankan test, typecheck, dan build sebelum deploy ulang.
7. Untuk perubahan SQL:
   - jangan menjalankan query destructive tanpa backup;
   - gunakan migration baru, jangan mengedit data produksi manual sembarangan;
   - ekspor data penting sebelum perubahan besar.
8. Setelah pulih, update Issue Log dan roadmap.

Sumber pemulihan:

- GitHub commit history — source code
- Vercel deployments — rollback aplikasi
- Supabase schema/SQL files — struktur database
- Supabase data export — backup data
- Roadmap — posisi fase terakhir

Aturan penting:

> Error pada satu fitur tidak berarti proyek dimulai ulang. Rollback ke gate terakhir yang lulus, perbaiki, lalu lanjut.

---

## 10. Issue Log Ringkas

| Masalah | Pelajaran/Keputusan |
|---|---|
| Node 18 deprecated | Node 22 |
| AI provider intermittent | Model fallback + deterministic core |
| Prompt leak | Prompt server-side + output validation |
| Chat tidak ingat konteks | State token + slot memory |
| sayur/sayuran | Normalizer + regression benchmark |
| bayam dibaca ayam | Boundary matcher |
| multi-produk gagal | Batch actions |
| pesan+total | Multi-intent: add lalu show cart |
| action kosong crash | Client normalize action none |
| alamat pendek tombol diam | Validation feedback |
| beras 1kg vs kemasan | Package rule + human handoff |
| deployment campuran | Selesaikan seluruh release, nilai commit terakhir |
| seller registration missing | File checklist |

---

## 11. Next Three Milestones

### Milestone A — Mitra Phase 2 Production

1. ~~Upload 5 file Phase 2.~~ ✅
2. ~~Test dashboard dan API protection.~~ ✅
3. Tambah satu produk seller. **NEXT**
4. Pastikan status pending.

### Milestone B — Product Moderation

1. Admin list pending products.
2. Approve/reject.
3. Approved product appears in marketplace.
4. Seller can update price/stock under policy.

### Milestone C — Real Multi-Store Order

1. Customer buys platform + seller product.
2. One parent order.
3. Two store_orders.
4. Each seller sees only own order.
5. Admin sees whole order.
6. Status and payout calculated.

---

## 12. Definition of Project Success

SiBantu dinilai berhasil ketika:

- pelanggan dapat menyelesaikan order tanpa kebingungan;
- percakapan terasa seperti belanja di pasar;
- harga/stok/total tidak pernah dikarang AI;
- pedagang dapat mendaftar dan mengelola produk sendiri;
- satu order dapat melibatkan beberapa toko;
- order dan keranjang tidak tercampur antar pengguna;
- lokasi dan pengantaran dapat ditindaklanjuti;
- admin dapat mengelola marketplace;
- sistem tetap dapat dipakai saat AI gagal.

---

## 13. Pengingat

> **Jangan kejar fitur baru sebelum gate fase aktif selesai.**

Fase aktif saat ini:

```text
SiBantu Mitra Phase 2 — upload dan test production
```

File release:

```text
copy-sibantu-mitra-phase2.html
```
