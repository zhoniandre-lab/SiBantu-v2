'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORIES, PRODUCTS, findProduct } from '@/lib/catalog';
import { formatQty, makeId, rupiah } from '@/lib/format';
import type { CartItem, CategoryId, ChatMessage, ChatResponse, CommerceAction, Product } from '@/lib/types';

type ViewMode = 'chat' | 'store';

type CheckoutData = {
  name: string;
  whatsapp: string;
  address: string;
  landmark: string;
  latitude?: number;
  longitude?: number;
};

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'welcome',
    role: 'assistant',
    text: 'Halo! Saya SiBantu. Mau cari barang, menyusun belanja berdasarkan kebutuhan, atau melihat semua menu hari ini?',
    productIds: [10, 2, 30],
  },
];

function ProductCard({
  product,
  onAdd,
  compact = false,
  cartQty = 0,
}: {
  product: Product;
  onAdd: () => void;
  compact?: boolean;
  cartQty?: number;
}) {
  return (
    <article className={`product-card ${compact ? 'compact' : ''} ${cartQty > 0 ? 'in-cart' : ''}`}>
      <div className="product-visual" aria-hidden="true">
        <span>{product.emoji}</span>
        {product.badge && <small>{product.badge}</small>}
      </div>
      <div className="product-copy">
        <div className="stock-line">
          <span>{product.stock > 0 ? `Tersedia • ${product.stock}` : 'Stok habis'}</span>
          {cartQty > 0 && <b>{formatQty(cartQty)} {product.unit} di keranjang</b>}
        </div>
        <h3>{product.name}</h3>
        {!compact && <p>{product.description}</p>}
        <div className="product-bottom">
          <div>
            <strong>{rupiah(product.price)}</strong>
            <span>/ {product.unit}</span>
          </div>
          <button
            className={cartQty > 0 ? 'added' : ''}
            onClick={onAdd}
            disabled={product.stock <= 0}
            aria-label={`Tambah ${product.name}`}
          >
            {cartQty > 0 ? '✓' : '+'}
          </button>
        </div>
      </div>
    </article>
  );
}

export default function SiBantuApp() {
  const [view, setView] = useState<ViewMode>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState<CategoryId | 'semua'>('semua');
  const [query, setQuery] = useState('');
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [pickerQty, setPickerQty] = useState(1);
  const [locationStatus, setLocationStatus] = useState('Lokasi belum dipilih');
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const [checkout, setCheckout] = useState<CheckoutData>({ name: '', whatsapp: '', address: '', landmark: '' });
  const endRef = useRef<HTMLDivElement>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const existingSession = sessionStorage.getItem('sibantu_v2_session') || makeId('SES');
    sessionStorage.setItem('sibantu_v2_session', existingSession);
    setSessionId(existingSession);

    try {
      const saved = JSON.parse(sessionStorage.getItem(`sibantu_v2_cart_${existingSession}`) || '[]');
      if (Array.isArray(saved)) setCart(saved);
    } catch {
      setCart([]);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (sessionId) sessionStorage.setItem(`sibantu_v2_cart_${sessionId}`, JSON.stringify(cart));
  }, [cart, sessionId]);

  useEffect(() => {
    if (view === 'chat') endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, view]);

  const cartCount = cart.length;
  const subtotal = cart.reduce((sum, item) => sum + (findProduct(item.productId)?.price ?? 0) * item.qty, 0);

  const visibleProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return PRODUCTS.filter((product) => {
      const inCategory = category === 'semua' || product.category === category;
      const searchable = [product.name, ...product.aliases, product.description].join(' ').toLowerCase();
      return inCategory && (!normalized || searchable.includes(normalized));
    });
  }, [category, query]);

  function showCartToast(productName: string, qty: number, unit: string) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ id: Date.now(), text: `${formatQty(qty)} ${unit} ${productName} masuk ke keranjang` });
    toastTimerRef.current = setTimeout(() => setToast(null), 2600);
  }

  function openProductPicker(product: Product) {
    setSelectedProduct(product);
    setPickerQty(product.quickQuantities?.[0] ?? product.step ?? 1);
  }

  function confirmProductPicker() {
    if (!selectedProduct) return;
    addToCart(selectedProduct.id, pickerQty);
    setSelectedProduct(null);
  }

  function addToCart(productId: number, qty = 1) {
    const product = findProduct(productId);
    if (product) showCartToast(product.name, qty, product.unit);
    setCart((current) => {
      const existing = current.find((item) => item.productId === productId);
      if (existing) return current.map((item) => (item.productId === productId ? { ...item, qty: item.qty + qty } : item));
      return [...current, { productId, qty }];
    });
  }

  function setCartQty(productId: number, qty: number) {
    if (qty <= 0) setCart((current) => current.filter((item) => item.productId !== productId));
    else setCart((current) => current.map((item) => (item.productId === productId ? { ...item, qty } : item)));
  }

  function executeAction(action: CommerceAction) {
    switch (action.type) {
      case 'add':
        addToCart(action.productId, action.qty);
        break;
      case 'set':
        setCartQty(action.productId, action.qty);
        break;
      case 'remove':
        setCart((current) => current.filter((item) => item.productId !== action.productId));
        break;
      case 'open_store':
        setCategory(action.category ?? 'semua');
        setView('store');
        break;
      case 'show_cart':
        setCartOpen(true);
        break;
      case 'checkout':
        if (cart.length) setCheckoutOpen(true);
        else setView('store');
        break;
      default:
        break;
    }
  }

  async function sendMessage(event?: FormEvent) {
    event?.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const userMessage: ChatMessage = { id: makeId('msg'), role: 'user', text };
    const updatedHistory = [...messages, userMessage];
    setMessages(updatedHistory);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, cart, history: updatedHistory, sessionId }),
      });
      if (!response.ok) throw new Error('Chat tidak tersedia');
      const result = (await response.json()) as ChatResponse;
      setMessages((current) => [
        ...current,
        { id: makeId('msg'), role: 'assistant', text: result.reply, productIds: result.productIds },
      ]);
      executeAction(result.action);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: makeId('msg'),
          role: 'assistant',
          text: 'Koneksi sedang kurang stabil. Katalog dan keranjang tetap bisa digunakan—tekan Semua Menu untuk melanjutkan.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function askCategory(id: CategoryId) {
    setCategory(id);
    setView('store');
  }

  function continueShoppingInChat() {
    const selectedNames = cart
      .map((item) => {
        const product = findProduct(item.productId);
        return product ? `${product.name} ${formatQty(item.qty)} ${product.unit}` : null;
      })
      .filter(Boolean);

    const summary = selectedNames.length <= 3
      ? selectedNames.join(', ')
      : `${selectedNames.slice(0, 3).join(', ')}, dan ${selectedNames.length - 3} barang lainnya`;

    setMessages((current) => [
      ...current,
      {
        id: makeId('msg'),
        role: 'assistant',
        text: `Pilihan Kakak sudah masuk: ${summary}. Yuk lanjut ngobrol—mau tambah barang, ubah jumlah, atau saya bantu lanjut menghitung pesanan?`,
        productIds: cart.slice(0, 3).map((item) => item.productId),
      },
    ]);
    setView('chat');
  }

  function useLocation() {
    if (!navigator.geolocation) {
      setLocationStatus('GPS tidak tersedia di perangkat ini');
      return;
    }
    setLocationStatus('Mengambil lokasi...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCheckout((current) => ({
          ...current,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }));
        setLocationStatus('Lokasi GPS berhasil disimpan');
      },
      () => setLocationStatus('Lokasi gagal diambil. Izinkan akses GPS lalu coba lagi.'),
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setView('chat')}>
          <span className="brand-mark">S</span>
          <span><strong>SiBantu</strong><small>Pasar yang bisa diajak ngobrol</small></span>
        </button>
        <div className="top-actions">
          <button className="location-pill">📍 Jembatan Dua</button>
          <button className="cart-button" onClick={() => setCartOpen(true)}>🛒<b>{cartCount}</b></button>
        </div>
      </header>

      {view === 'chat' ? (
        <section className="chat-view">
          <div className="service-strip"><span>● Toko buka</span><span>Antar 30–60 menit</span><span>COD tersedia</span></div>
          <div className="chat-scroll">
            <div className="welcome-card">
              <div><small>ASISTEN BELANJA HARIAN</small><h1>Mau belanja apa hari ini?</h1><p>Ketik bebas seperti sedang berbicara dengan penjual pasar.</p></div>
              <div className="welcome-art">🧺</div>
            </div>

            <div className="category-row chat-categories">
              {CATEGORIES.filter((item) => item.id !== 'semua').slice(0, 6).map((item) => (
                <button key={item.id} onClick={() => askCategory(item.id as CategoryId)}>{item.emoji}<span>{item.label}</span></button>
              ))}
            </div>

            <div className="messages">
              {messages.map((message) => (
                <div key={message.id} className={`message-wrap ${message.role}`}>
                  {message.role === 'assistant' && <div className="assistant-avatar">S</div>}
                  <div className="message-stack">
                    <div className="message-bubble">{message.text}</div>
                    {message.productIds?.length ? (
                      <div className="inline-products">
                        {message.productIds.map(findProduct).filter(Boolean).map((product) => (
                          <ProductCard
                            key={product!.id}
                            product={product!}
                            compact
                            cartQty={cart.find((item) => item.productId === product!.id)?.qty ?? 0}
                            onAdd={() => openProductPicker(product!)}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
              {loading && <div className="message-wrap assistant"><div className="assistant-avatar">S</div><div className="thinking"><i/><i/><i/><span>SiBantu sedang mencari...</span></div></div>}
              <div ref={endRef} />
            </div>
          </div>

          <div className="chat-footer">
            <div className="footer-shortcuts">
              <button onClick={() => setView('store')}>▦ Semua Menu</button>
              <button onClick={() => setCartOpen(true)}>🛒 Keranjang {cartCount ? `(${cartCount})` : ''}</button>
              <button onClick={() => setInput('Carikan belanja sesuai budget saya')}>✨ Belanja Pintar</button>
            </div>
            <form className="composer" onSubmit={sendMessage}>
              <button type="button" className="icon-button" title="Input suara segera hadir">🎙️</button>
              <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Contoh: ada ikan nila?" maxLength={500} />
              <button type="submit" disabled={!input.trim() || loading}>➤</button>
            </form>
          </div>
        </section>
      ) : (
        <section className="store-view">
          <div className="store-hero">
            <button onClick={() => setView('chat')}>← Kembali ke chat</button>
            <div><small>TOKO SIBANTU</small><h1>Semua kebutuhan dalam satu tempat.</h1><p>Harga transparan, stok nyata, dan siap diantar.</p></div>
            <span>🛍️</span>
          </div>
          <div className="store-tools">
            <label className="search-box">⌕<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari ikan, sayur, beras..." /></label>
            <div className="category-row store-categories">
              {CATEGORIES.map((item) => <button className={category === item.id ? 'active' : ''} key={item.id} onClick={() => setCategory(item.id)}>{item.emoji} {item.label}</button>)}
            </div>
          </div>
          <div className="store-heading"><div><small>{category === 'semua' ? 'SEMUA PRODUK' : `KATEGORI ${category.toUpperCase()}`}</small><h2>{visibleProducts.length} barang tersedia</h2></div><button>Urutkan: Terlaris⌄</button></div>
          <div className="product-grid">
            {visibleProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                cartQty={cart.find((item) => item.productId === product.id)?.qty ?? 0}
                onAdd={() => openProductPicker(product)}
              />
            ))}
          </div>
          {cartCount > 0 && (
            <div className="store-action-dock">
              <button className="continue-chat" onClick={continueShoppingInChat}>
                <span>💬</span><b>Lanjut ngobrol</b><small>Biar SiBantu bantu siapkan</small>
              </button>
              <button className="floating-cart" onClick={() => setCartOpen(true)}>
                <span>🛒 {cartCount} barang</span><strong>{rupiah(subtotal)} →</strong>
              </button>
            </div>
          )}
        </section>
      )}

      {toast && (
        <div key={toast.id} className="cart-toast" role="status">
          <span>✓</span>
          <div><b>Berhasil ditambahkan</b><small>{toast.text}</small></div>
          <button onClick={() => { setToast(null); setCartOpen(true); }}>Lihat</button>
        </div>
      )}

      {selectedProduct && (
        <div className="overlay product-picker-overlay" onMouseDown={(event) => event.target === event.currentTarget && setSelectedProduct(null)}>
          <section className="product-picker">
            <button className="picker-close" onClick={() => setSelectedProduct(null)}>×</button>
            <div className="picker-visual">{selectedProduct.emoji}</div>
            <small>{selectedProduct.category.toUpperCase()}</small>
            <h2>{selectedProduct.name}</h2>
            <p>{selectedProduct.description}</p>
            <div className="picker-price"><strong>{rupiah(selectedProduct.price)}</strong><span>per {selectedProduct.unit}</span></div>
            <div className="picker-label"><b>Pilih jumlah</b><span>Bisa diubah lagi di keranjang</span></div>
            <div className="quick-quantities">
              {(selectedProduct.quickQuantities ?? [selectedProduct.step ?? 1]).map((qty) => (
                <button className={pickerQty === qty ? 'active' : ''} key={qty} onClick={() => setPickerQty(qty)}>
                  {formatQty(qty)} {selectedProduct.unit}
                </button>
              ))}
            </div>
            <div className="picker-stepper">
              <button onClick={() => setPickerQty((current) => Math.max(selectedProduct.step ?? 1, current - (selectedProduct.step ?? 1)))}>−</button>
              <div><strong>{formatQty(pickerQty)}</strong><span>{selectedProduct.unit}</span></div>
              <button onClick={() => setPickerQty((current) => current + (selectedProduct.step ?? 1))}>+</button>
            </div>
            <button className="picker-confirm" onClick={confirmProductPicker}>
              <span>Masukkan ke keranjang</span><strong>{rupiah(selectedProduct.price * pickerQty)}</strong>
            </button>
          </section>
        </div>
      )}

      {cartOpen && (
        <div className="overlay" onMouseDown={(event) => event.target === event.currentTarget && setCartOpen(false)}>
          <aside className="drawer">
            <div className="drawer-head"><div><small>KERANJANG SESI</small><h2>Belanjaan Kakak</h2></div><button onClick={() => setCartOpen(false)}>×</button></div>
            <div className="drawer-items">
              {!cart.length && <div className="empty-state"><span>🧺</span><h3>Keranjang masih kosong</h3><p>Buka semua menu atau bilang kebutuhan Kakak melalui chat.</p><button onClick={() => { setCartOpen(false); setView('store'); }}>Lihat semua menu</button></div>}
              {cart.map((item) => {
                const product = findProduct(item.productId);
                if (!product) return null;
                const step = product.step ?? 1;
                return <div className="cart-line" key={item.productId}><div className="cart-emoji">{product.emoji}</div><div className="cart-info"><h3>{product.name}</h3><span>{rupiah(product.price)} / {product.unit}</span><button onClick={() => setCartQty(product.id, 0)}>Hapus</button></div><div className="stepper"><button onClick={() => setCartQty(product.id, item.qty - step)}>−</button><b>{formatQty(item.qty)}<small>{product.unit}</small></b><button onClick={() => setCartQty(product.id, item.qty + step)}>+</button></div></div>;
              })}
            </div>
            {cart.length > 0 && <div className="drawer-total"><div><span>Subtotal</span><strong>{rupiah(subtotal)}</strong></div><small>Ongkir dihitung setelah memilih lokasi.</small><button onClick={() => { setCartOpen(false); setCheckoutOpen(true); }}>Lanjut pilih lokasi</button></div>}
          </aside>
        </div>
      )}

      {checkoutOpen && (
        <div className="overlay checkout-overlay">
          <section className="checkout-panel">
            <div className="drawer-head"><div><small>CHECKOUT</small><h2>Alamat pengantaran</h2></div><button onClick={() => setCheckoutOpen(false)}>×</button></div>
            <div className="checkout-progress"><span className="active">1</span><i/><span>2</span><i/><span>3</span></div>
            <div className="map-placeholder"><div className="map-roads"/><div className="map-pin">📍</div><div className="map-copy"><strong>Pin lokasi rumah</strong><span>{locationStatus}</span></div></div>
            <button className="gps-button" onClick={useLocation}>⌖ Gunakan lokasi saya sekarang</button>
            <div className="form-grid">
              <label>Nama penerima<input value={checkout.name} onChange={(event) => setCheckout({ ...checkout, name: event.target.value })} placeholder="Nama lengkap" /></label>
              <label>Nomor WhatsApp<input value={checkout.whatsapp} onChange={(event) => setCheckout({ ...checkout, whatsapp: event.target.value })} placeholder="08xxxxxxxxxx" inputMode="tel" /></label>
              <label className="full">Alamat lengkap<textarea value={checkout.address} onChange={(event) => setCheckout({ ...checkout, address: event.target.value })} placeholder="Desa, dusun, RT/RW, nomor rumah" /></label>
              <label className="full">Patokan rumah<input value={checkout.landmark} onChange={(event) => setCheckout({ ...checkout, landmark: event.target.value })} placeholder="Contoh: samping masjid" /></label>
            </div>
            <div className="checkout-summary"><span>{cartCount} barang</span><strong>{rupiah(subtotal)}</strong></div>
            <button className="continue-button" disabled={!checkout.name || !checkout.whatsapp || !checkout.address}>Lanjut hitung ongkir →</button>
            <small className="phase-note">Fondasi V2: penyimpanan pesanan dan peta interaktif disambungkan pada fase Supabase berikutnya.</small>
          </section>
        </div>
      )}
    </main>
  );
}
