'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORIES, PRODUCTS, findProduct } from '@/lib/catalog';
import { formatQty, makeId, rupiah } from '@/lib/format';
import MobileBottomNav from '@/components/navigation/MobileBottomNav';
import { requestChatWithCanary } from '@/lib/chat-v03/client';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { adminWhatsAppUrl, STORE_CONFIG } from '@/lib/store-config';
import type { CartItem, CategoryId, ChatMessage, CommerceAction, Product } from '@/lib/types';

type ViewMode = 'chat' | 'store';
type GuideMode = 'start' | 'budget' | 'recipe' | 'list';
type FoodPreference = 'ikan' | 'ayam' | 'sayur';

type CheckoutData = {
  name: string;
  whatsapp: string;
  address: string;
  landmark: string;
  latitude?: number;
  longitude?: number;
};

type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  }
}

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
    <article className={`product-card ${compact ? 'compact' : ''} ${cartQty > 0 ? 'in-cart' : ''}`} role="button" tabIndex={0} onClick={onAdd} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onAdd(); }}>
      <div className="product-visual" aria-hidden="true">
        {product.imageUrl ? <img src={product.imageUrl} alt="" loading="lazy" /> : <span>{product.emoji}</span>}
        {product.badge && <small>{product.badge}</small>}
      </div>
      <div className="product-copy">
        <div className="stock-line">
          <span>{product.storeIsAcceptingOrders === false ? 'Toko tutup' : product.stock > 0 ? `Tersedia • ${product.stock}` : 'Stok habis'}</span>
          {cartQty > 0 && <b>{formatQty(cartQty)} {product.unit} di keranjang</b>}
        </div>
        <h3>{product.name}</h3>
        {product.storeName && <div className="seller-name">🏪 {product.storeName}</div>}
        <div className="card-reputation"><span>⭐ {product.averageRating?.toFixed(1)||'0.0'}</span><span>{formatQty(product.soldCount||0)} terjual</span></div>
        {!compact && <p>{product.description}</p>}
        <div className="product-bottom">
          <div>
            <strong>{rupiah(product.price)}</strong>
            <span>/ {product.unit}</span>
          </div>
          <button
            className={cartQty > 0 ? 'added' : ''}
            onClick={(event) => { event.stopPropagation(); onAdd(); }}
            disabled={product.stock <= 0 || product.storeIsAcceptingOrders === false}
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
  const [catalogProducts, setCatalogProducts] = useState<Product[]>(PRODUCTS);
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [category, setCategory] = useState<CategoryId | 'semua'>('semua');
  const [query, setQuery] = useState('');
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<1 | 2 | 3>(1);
  const [orderNumber, setOrderNumber] = useState('');
  const [orderSaving, setOrderSaving] = useState(false);
  const [orderSaved, setOrderSaved] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productReviews, setProductReviews] = useState<{id:string;rating:number;comment?:string;sellerReply?:string;buyerName:string;createdAt:string;verified:boolean}[]>([]);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const [pickerQty, setPickerQty] = useState(1);
  const [pickerNote, setPickerNote] = useState('');
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideMode, setGuideMode] = useState<GuideMode>('start');
  const [guideBudget, setGuideBudget] = useState(50000);
  const [guidePeople, setGuidePeople] = useState(3);
  const [guidePreference, setGuidePreference] = useState<FoodPreference>('ikan');
  const [guideList, setGuideList] = useState('');
  const [locationStatus, setLocationStatus] = useState('Lokasi belum dipilih');
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const [checkout, setCheckout] = useState<CheckoutData>({ name: '', whatsapp: '', address: '', landmark: '' });
  const [checkoutErrors, setCheckoutErrors] = useState<Partial<Record<'name' | 'whatsapp' | 'address', string>>>({});
  const endRef = useRef<HTMLDivElement>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechRecognitionRef = useRef<BrowserSpeechRecognition | null>(null);

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
    if (new URLSearchParams(window.location.search).get('view') === 'store') setView('store');
  }, []);

  useEffect(() => {
    fetch('/api/catalog')
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (data?.products?.length) setCatalogProducts(data.products); })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const productId = Number(new URLSearchParams(window.location.search).get('product'));
    if (Number.isInteger(productId)) {
      const product = catalogProducts.find((item) => item.id === productId);
      if (product && selectedProduct?.id !== productId) openProductPicker(product);
    }
  }, [catalogProducts]);

  useEffect(() => {
    if (!selectedProduct) { setProductReviews([]); return; }
    fetch(`/api/reviews?productId=${selectedProduct.id}`)
      .then((response) => response.ok ? response.json() : null)
      .then((data) => setProductReviews(data?.reviews || []))
      .catch(() => setProductReviews([]));
  }, [selectedProduct?.id]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      speechRecognitionRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (sessionId) sessionStorage.setItem(`sibantu_v2_cart_${sessionId}`, JSON.stringify(cart));
  }, [cart, sessionId]);

  useEffect(() => {
    if (view === 'chat') endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, view]);

  function productById(id: number) {
    return catalogProducts.find((product) => product.id === id) ?? findProduct(id);
  }

  function trackProductEvent(eventType: string, productId: number, source?: string) {
    if (!sessionId) return;
    const eventSource = source ?? (view === 'store' ? 'store' : 'chat');
    void fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventType, productId, sessionId, source: eventSource }), keepalive: true }).catch(() => undefined);
  }

  const cartCount = cart.length;
  const subtotal = cart.reduce((sum, item) => sum + (productById(item.productId)?.price ?? 0) * item.qty, 0);
  const deliveryFee = cart.length ? STORE_CONFIG.deliveryFee : 0;
  const grandTotal = subtotal + deliveryFee;
  const checkoutValid = checkout.name.trim().length >= 2
    && checkout.whatsapp.replace(/\D/g, '').length >= 10
    && checkout.address.trim().length >= 8;
  const selectedMedia = selectedProduct?.media?.[selectedMediaIndex];

  const visibleProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return catalogProducts.filter((product) => {
      const inCategory = category === 'semua' || product.category === category;
      const searchable = [product.name, ...product.aliases, product.description].join(' ').toLowerCase();
      return inCategory && (!normalized || searchable.includes(normalized));
    });
  }, [category, query, catalogProducts]);

  useEffect(() => {
    if (!sessionId || query.trim().length < 2) return;
    const timer = setTimeout(() => {
      void fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventType: 'search', query, category, resultCount: visibleProducts.length, sessionId }), keepalive: true }).catch(() => undefined);
    }, 700);
    return () => clearTimeout(timer);
  }, [query, category, visibleProducts.length, sessionId]);

  function showCartToast(productName: string, qty: number, unit: string) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ id: Date.now(), text: `${formatQty(qty)} ${unit} ${productName} masuk ke keranjang` });
    toastTimerRef.current = setTimeout(() => setToast(null), 2600);
  }

  function openProductPicker(product: Product) {
    trackProductEvent('view', product.id);
    setSelectedProduct(product);
    setSelectedMediaIndex(0);
    setPickerQty(product.quickQuantities?.[0] ?? product.step ?? 1);
    setPickerNote('');
  }

  function confirmProductPicker() {
    if (!selectedProduct) return;
    addToCart(selectedProduct.id, pickerQty, pickerNote || undefined);
    setSelectedProduct(null);
  }

  function addToCart(productId: number, qty = 1, note?: string) {
    const product = productById(productId);
    if (product) { showCartToast(product.name, qty, product.unit); trackProductEvent('add_cart', productId); }
    setCart((current) => {
      const existing = current.find((item) => item.productId === productId);
      if (existing) return current.map((item) => (item.productId === productId ? { ...item, qty: item.qty + qty, note: note ?? item.note } : item));
      return [...current, { productId, qty, note }];
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
        if (cart.length) openCheckout();
        else setView('store');
        break;
      default:
        break;
    }
  }

  function startVoiceInput() {
    if (listening) {
      speechRecognitionRef.current?.stop();
      return;
    }

    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      setMessages((current) => [
        ...current,
        {
          id: makeId('msg'),
          role: 'assistant',
          text: 'Input suara belum didukung browser ini. Gunakan Chrome Android terbaru dan izinkan akses mikrofon.',
        },
      ]);
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    speechRecognitionRef.current = recognition;
    recognition.lang = 'id-ID';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => {
      setListening(false);
      speechRecognitionRef.current = null;
    };
    recognition.onerror = (event) => {
      setListening(false);
      const denied = event.error === 'not-allowed' || event.error === 'service-not-allowed';
      setMessages((current) => [
        ...current,
        {
          id: makeId('msg'),
          role: 'assistant',
          text: denied
            ? 'Akses mikrofon belum diizinkan. Tekan ikon gembok pada browser, izinkan Mikrofon, lalu coba lagi.'
            : 'Suara belum terbaca. Coba bicara lebih dekat dan ulangi sekali lagi.',
        },
      ]);
    };
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (transcript) setInput(transcript);
    };
    recognition.start();
  }

  async function submitText(rawText: string) {
    const text = rawText.trim();
    if (!text || loading) return;

    const userMessage: ChatMessage = { id: makeId('msg'), role: 'user', text };
    const updatedHistory = [...messages, userMessage];
    setMessages(updatedHistory);
    setInput('');
    setLoading(true);

    try {
      const result = await requestChatWithCanary({
        message: text,
        cart,
        history: updatedHistory,
        sessionId,
      });
      setMessages((current) => [
        ...current,
        { id: makeId('msg'), role: 'assistant', text: result.reply, productIds: result.productIds, cta: result.cta, suggestions: result.suggestions },
      ]);
      if (result.actions?.length) result.actions.forEach(executeAction);
      else if (result.action) executeAction(result.action);
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

  async function sendMessage(event?: FormEvent) {
    event?.preventDefault();
    await submitText(input);
  }

  function askCategory(id: CategoryId) {
    setCategory(id);
    setView('store');
  }

  function continueShoppingInChat() {
    const selectedNames = cart
      .map((item) => {
        const product = productById(item.productId);
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

  function openGuide(mode: GuideMode = 'start') {
    setGuideMode(mode);
    setGuideOpen(true);
  }

  function submitGuide() {
    let text = '';
    if (guideMode === 'budget') {
      text = `Budget saya ${guideBudget / 1000} ribu untuk ${guidePeople} orang, pilihkan menu ${guidePreference}`;
    } else if (guideMode === 'recipe') {
      text = `Pilihkan resep menu ${guidePreference} untuk ${guidePeople} orang dari bahan yang tersedia`;
    } else if (guideMode === 'list') {
      text = guideList.trim();
    }
    if (!text) return;
    setGuideOpen(false);
    setView('chat');
    void submitText(text);
  }

  function openCheckout() {
    if (!cart.length) return;
    setOrderNumber(`SIB-${Date.now().toString(36).toUpperCase()}`);
    setOrderSaving(false);
    setOrderSaved(false);
    setCheckoutStep(1);
    setCheckoutErrors({});
    setCartOpen(false);
    cart.forEach((item) => trackProductEvent('checkout', item.productId, 'checkout'));
    setCheckoutOpen(true);
  }

  function goToCheckoutReview() {
    const errors: Partial<Record<'name' | 'whatsapp' | 'address', string>> = {};
    if (checkout.name.trim().length < 2) errors.name = 'Nama penerima minimal 2 karakter.';
    if (checkout.whatsapp.replace(/\D/g, '').length < 10) errors.whatsapp = 'Nomor WhatsApp minimal 10 angka.';
    if (checkout.address.trim().length < 8) errors.address = 'Tulis alamat lebih lengkap, misalnya desa/dusun dan nomor rumah.';
    setCheckoutErrors(errors);
    if (Object.keys(errors).length === 0) setCheckoutStep(2);
  }

  function clearCheckoutError(field: 'name' | 'whatsapp' | 'address') {
    setCheckoutErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function sendOrderToAdmin() {
    if (!checkoutValid || !cart.length || orderSaving) return;
    setOrderSaving(true);
    let finalOrderNumber = orderNumber;
    let saved = false;

    try {
      const { data: authData } = await getBrowserSupabase().auth.getSession();
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(authData.session?.access_token ? { Authorization: `Bearer ${authData.session.access_token}` } : {}) },
        body: JSON.stringify({
          customer: checkout,
          items: cart.map((item) => ({ productId: item.productId, quantity: item.qty, note: item.note })),
        }),
      });
      const data = await response.json().catch(() => null) as { saved?: boolean; order?: { order_number?: string } } | null;
      if (response.ok && data?.saved) {
        saved = true;
        finalOrderNumber = data.order?.order_number || finalOrderNumber;
        setOrderNumber(finalOrderNumber);
      }
    } catch {
      // Database opsional pada fase ini. WhatsApp tetap menjadi fallback transaksi.
    }

    const itemLines = cart.map((item, index) => {
      const product = productById(item.productId);
      if (!product) return null;
      const lineTotal = product.price * item.qty;
      return `${index + 1}. ${product.name} — ${formatQty(item.qty)} ${product.unit} — ${rupiah(lineTotal)}${item.note ? `\n   Catatan: ${item.note}` : ''}`;
    }).filter(Boolean).join('\n');
    const mapsLink = checkout.latitude != null && checkout.longitude != null
      ? `https://maps.google.com/?q=${checkout.latitude},${checkout.longitude}`
      : 'GPS belum dibagikan';
    const databaseStatus = saved ? 'Tersimpan di sistem' : 'Belum tersimpan di database — konfirmasi via WhatsApp';
    const message = `*ORDER SIBANTU ${finalOrderNumber}*\nStatus: ${databaseStatus}\n\n*Asal:* ${STORE_CONFIG.pickupAddress}\n*Penerima:* ${checkout.name}\n*WhatsApp:* ${checkout.whatsapp}\n*Alamat tujuan:* ${checkout.address}\n*Patokan:* ${checkout.landmark || '-'}\n*Lokasi GPS:* ${mapsLink}\n\n*BELANJAAN*\n${itemLines}\n\nSubtotal: ${rupiah(subtotal)}\nOngkir: ${rupiah(deliveryFee)}\n*TOTAL: ${rupiah(grandTotal)}*\nPembayaran: ${STORE_CONFIG.paymentMethod}\n\nMohon konfirmasi ketersediaan dan waktu pengantaran.`;
    if (saved) cart.forEach((item) => trackProductEvent('purchase', item.productId, 'checkout'));
    setOrderSaved(saved);
    setOrderSaving(false);
    window.open(adminWhatsAppUrl(message), '_blank', 'noopener,noreferrer');
    setCheckoutStep(3);
  }

  function startNewOrder() {
    setCart([]);
    setCheckoutOpen(false);
    setCheckoutStep(1);
    setCheckout({ name: '', whatsapp: '', address: '', landmark: '' });
    setCheckoutErrors({});
    setLocationStatus('Lokasi belum dipilih');
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
          <button className="location-pill" title={STORE_CONFIG.pickupAddress}>📍 {STORE_CONFIG.pickupName}</button>
          <a className="account-button" href="/akun/dashboard" aria-label="Buka akun">👤</a>
          <button className="cart-button" onClick={() => setCartOpen(true)}>🛒<b>{cartCount}</b></button>
        </div>
      </header>

      {view === 'chat' ? (
        <section className="chat-view">
          <div className="service-strip"><span>● Toko buka</span><span>📍 Dari {STORE_CONFIG.pickupName}</span><span>Antar 30–60 menit</span><span>COD tersedia</span></div>
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
                    {message.cta && (
                      <a className="chat-cta" href={message.cta.url} target="_blank" rel="noreferrer">
                        <span>💬</span><b>{message.cta.label}</b><small>{STORE_CONFIG.adminPhoneDisplay}</small>
                      </a>
                    )}
                    {message.suggestions?.length ? (
                      <div className="chat-suggestions">
                        {message.suggestions.map((suggestion) => (
                          <button key={suggestion} disabled={loading} onClick={() => void submitText(suggestion)}>{suggestion}</button>
                        ))}
                      </div>
                    ) : null}
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
              <button onClick={() => openGuide('start')}>✨ Belanja Pintar</button>
              <a href="/mitra/daftar">🏪 Jual di SiBantu</a>
            </div>
            <form className="composer" onSubmit={sendMessage}>
              <button
                type="button"
                className={`icon-button ${listening ? 'listening' : ''}`}
                title={listening ? 'Hentikan rekaman' : 'Bicara dengan SiBantu'}
                onClick={startVoiceInput}
                aria-label={listening ? 'Hentikan rekaman suara' : 'Mulai input suara'}
              >
                {listening ? '■' : '🎙️'}
              </button>
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={listening ? 'Silakan bicara sekarang...' : 'Contoh: ada ikan nila?'}
                maxLength={500}
              />
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

      {guideOpen && (
        <div className="overlay guide-overlay" onMouseDown={(event) => event.target === event.currentTarget && setGuideOpen(false)}>
          <section className="guided-assistant">
            <div className="guide-head">
              <div><small>ASISTEN BELANJA</small><h2>Belanja seperti ngobrol di pasar</h2></div>
              <button onClick={() => setGuideOpen(false)}>×</button>
            </div>

            {guideMode === 'start' && (
              <div className="guide-menu">
                <button onClick={() => setGuideMode('budget')}><span>💰</span><div><b>Belanja sesuai budget</b><small>SiBantu pilihkan paket yang cukup</small></div><i>→</i></button>
                <button onClick={() => setGuideMode('recipe')}><span>🍲</span><div><b>Cari bahan masakan</b><small>Pilih menu dan jumlah orang</small></div><i>→</i></button>
                <button onClick={() => setGuideMode('list')}><span>📝</span><div><b>Titip daftar belanja</b><small>Tulis bebas beberapa barang sekaligus</small></div><i>→</i></button>
                <button onClick={() => { setGuideOpen(false); setView('store'); }}><span>🛍️</span><div><b>Lihat semua menu</b><small>Cari dan pilih dari katalog</small></div><i>→</i></button>
                <a href={adminWhatsAppUrl('Halo Admin SiBantu, saya ingin dibantu belanja.')} target="_blank" rel="noreferrer"><span>💬</span><div><b>Ngobrol dengan pedagang</b><small>{STORE_CONFIG.adminPhoneDisplay}</small></div><i>→</i></a>
              </div>
            )}

            {(guideMode === 'budget' || guideMode === 'recipe') && (
              <div className="guide-form">
                <button className="guide-back" onClick={() => setGuideMode('start')}>← Kembali</button>
                {guideMode === 'budget' && <><label>Budget belanja</label><div className="guide-options">{[50000,100000,150000].map((value) => <button className={guideBudget === value ? 'active' : ''} key={value} onClick={() => setGuideBudget(value)}>{rupiah(value)}</button>)}</div></>}
                <label>Untuk berapa orang?</label>
                <div className="guide-options">{[2,3,4,5].map((value) => <button className={guidePeople === value ? 'active' : ''} key={value} onClick={() => setGuidePeople(value)}>{value} orang</button>)}</div>
                <label>Lebih ingin menu apa?</label>
                <div className="guide-options food">{(['ikan','ayam','sayur'] as FoodPreference[]).map((value) => <button className={guidePreference === value ? 'active' : ''} key={value} onClick={() => setGuidePreference(value)}>{value === 'ikan' ? '🐟 Ikan' : value === 'ayam' ? '🍗 Ayam' : '🥬 Sayur'}</button>)}</div>
                <button className="guide-submit" onClick={submitGuide}>✨ Minta SiBantu pilihkan</button>
              </div>
            )}

            {guideMode === 'list' && (
              <div className="guide-form">
                <button className="guide-back" onClick={() => setGuideMode('start')}>← Kembali</button>
                <label>Tulis daftar belanja</label>
                <textarea value={guideList} onChange={(event) => setGuideList(event.target.value)} placeholder="Contoh: ikan nila 1 kg, bayam 2 ikat, minyak 1 liter" />
                <small>SiBantu akan memisahkan barang dan jumlahnya sebelum masuk keranjang.</small>
                <button className="guide-submit" disabled={!guideList.trim()} onClick={submitGuide}>Kirim daftar ke SiBantu →</button>
              </div>
            )}
          </section>
        </div>
      )}

      {selectedProduct && (
        <div className="overlay product-picker-overlay" onMouseDown={(event) => event.target === event.currentTarget && setSelectedProduct(null)}>
          <section className="product-picker">
            <button className="picker-close" onClick={() => setSelectedProduct(null)}>×</button>
            <div className="product-gallery-main">{selectedMedia?.type==='video'?<video src={selectedMedia.url} controls playsInline/>:selectedMedia?.url?<img src={selectedMedia.url} alt={selectedProduct.name}/>:selectedProduct.imageUrl?<img src={selectedProduct.imageUrl} alt={selectedProduct.name}/>:<span>{selectedProduct.emoji}</span>}</div>
            {selectedProduct.media&&selectedProduct.media.length>1&&<div className="product-gallery-thumbs">{selectedProduct.media.map((media,index)=><button className={selectedMediaIndex===index?'active':''} key={media.id||media.url} onClick={()=>setSelectedMediaIndex(index)}>{media.type==='video'?<span>▶</span>:<img src={media.thumbnailUrl||media.url} alt=""/>}</button>)}</div>}
            <small>{selectedProduct.category.toUpperCase()}</small>
            <h2>{selectedProduct.name}</h2>
            <div className="product-reputation"><span>⭐ {selectedProduct.averageRating?.toFixed(1)||'0.0'} ({selectedProduct.reviewCount||0} ulasan)</span><span>{formatQty(selectedProduct.soldCount||0)} terjual</span></div>
            <div className="store-reputation">🏪 {selectedProduct.storeSlug?<a href={`/toko/${selectedProduct.storeSlug}`}>{selectedProduct.storeName||'SiBantu'}</a>:<b>{selectedProduct.storeName||'SiBantu'}</b>}<small className={selectedProduct.storeIsAcceptingOrders?'open':'closed'}>{selectedProduct.storeIsAcceptingOrders?'Buka':'Tutup'}</small><span>⭐ {selectedProduct.storeRating?.toFixed(1)||'0.0'} ({selectedProduct.storeReviewCount||0})</span></div>
            <p>{selectedProduct.description}</p>
            <div className="review-preview"><div><b>Ulasan pembeli</b><span>{selectedProduct.reviewCount||0} ulasan terverifikasi</span></div>{!productReviews.length?<p>Belum ada ulasan untuk produk ini.</p>:productReviews.slice(0,3).map(review=><article key={review.id}><header><b>{review.buyerName}</b><span>{'★'.repeat(review.rating)}{'☆'.repeat(5-review.rating)}</span></header><p>{review.comment||'Pembeli memberikan rating tanpa komentar.'}</p>{review.sellerReply&&<small>Balasan seller: {review.sellerReply}</small>}</article>)}</div>
            <div className="picker-price"><strong>{rupiah(selectedProduct.price)}</strong><span>per {selectedProduct.unit}</span></div>
            <div className="picker-label"><b>Pilih jumlah</b><span>Bisa diubah lagi di keranjang</span></div>
            <div className="quick-quantities">
              {(selectedProduct.quickQuantities ?? [selectedProduct.step ?? 1]).map((qty) => (
                <button className={pickerQty === qty ? 'active' : ''} key={qty} onClick={() => setPickerQty(qty)}>
                  {formatQty(qty)} {selectedProduct.unit}
                </button>
              ))}
            </div>
            {selectedProduct.serviceOptions?.length ? (
              <div className="service-options">
                <div className="picker-label"><b>Permintaan khusus</b><span>Opsional</span></div>
                <div>
                  {selectedProduct.serviceOptions.map((option) => (
                    <button className={pickerNote === option ? 'active' : ''} key={option} onClick={() => setPickerNote(option)}>{option}</button>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="picker-stepper">
              <button onClick={() => setPickerQty((current) => Math.max(selectedProduct.step ?? 1, current - (selectedProduct.step ?? 1)))}>−</button>
              <div><strong>{formatQty(pickerQty)}</strong><span>{selectedProduct.unit}</span></div>
              <button onClick={() => setPickerQty((current) => current + (selectedProduct.step ?? 1))}>+</button>
            </div>
            {selectedProduct.storeIsAcceptingOrders === false && <div className="store-closed-note">Toko sedang tutup. Produk dapat dilihat tetapi belum dapat dipesan.</div>}
            <button className="picker-confirm" disabled={selectedProduct.storeIsAcceptingOrders === false} onClick={confirmProductPicker}>
              <span>Masukkan ke keranjang</span><strong>{rupiah(selectedProduct.price * pickerQty)}</strong>
            </button>
            <a
              className="ask-seller"
              href={adminWhatsAppUrl(`Halo Admin SiBantu, saya ingin bertanya tentang ${selectedProduct.name}.`)}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackProductEvent('chat_seller', selectedProduct.id)}
            >
              💬 Tanya pedagang tentang produk ini
            </a>
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
                const product = productById(item.productId);
                if (!product) return null;
                const step = product.step ?? 1;
                return <div className="cart-line" key={item.productId}><div className="cart-emoji">{product.emoji}</div><div className="cart-info"><h3>{product.name}</h3><span>{rupiah(product.price)} / {product.unit}</span>{item.note && <small className="item-note">📝 {item.note}</small>}<button onClick={() => setCartQty(product.id, 0)}>Hapus</button></div><div className="stepper"><button onClick={() => setCartQty(product.id, item.qty - step)}>−</button><b>{formatQty(item.qty)}<small>{product.unit}</small></b><button onClick={() => setCartQty(product.id, item.qty + step)}>+</button></div></div>;
              })}
            </div>
            {cart.length > 0 && <div className="drawer-total"><div><span>Subtotal</span><strong>{rupiah(subtotal)}</strong></div><small>Ongkir area {STORE_CONFIG.deliveryArea}: {rupiah(deliveryFee)}</small><button onClick={openCheckout}>Lanjut alamat & GPS</button></div>}
          </aside>
        </div>
      )}

      {checkoutOpen && (
        <div className="overlay checkout-overlay">
          <section className="checkout-panel">
            <div className="drawer-head">
              <div><small>CHECKOUT • {orderNumber}</small><h2>{checkoutStep === 1 ? 'Alamat & lokasi' : checkoutStep === 2 ? 'Periksa pesanan' : 'Pesanan siap dikirim'}</h2></div>
              <button onClick={() => setCheckoutOpen(false)}>×</button>
            </div>
            <div className="checkout-progress">
              <span className={checkoutStep >= 1 ? 'active' : ''}>1</span><i className={checkoutStep >= 2 ? 'active' : ''}/>
              <span className={checkoutStep >= 2 ? 'active' : ''}>2</span><i className={checkoutStep >= 3 ? 'active' : ''}/>
              <span className={checkoutStep >= 3 ? 'active' : ''}>3</span>
            </div>

            {checkoutStep === 1 && (
              <>
                <div className="pickup-origin"><span>🏪</span><div><small>LOKASI ASAL PESANAN</small><b>{STORE_CONFIG.pickupAddress}</b></div></div>
                <div className="map-placeholder"><div className="map-roads"/><div className="map-pin">📍</div><div className="map-copy"><strong>Lokasi tujuan</strong><span>{locationStatus}</span></div></div>
                <button className="gps-button" onClick={useLocation}>⌖ Gunakan lokasi GPS saya</button>
                {checkout.latitude != null && checkout.longitude != null && (
                  <a className="gps-result" href={`https://maps.google.com/?q=${checkout.latitude},${checkout.longitude}`} target="_blank" rel="noreferrer">✓ GPS tersimpan • Lihat di Google Maps</a>
                )}
                <div className="form-grid">
                  <label>Nama penerima<input className={checkoutErrors.name ? 'invalid' : ''} value={checkout.name} onChange={(event) => { setCheckout({ ...checkout, name: event.target.value }); clearCheckoutError('name'); }} placeholder="Nama lengkap" />{checkoutErrors.name && <small className="field-error">{checkoutErrors.name}</small>}</label>
                  <label>Nomor WhatsApp<input className={checkoutErrors.whatsapp ? 'invalid' : ''} value={checkout.whatsapp} onChange={(event) => { setCheckout({ ...checkout, whatsapp: event.target.value }); clearCheckoutError('whatsapp'); }} placeholder="08xxxxxxxxxx" inputMode="tel" />{checkoutErrors.whatsapp && <small className="field-error">{checkoutErrors.whatsapp}</small>}</label>
                  <label className="full">Alamat tujuan<textarea className={checkoutErrors.address ? 'invalid' : ''} value={checkout.address} onChange={(event) => { setCheckout({ ...checkout, address: event.target.value }); clearCheckoutError('address'); }} placeholder="Desa, dusun, RT/RW, nomor rumah" />{checkoutErrors.address && <small className="field-error">{checkoutErrors.address}</small>}</label>
                  <label className="full">Patokan rumah<input value={checkout.landmark} onChange={(event) => setCheckout({ ...checkout, landmark: event.target.value })} placeholder="Contoh: samping masjid, rumah pagar biru" /></label>
                </div>
                <div className="checkout-summary"><span>{cartCount} jenis barang • Subtotal</span><strong>{rupiah(subtotal)}</strong></div>
                <button className="continue-button" onClick={goToCheckoutReview}>Lanjut periksa pesanan →</button>
                <small className="phase-note">GPS disarankan agar kurir mudah menemukan lokasi. Alamat lengkap tetap wajib.</small>
              </>
            )}

            {checkoutStep === 2 && (
              <>
                <div className="review-address"><span>📍</span><div><small>DIANTAR KE</small><b>{checkout.name} • {checkout.whatsapp}</b><p>{checkout.address}{checkout.landmark ? ` • ${checkout.landmark}` : ''}</p>{checkout.latitude != null && checkout.longitude != null && <a href={`https://maps.google.com/?q=${checkout.latitude},${checkout.longitude}`} target="_blank" rel="noreferrer">Buka GPS di Maps ↗</a>}</div></div>
                <div className="review-items">
                  {cart.map((item) => { const product = productById(item.productId); if (!product) return null; return <article key={item.productId}><span>{product.emoji}</span><div><b>{product.name}</b><small>{formatQty(item.qty)} {product.unit}{item.note ? ` • ${item.note}` : ''}</small></div><strong>{rupiah(product.price * item.qty)}</strong></article>; })}
                </div>
                <div className="price-breakdown">
                  <div><span>Subtotal</span><b>{rupiah(subtotal)}</b></div>
                  <div><span>Ongkir {STORE_CONFIG.deliveryArea}</span><b>{rupiah(deliveryFee)}</b></div>
                  <div className="grand"><span>Total bayar</span><b>{rupiah(grandTotal)}</b></div>
                  <small>{STORE_CONFIG.paymentMethod}</small>
                </div>
                <div className="checkout-actions"><button onClick={() => setCheckoutStep(1)}>← Ubah alamat</button><button disabled={orderSaving} onClick={() => void sendOrderToAdmin()}>{orderSaving ? 'Menyimpan pesanan...' : 'Kirim order ke WhatsApp →'}</button></div>
              </>
            )}

            {checkoutStep === 3 && (
              <div className="order-success">
                <span>✅</span><h3>Order {orderNumber} siap diproses</h3><p>{orderSaved ? 'Pesanan sudah tersimpan di sistem dan rincian dibuka di WhatsApp admin.' : 'Database belum aktif, tetapi rincian dan lokasi sudah dibuka di WhatsApp admin sebagai fallback.'} Kirim pesannya untuk meminta konfirmasi stok dan waktu pengantaran.</p>
                <div><small>TOTAL</small><b>{rupiah(grandTotal)}</b></div>
                <button onClick={() => window.open(adminWhatsAppUrl(`Halo Admin SiBantu, mohon cek order ${orderNumber}.`), '_blank')}>Buka WhatsApp lagi</button>
                <button className="secondary" onClick={startNewOrder}>Buat pesanan baru</button>
              </div>
            )}
          </section>
        </div>
      )}
      <MobileBottomNav active={view === 'store' ? 'menu' : 'home'} />
    </main>
  );
}
