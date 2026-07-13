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
  { id: 1, name: 'Kacang Panjang', category: 'sayur', price: 5000, unit: 'ikat', emoji: '🥬', step: 1, quickQuantities: [1, 2, 3], aliases: ['kacang', 'kacang panjang'], stock: 24, description: 'Segar untuk tumisan dan sayur.', badge: 'Segar' },
  { id: 2, name: 'Bayam Hijau', category: 'sayur', price: 4000, unit: 'ikat', emoji: '🌿', step: 1, quickQuantities: [1, 2, 3], aliases: ['bayam'], stock: 18, description: 'Dipetik segar setiap pagi.' },
  { id: 3, name: 'Terong Ungu', category: 'sayur', price: 24000, unit: 'kg', emoji: '🍆', step: 0.5, quickQuantities: [0.5, 1, 2], aliases: ['terong'], stock: 15, description: 'Cocok untuk balado dan lalapan.' },
  { id: 4, name: 'Kangkung', category: 'sayur', price: 4000, unit: 'ikat', emoji: '🥬', step: 1, quickQuantities: [1, 2, 3], aliases: ['kangkung'], stock: 20, description: 'Segar untuk tumis kangkung.' },
  { id: 5, name: 'Wortel', category: 'sayur', price: 28000, unit: 'kg', emoji: '🥕', step: 0.5, quickQuantities: [0.5, 1, 2], aliases: ['wortel'], stock: 17, description: 'Manis dan renyah.' },
  { id: 6, name: 'Kentang', category: 'sayur', price: 18000, unit: 'kg', emoji: '🥔', step: 0.5, quickQuantities: [0.5, 1, 2], aliases: ['kentang'], stock: 22, description: 'Pilihan serbaguna untuk lauk.' },

  { id: 10, name: 'Ikan Nila', category: 'ikan', price: 25000, unit: 'kg', emoji: '🐟', step: 0.5, quickQuantities: [0.5, 1, 2], aliases: ['nila', 'ikan nila'], stock: 12, description: 'Bisa dibersihkan sebelum dikirim.', badge: 'Terlaris' },
  { id: 11, name: 'Ikan Lele', category: 'ikan', price: 18000, unit: 'kg', emoji: '🐟', step: 0.5, quickQuantities: [0.5, 1, 2], aliases: ['lele', 'ikan lele'], stock: 16, description: 'Segar, cocok digoreng atau dibakar.' },
  { id: 12, name: 'Ikan Tongkol', category: 'ikan', price: 44000, unit: 'kg', emoji: '🐠', step: 0.5, quickQuantities: [0.5, 1, 2], aliases: ['tongkol', 'ikan tongkol'], stock: 9, description: 'Daging padat untuk gulai dan sambal.' },
  { id: 13, name: 'Ikan Bandeng', category: 'ikan', price: 28000, unit: 'kg', emoji: '🐟', step: 0.5, quickQuantities: [0.5, 1, 2], aliases: ['bandeng', 'ikan bandeng'], stock: 8, description: 'Segar untuk presto atau bakar.' },

  { id: 20, name: 'Ayam Potong', category: 'daging', price: 45000, unit: 'kg', emoji: '🍗', step: 0.5, quickQuantities: [0.5, 1, 2], aliases: ['ayam', 'ayam potong'], stock: 14, description: 'Dapat dipotong sesuai permintaan.', badge: 'Favorit' },
  { id: 21, name: 'Daging Sapi', category: 'daging', price: 120000, unit: 'kg', emoji: '🥩', step: 0.5, quickQuantities: [0.5, 1, 2], aliases: ['daging', 'sapi', 'daging sapi'], stock: 7, description: 'Untuk rendang, sop, dan semur.' },
  { id: 22, name: 'Telur Ayam', category: 'daging', price: 28000, unit: 'kg', emoji: '🥚', step: 0.5, quickQuantities: [0.5, 1, 2], aliases: ['telur', 'telur ayam'], stock: 30, description: 'Telur segar pilihan.' },

  { id: 30, name: 'Beras Premium', category: 'sembako', price: 75000, unit: 'kemasan 5 kg', emoji: '🍚', step: 1, quickQuantities: [1, 2], aliases: ['beras', 'nasi'], stock: 25, description: 'Pulen dan bersih.' },
  { id: 31, name: 'Minyak Goreng', category: 'sembako', price: 17000, unit: 'liter', emoji: '🫗', step: 1, quickQuantities: [1, 2, 3], aliases: ['minyak', 'minyak goreng', 'minyak gireng'], stock: 28, description: 'Minyak goreng kemasan.' },
  { id: 32, name: 'Gula Pasir', category: 'sembako', price: 16000, unit: 'kg', emoji: '🧂', step: 1, quickQuantities: [1, 2, 3], aliases: ['gula', 'gula pasir'], stock: 19, description: 'Butiran putih bersih.' },
  { id: 33, name: 'Tepung Terigu', category: 'sembako', price: 13000, unit: 'kg', emoji: '🌾', step: 1, quickQuantities: [1, 2, 3], aliases: ['tepung', 'terigu'], stock: 18, description: 'Untuk gorengan dan kue.' },
  { id: 34, name: 'Mie Instan', category: 'sembako', price: 3500, unit: 'bungkus', emoji: '🍜', step: 1, quickQuantities: [1, 5, 10], aliases: ['mie', 'mi instan', 'mie instan'], stock: 60, description: 'Pilihan praktis untuk di rumah.' },

  { id: 40, name: 'Pisang', category: 'buah', price: 15000, unit: 'sisir', emoji: '🍌', step: 1, quickQuantities: [1, 2], aliases: ['pisang'], stock: 13, description: 'Matang alami dan manis.' },
  { id: 41, name: 'Jeruk', category: 'buah', price: 36000, unit: 'kg', emoji: '🍊', step: 0.5, quickQuantities: [0.5, 1, 2], aliases: ['jeruk'], stock: 16, description: 'Segar dan manis-asam.' },
  { id: 42, name: 'Apel', category: 'buah', price: 40000, unit: 'kg', emoji: '🍎', step: 0.5, quickQuantities: [0.5, 1, 2], aliases: ['apel'], stock: 11, description: 'Renyah untuk camilan keluarga.' },
  { id: 43, name: 'Pepaya', category: 'buah', price: 14000, unit: 'buah', emoji: '🍈', step: 1, quickQuantities: [1, 2], aliases: ['pepaya'], stock: 10, description: 'Matang dan manis.' },

  { id: 50, name: 'Cabai Merah', category: 'bumbu', price: 120000, unit: 'kg', emoji: '🌶️', step: 0.1, quickQuantities: [0.1, 0.25, 0.5], aliases: ['cabai', 'cabe', 'cabai merah'], stock: 20, description: 'Pedas segar untuk sambal.' },
  { id: 51, name: 'Bawang Merah', category: 'bumbu', price: 40000, unit: 'kg', emoji: '🧅', step: 0.25, quickQuantities: [0.25, 0.5, 1], aliases: ['bawang merah'], stock: 24, description: 'Bumbu wajib dapur.' },
  { id: 52, name: 'Bawang Putih', category: 'bumbu', price: 36000, unit: 'kg', emoji: '🧄', step: 0.25, quickQuantities: [0.25, 0.5, 1], aliases: ['bawang putih'], stock: 21, description: 'Harum dan bersih.' },
  { id: 53, name: 'Santan Instan', category: 'bumbu', price: 6000, unit: 'bungkus', emoji: '🥥', step: 1, quickQuantities: [1, 2, 3], aliases: ['santan'], stock: 27, description: 'Praktis untuk gulai dan kolak.' },
  { id: 54, name: 'Kecap Manis', category: 'bumbu', price: 12000, unit: 'botol', emoji: '🍶', step: 1, quickQuantities: [1, 2], aliases: ['kecap'], stock: 19, description: 'Pelengkap masakan keluarga.' },

  { id: 60, name: 'Sabun Cuci Piring', category: 'rumah', price: 11000, unit: 'pouch', emoji: '🧼', step: 1, quickQuantities: [1, 2], aliases: ['sabun cuci', 'sabun piring'], stock: 17, description: 'Membersihkan lemak membandel.' },
  { id: 61, name: 'Deterjen', category: 'rumah', price: 18000, unit: '800 gram', emoji: '🫧', aliases: ['deterjen', 'sabun baju'], stock: 14, description: 'Wangi dan bersih.' },
  { id: 62, name: 'Tisu', category: 'rumah', price: 10000, unit: 'pak', emoji: '🧻', step: 1, quickQuantities: [1, 2, 3], aliases: ['tisu', 'tisue'], stock: 23, description: 'Lembut untuk kebutuhan rumah.' },
];

export const findProduct = (id: number) => PRODUCTS.find((product) => product.id === id);
