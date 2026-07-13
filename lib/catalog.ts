import type { CategoryId, Product } from './types';

export const CATEGORIES: { id: CategoryId | 'semua'; label: string; emoji: string }[] = [
  { id: 'semua', label: 'Semua', emoji: '✨' },
  { id: 'sayur', label: 'Sayur', emoji: '🥬' },
  { id: 'ikan', label: 'Ikan', emoji: '🐟' },
  { id: 'daging', label: 'Daging', emoji: '🍗' },
  { id: 'sembako', label: 'Sembako', emoji: '🍚' },
  { id: 'buah', label: 'Buah', emoji: '🍎' },
  { id: 'bumbu', label: 'Bumbu', emoji: '🌶️' },
  { id: 'rumah', label: 'Rumah', emoji: '🧼' },
];

// Data awal untuk demo V2. Nantinya seluruh nilai ini dipindahkan ke Supabase
// agar admin dapat mengubah harga, satuan, foto, dan stok tanpa menyentuh kode.
export const PRODUCTS: Product[] = [
  { id: 1, name: 'Kacang Panjang', category: 'sayur', price: 5000, unit: '250 gram', emoji: '🥬', aliases: ['kacang', 'kacang panjang'], stock: 24, description: 'Segar untuk tumisan dan sayur.', badge: 'Segar' },
  { id: 2, name: 'Bayam Hijau', category: 'sayur', price: 4000, unit: '1 ikat', emoji: '🌿', aliases: ['bayam'], stock: 18, description: 'Dipetik segar setiap pagi.' },
  { id: 3, name: 'Terong Ungu', category: 'sayur', price: 6000, unit: '250 gram', emoji: '🍆', aliases: ['terong'], stock: 15, description: 'Cocok untuk balado dan lalapan.' },
  { id: 4, name: 'Kangkung', category: 'sayur', price: 4000, unit: '1 ikat', emoji: '🥬', aliases: ['kangkung'], stock: 20, description: 'Segar untuk tumis kangkung.' },
  { id: 5, name: 'Wortel', category: 'sayur', price: 7000, unit: '250 gram', emoji: '🥕', aliases: ['wortel'], stock: 17, description: 'Manis dan renyah.' },
  { id: 6, name: 'Kentang', category: 'sayur', price: 9000, unit: '500 gram', emoji: '🥔', aliases: ['kentang'], stock: 22, description: 'Pilihan serbaguna untuk lauk.' },

  { id: 10, name: 'Ikan Nila', category: 'ikan', price: 25000, unit: '1 kg', emoji: '🐟', aliases: ['nila', 'ikan nila'], stock: 12, description: 'Bisa dibersihkan sebelum dikirim.', badge: 'Terlaris' },
  { id: 11, name: 'Ikan Lele', category: 'ikan', price: 18000, unit: '1 kg', emoji: '🐟', aliases: ['lele', 'ikan lele'], stock: 16, description: 'Segar, cocok digoreng atau dibakar.' },
  { id: 12, name: 'Ikan Tongkol', category: 'ikan', price: 44000, unit: '1 kg', emoji: '🐠', aliases: ['tongkol', 'ikan tongkol'], stock: 9, description: 'Daging padat untuk gulai dan sambal.' },
  { id: 13, name: 'Ikan Bandeng', category: 'ikan', price: 28000, unit: '1 kg', emoji: '🐟', aliases: ['bandeng', 'ikan bandeng'], stock: 8, description: 'Segar untuk presto atau bakar.' },

  { id: 20, name: 'Ayam Potong', category: 'daging', price: 45000, unit: '1 kg', emoji: '🍗', aliases: ['ayam', 'ayam potong'], stock: 14, description: 'Dapat dipotong sesuai permintaan.', badge: 'Favorit' },
  { id: 21, name: 'Daging Sapi', category: 'daging', price: 120000, unit: '500 gram', emoji: '🥩', aliases: ['daging', 'sapi', 'daging sapi'], stock: 7, description: 'Untuk rendang, sop, dan semur.' },
  { id: 22, name: 'Telur Ayam', category: 'daging', price: 28000, unit: '1 kg', emoji: '🥚', aliases: ['telur', 'telur ayam'], stock: 30, description: 'Telur segar pilihan.' },

  { id: 30, name: 'Beras Premium', category: 'sembako', price: 75000, unit: '5 kg', emoji: '🍚', aliases: ['beras', 'nasi'], stock: 25, description: 'Pulen dan bersih.' },
  { id: 31, name: 'Minyak Goreng', category: 'sembako', price: 17000, unit: '1 liter', emoji: '🫗', aliases: ['minyak', 'minyak goreng', 'minyak gireng'], stock: 28, description: 'Minyak goreng kemasan.' },
  { id: 32, name: 'Gula Pasir', category: 'sembako', price: 16000, unit: '1 kg', emoji: '🧂', aliases: ['gula', 'gula pasir'], stock: 19, description: 'Butiran putih bersih.' },
  { id: 33, name: 'Tepung Terigu', category: 'sembako', price: 13000, unit: '1 kg', emoji: '🌾', aliases: ['tepung', 'terigu'], stock: 18, description: 'Untuk gorengan dan kue.' },
  { id: 34, name: 'Mie Instan', category: 'sembako', price: 3500, unit: '1 bungkus', emoji: '🍜', aliases: ['mie', 'mi instan', 'mie instan'], stock: 60, description: 'Pilihan praktis untuk di rumah.' },

  { id: 40, name: 'Pisang', category: 'buah', price: 15000, unit: '1 sisir', emoji: '🍌', aliases: ['pisang'], stock: 13, description: 'Matang alami dan manis.' },
  { id: 41, name: 'Jeruk', category: 'buah', price: 18000, unit: '500 gram', emoji: '🍊', aliases: ['jeruk'], stock: 16, description: 'Segar dan manis-asam.' },
  { id: 42, name: 'Apel', category: 'buah', price: 20000, unit: '500 gram', emoji: '🍎', aliases: ['apel'], stock: 11, description: 'Renyah untuk camilan keluarga.' },
  { id: 43, name: 'Pepaya', category: 'buah', price: 14000, unit: '1 buah', emoji: '🍈', aliases: ['pepaya'], stock: 10, description: 'Matang dan manis.' },

  { id: 50, name: 'Cabai Merah', category: 'bumbu', price: 12000, unit: '100 gram', emoji: '🌶️', aliases: ['cabai', 'cabe', 'cabai merah'], stock: 20, description: 'Pedas segar untuk sambal.' },
  { id: 51, name: 'Bawang Merah', category: 'bumbu', price: 10000, unit: '250 gram', emoji: '🧅', aliases: ['bawang merah'], stock: 24, description: 'Bumbu wajib dapur.' },
  { id: 52, name: 'Bawang Putih', category: 'bumbu', price: 9000, unit: '250 gram', emoji: '🧄', aliases: ['bawang putih'], stock: 21, description: 'Harum dan bersih.' },
  { id: 53, name: 'Santan Instan', category: 'bumbu', price: 6000, unit: '1 bungkus', emoji: '🥥', aliases: ['santan'], stock: 27, description: 'Praktis untuk gulai dan kolak.' },
  { id: 54, name: 'Kecap Manis', category: 'bumbu', price: 12000, unit: '1 botol', emoji: '🍶', aliases: ['kecap'], stock: 19, description: 'Pelengkap masakan keluarga.' },

  { id: 60, name: 'Sabun Cuci Piring', category: 'rumah', price: 11000, unit: '1 pouch', emoji: '🧼', aliases: ['sabun cuci', 'sabun piring'], stock: 17, description: 'Membersihkan lemak membandel.' },
  { id: 61, name: 'Deterjen', category: 'rumah', price: 18000, unit: '800 gram', emoji: '🫧', aliases: ['deterjen', 'sabun baju'], stock: 14, description: 'Wangi dan bersih.' },
  { id: 62, name: 'Tisu', category: 'rumah', price: 10000, unit: '1 pak', emoji: '🧻', aliases: ['tisu', 'tisue'], stock: 23, description: 'Lembut untuk kebutuhan rumah.' },
];

export const findProduct = (id: number) => PRODUCTS.find((product) => product.id === id);
