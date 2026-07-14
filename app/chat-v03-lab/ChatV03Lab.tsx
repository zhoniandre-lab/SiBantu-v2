'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { findProduct } from '@/lib/catalog';
import { formatQty, makeId, rupiah } from '@/lib/format';
import type { CartItem, CommerceAction } from '@/lib/types';
import styles from './lab.module.css';

type LabMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  metadata?: LabResponse;
};

type LabResponse = {
  reply: string;
  stateToken: string;
  state: { topic: string; pending: string; budget?: number; people?: number; preference?: string; turn: number };
  actions: CommerceAction[];
  productIds: number[];
  suggestions: string[];
  confidence: number;
  handoff?: { reason: string; message: string };
  latencyMs: number;
  aiLatencyMs: number;
  aiStatus: string;
  modelUsed?: string;
  mode: string;
  version: string;
};

const SCENARIOS = [
  { name: 'Budget 3 langkah', messages: ['belanja sesuai budget', '50 rbu', 'kami tiga orang'] },
  { name: 'Resep berantai', messages: ['hari ini enaknya masak apa', 'kami empat orang', 'pilih menu ikan'] },
  { name: 'Typo produk', messages: ['sya mau bli syuran', 'stengah kilo ikn nila'] },
  { name: 'Multi-produk', messages: ['ikan nila 1 kg, bayam 2 ikat, minyak 1 liter'] },
  { name: 'Human handoff', messages: ['tanya admin dong'] },
];

function applyActions(current: CartItem[], actions: CommerceAction[]) {
  return actions.reduce((cart, action) => {
    if (action.type === 'add') {
      const existing = cart.find((item) => item.productId === action.productId);
      return existing
        ? cart.map((item) => item.productId === action.productId ? { ...item, qty: item.qty + action.qty } : item)
        : [...cart, { productId: action.productId, qty: action.qty }];
    }
    if (action.type === 'set') {
      const exists = cart.some((item) => item.productId === action.productId);
      return exists
        ? cart.map((item) => item.productId === action.productId ? { ...item, qty: action.qty } : item)
        : [...cart, { productId: action.productId, qty: action.qty }];
    }
    if (action.type === 'remove') return cart.filter((item) => item.productId !== action.productId);
    return cart;
  }, current);
}

export default function ChatV03Lab({ labKey }: { labKey: string }) {
  const [sessionId, setSessionId] = useState('');
  const [stateToken, setStateToken] = useState('');
  const [messages, setMessages] = useState<LabMessage[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const [latest, setLatest] = useState<LabResponse | null>(null);

  useEffect(() => {
    const session = sessionStorage.getItem('sibantu_v03_lab_session') || makeId('LAB');
    sessionStorage.setItem('sibantu_v03_lab_session', session);
    setSessionId(session);
    setStateToken(sessionStorage.getItem('sibantu_v03_lab_token') || '');
  }, []);

  useEffect(() => {
    if (stateToken) sessionStorage.setItem('sibantu_v03_lab_token', stateToken);
  }, [stateToken]);

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + (findProduct(item.productId)?.price ?? 0) * item.qty, 0), [cart]);

  function resetLab() {
    sessionStorage.removeItem('sibantu_v03_lab_token');
    setSessionId(makeId('LAB'));
    setStateToken('');
    setMessages([]);
    setCart([]);
    setLatest(null);
  }

  async function runSequence(sequence: string[], resetBefore = false) {
    if (running || !sequence.length) return;
    setRunning(true);

    let token = resetBefore ? '' : stateToken;
    let workingCart = resetBefore ? [] : cart;
    let workingMessages = resetBefore ? [] : [...messages];
    if (resetBefore) {
      setMessages([]);
      setCart([]);
      setLatest(null);
    }

    try {
      for (const text of sequence) {
        workingMessages.push({ id: makeId('msg'), role: 'user', text });
        setMessages([...workingMessages]);

        const response = await fetch('/api/chat-v03', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-chat-lab-key': labKey },
          body: JSON.stringify({ message: text, stateToken: token, cart: workingCart, sessionId }),
        });
        if (!response.ok) throw new Error('Shadow API gagal');
        const result = (await response.json()) as LabResponse;
        token = result.stateToken;
        workingCart = applyActions(workingCart, result.actions ?? []);
        workingMessages.push({ id: makeId('msg'), role: 'assistant', text: result.reply, metadata: result });
        setStateToken(token);
        setCart([...workingCart]);
        setLatest(result);
        setMessages([...workingMessages]);
      }
    } catch (error) {
      workingMessages.push({ id: makeId('msg'), role: 'assistant', text: error instanceof Error ? error.message : 'Pengujian gagal' });
      setMessages([...workingMessages]);
    } finally {
      setRunning(false);
      setInput('');
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (input.trim()) void runSequence([input.trim()]);
  }

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div><small>SIBANTU INTERNAL</small><h1>Chat Engine V0.3 Lab</h1><p>Shadow testing — tidak mengganti chat pelanggan.</p></div>
        <div className={styles.status}><span>● SHADOW</span><b>180 tests passed</b><a href={`/chat-v03-lab/compare?key=${encodeURIComponent(labKey)}`}>Bandingkan engine →</a></div>
      </header>

      <section className={styles.scenarios}>
        <div><b>Skenario otomatis</b><small>Setiap skenario dimulai dari state kosong.</small></div>
        <div className={styles.scenarioButtons}>
          {SCENARIOS.map((scenario) => <button key={scenario.name} disabled={running} onClick={() => void runSequence(scenario.messages, true)}>{scenario.name}</button>)}
        </div>
      </section>

      <div className={styles.workspace}>
        <section className={styles.chatPanel}>
          <div className={styles.messages}>
            {!messages.length && <div className={styles.empty}><span>🧪</span><b>Mulai pengujian</b><p>Pilih skenario atau ketik kalimat pelanggan.</p></div>}
            {messages.map((message) => (
              <div className={`${styles.message} ${styles[message.role]}`} key={message.id}>
                <div>{message.text}</div>
                {message.metadata && <small>{message.metadata.latencyMs} ms • {message.metadata.aiStatus}{message.metadata.modelUsed ? ` • ${message.metadata.modelUsed}` : ''}</small>}
              </div>
            ))}
            {running && <div className={`${styles.message} ${styles.assistant}`}><div>Menjalankan shadow engine...</div></div>}
          </div>
          {latest?.suggestions?.length ? <div className={styles.suggestions}>{latest.suggestions.map((item) => <button key={item} disabled={running} onClick={() => void runSequence([item])}>{item}</button>)}</div> : null}
          <form className={styles.composer} onSubmit={submit}><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ketik kalimat pengujian..." /><button disabled={running || !input.trim()}>Kirim</button></form>
        </section>

        <aside className={styles.debugPanel}>
          <div className={styles.debugHead}><div><small>DEBUG</small><h2>State Inspector</h2></div><button onClick={resetLab}>Reset</button></div>
          <dl className={styles.metrics}>
            <div><dt>Version</dt><dd>{latest?.version ?? '0.3.0'}</dd></div>
            <div><dt>Mode</dt><dd>{latest?.mode ?? 'shadow'}</dd></div>
            <div><dt>Topic</dt><dd>{latest?.state?.topic ?? 'general'}</dd></div>
            <div><dt>Pending</dt><dd>{latest?.state?.pending ?? 'none'}</dd></div>
            <div><dt>Turn</dt><dd>{latest?.state?.turn ?? 0}</dd></div>
            <div><dt>Confidence</dt><dd>{latest ? Math.round(latest.confidence * 100) + '%' : '-'}</dd></div>
            <div><dt>Latency</dt><dd>{latest?.latencyMs ?? '-'} ms</dd></div>
            <div><dt>AI</dt><dd>{latest?.aiStatus ?? '-'}</dd></div>
          </dl>

          <div className={styles.stateBlock}><small>SLOT MEMORY</small><pre>{JSON.stringify(latest?.state ?? {}, null, 2)}</pre></div>
          <div className={styles.stateBlock}><small>ACTIONS</small><pre>{JSON.stringify(latest?.actions ?? [], null, 2)}</pre></div>

          <div className={styles.cartBlock}><div><small>SIMULATED CART</small><b>{rupiah(subtotal)}</b></div>{!cart.length && <p>Kosong</p>}{cart.map((item) => { const product = findProduct(item.productId); return product ? <article key={item.productId}><span>{product.emoji}</span><div><b>{product.name}</b><small>{formatQty(item.qty)} {product.unit}</small></div></article> : null; })}</div>

          {latest?.handoff && <div className={styles.handoff}><b>Human handoff</b><span>{latest.handoff.reason}</span></div>}
          <footer>Session hash dicatat; pesan mentah tidak masuk telemetry.</footer>
        </aside>
      </div>
    </main>
  );
}
