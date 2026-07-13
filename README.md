# SiBantu V2

**Pasar yang bisa diajak ngobrol.**

Fondasi baru SiBantu menggunakan Next.js, TypeScript, commerce core yang deterministik, katalog visual, keranjang per sesi, serta checkout lokasi awal.

## Yang sudah berfungsi

- Chat-first mobile UI.
- Semua Menu ala marketplace.
- Pencarian dan filter kategori.
- 30 produk demo dalam 7 kategori.
- Keranjang terpisah per sesi browser.
- Tanya harga dan ketersediaan.
- Tambah, ubah, dan hapus melalui commerce core.
- Guard: keranjang kosong tidak dihitung.
- Checkout data pelanggan.
- Pengambilan koordinat GPS browser.
- Skema Supabase untuk multi-pengguna, produk, percakapan, alamat, dan pesanan.

## Status fase

Ini adalah **Fase 1: fondasi toko dan commerce core**. Data masih memakai katalog demo lokal. Tombol checkout belum menyimpan pesanan ke database.

Fase selanjutnya:

1. Membuat proyek Supabase.
2. Menjalankan `supabase/schema.sql`.
3. Memindahkan katalog demo ke database.
4. Menambahkan dashboard admin.
5. Menambahkan AI tool-calling di atas commerce core.
6. Menambahkan peta interaktif dan zona ongkir.

## Menjalankan lokal

```bash
npm install
npm run dev
```

Buka `http://localhost:3000`.

## Build produksi

```bash
npm run typecheck
npm run build
```

## Deploy Vercel

Proyek ini sebaiknya memakai repository baru, misalnya `SiBantu-v2`, agar aplikasi lama tetap online sampai V2 siap.

1. Upload seluruh isi folder ini ke repository baru.
2. Import repository ke Vercel.
3. Framework akan terdeteksi sebagai Next.js.
4. Deploy tanpa Environment Variables untuk demo Fase 1.

## Catatan data produk

Harga, satuan, dan stok di `lib/catalog.ts` adalah data demo. Pada fase database, admin dapat mengubah semuanya tanpa mengedit GitHub.
