'use client';

import { useMemo, useState } from 'react';
import { makeId } from '@/lib/format';
import type { CartItem, ChatMessage, CommerceAction } from '@/lib/types';
import styles from './compare.module.css';

type EngineResult = {
  reply: string;
  action?: CommerceAction;
  actions?: CommerceAction[];
  productIds?: number[];
  stateToken?: string;
  state?: Record<string, unknown>;
  latencyMs?: number;
  confidence?: number;
  aiStatus?: string;
  modelUsed?: string;
};

type TurnResult = {
  prompt: string;
  legacy: EngineResult & { clientLatency: number };
  v03: EngineResult & { clientLatency: number };
};

const SCENARIOS = [
  { name: 'Sayur vs Sayuran', messages: ['Saya mau beli sayuran'] },
  { name: 'Budget berantai', messages: ['Belanja sesuai budget', '50 rbu', 'Kami tiga orang'] },
  { name: 'Resep berantai', messages: ['Hari ini enaknya masak apa?', 'Kami empat orang', 'Pilih menu ikan'] },
  { name: 'Multi-produk', messages: ['Ikan nila 1 kg, bayam 2 ikat, minyak 1 liter'] },
  { name: 'Konteks jumlah', messages: ['Ada ikan tongkol?', 'Setengah kilo aja'] },
  { name: 'Human handoff', messages: ['Berasnya bisa beli 1 kg saja?'] },
];

function actionsOf(result: EngineResult) {
  if (result.actions?.length) return result.actions;
  return result.action && result.action.type !== 'none' ? [result.action] : [];
}

function applyActions(cart: CartItem[], actions: CommerceAction[]) {
  return actions.reduce((current, action) => {
    if (action.type === 'add') {
      const exists = current.find((item) => item.productId === action.productId);
      return exists ? current.map((item) => item.productId === action.productId ? { ...item, qty: item.qty + action.qty } : item) : [...current, { productId: action.productId, qty: action.qty }];
    }
    if (action.type === 'set') return current.some((item) => item.productId === action.productId) ? current.map((item) => item.productId === action.productId ? { ...item, qty: action.qty } : item) : [...current, { productId: action.productId, qty: action.qty }];
    if (action.type === 'remove') return current.filter((item) => item.productId !== action.productId);
    return current;
  }, cart);
}

async function timedFetch(url: string, init: RequestInit) {
  const started = performance.now();
  const response = await fetch(url, init);
  const latency = Math.round((performance.now() - started) * 100) / 100;
  if (!response.ok) throw new Error(`${url} HTTP ${response.status}`);
  return { result: (await response.json()) as EngineResult, latency };
}

function isWeak(reply: string) {
  return /(belum yakin|belum menemukan|pilih dari menu aja|tidak mengerti|nggak ngerti)/i.test(reply);
}

export default function CompareClient({ labKey }: { labKey: string }) {
  const [results, setResults] = useState<TurnResult[]>([]);
  const [running, setRunning] = useState(false);
  const [scenarioName, setScenarioName] = useState('Belum diuji');
  const [error, setError] = useState('');

  const summary = useMemo(() => {
    if (!results.length) return null;
    const avg = (key: 'legacy' | 'v03') => Math.round(results.reduce((sum, item) => sum + item[key].clientLatency, 0) / results.length);
    return {
      legacyLatency: avg('legacy'),
      v03Latency: avg('v03'),
      legacyWeak: results.filter((item) => isWeak(item.legacy.reply)).length,
      v03Weak: results.filter((item) => isWeak(item.v03.reply)).length,
    };
  }, [results]);

  async function runScenario(name: string, prompts: string[]) {
    setRunning(true); setResults([]); setScenarioName(name); setError('');
    let legacyHistory: ChatMessage[] = [];
    let legacyCart: CartItem[] = [];
    let v03Cart: CartItem[] = [];
    let stateToken = '';
    const turns: TurnResult[] = [];

    try {
      for (const prompt of prompts) {
        const userMessage: ChatMessage = { id: makeId('cmp'), role: 'user', text: prompt };
        legacyHistory = [...legacyHistory, userMessage];
        const sessionId = `COMPARE-${name.replace(/\s/g, '-')}`;

        const [legacy, v03] = await Promise.all([
          timedFetch('/api/chat', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: prompt, cart: legacyCart, history: legacyHistory, sessionId }),
          }),
          timedFetch('/api/chat-v03', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'x-chat-lab-key': labKey },
            body: JSON.stringify({ message: prompt, cart: v03Cart, stateToken, sessionId }),
          }),
        ]);

        legacyCart = applyActions(legacyCart, actionsOf(legacy.result));
        v03Cart = applyActions(v03Cart, actionsOf(v03.result));
        stateToken = v03.result.stateToken ?? stateToken;
        legacyHistory = [...legacyHistory, { id: makeId('cmp'), role: 'assistant', text: legacy.result.reply, productIds: legacy.result.productIds }];
        turns.push({ prompt, legacy: { ...legacy.result, clientLatency: legacy.latency }, v03: { ...v03.result, clientLatency: v03.latency } });
        setResults([...turns]);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Comparison gagal');
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div><small>SIBANTU INTERNAL</small><h1>Legacy vs Chat V0.3</h1><p>Jawaban dan latency dari kalimat yang sama.</p></div>
        <a href={`/chat-v03-lab?key=${encodeURIComponent(labKey)}`}>← Kembali ke Lab</a>
      </header>

      <section className={styles.toolbar}>
        <div><b>Skenario</b><span>{scenarioName}</span></div>
        <nav>{SCENARIOS.map((scenario) => <button disabled={running} key={scenario.name} onClick={() => void runScenario(scenario.name, scenario.messages)}>{scenario.name}</button>)}</nav>
      </section>

      {summary && <section className={styles.summary}>
        <article><span>Legacy avg</span><b>{summary.legacyLatency} ms</b><small>{summary.legacyWeak} jawaban lemah</small></article>
        <article className={styles.v03}><span>V0.3 avg</span><b>{summary.v03Latency} ms</b><small>{summary.v03Weak} jawaban lemah</small></article>
        <article><span>Turns</span><b>{results.length}</b><small>{running ? 'sedang berjalan' : 'selesai'}</small></article>
      </section>}

      {error && <div className={styles.error}>{error}</div>}
      {!results.length && !running && <div className={styles.empty}>Pilih satu skenario untuk membandingkan engine.</div>}
      {running && !results.length && <div className={styles.empty}>Menunggu respons kedua engine...</div>}

      <section className={styles.turns}>
        {results.map((turn, index) => <article className={styles.turn} key={`${turn.prompt}-${index}`}>
          <h2><span>TURN {index + 1}</span>{turn.prompt}</h2>
          <div className={styles.columns}>
            <div className={isWeak(turn.legacy.reply) ? styles.weak : ''}>
              <header><b>Legacy</b><span>{turn.legacy.clientLatency} ms</span></header>
              <p>{turn.legacy.reply}</p>
              <footer>{turn.legacy.aiStatus ?? 'core'} {turn.legacy.modelUsed ? `• ${turn.legacy.modelUsed}` : ''}</footer>
            </div>
            <div className={`${styles.v03card} ${isWeak(turn.v03.reply) ? styles.weak : ''}`}>
              <header><b>V0.3</b><span>{turn.v03.clientLatency} ms</span></header>
              <p>{turn.v03.reply}</p>
              <footer>confidence {turn.v03.confidence != null ? Math.round(turn.v03.confidence * 100) + '%' : '-'} • {turn.v03.aiStatus}</footer>
            </div>
          </div>
        </article>)}
      </section>
    </main>
  );
}
