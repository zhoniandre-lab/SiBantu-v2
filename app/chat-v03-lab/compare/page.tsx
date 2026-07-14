import type { Metadata } from 'next';
import CompareClient from './CompareClient';
import styles from './compare.module.css';

export const metadata: Metadata = {
  title: 'Legacy vs V0.3 — SiBantu Internal',
  robots: { index: false, follow: false },
};

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ key?: string }> }) {
  const params = await searchParams;
  const expectedKey = process.env.CHAT_LAB_KEY;
  if (!expectedKey || params.key !== expectedKey) {
    return <main className={styles.locked}><div><span>🔒</span><h1>Comparison Lab</h1><p>Akses internal diperlukan.</p></div></main>;
  }
  return <CompareClient labKey={expectedKey} />;
}
