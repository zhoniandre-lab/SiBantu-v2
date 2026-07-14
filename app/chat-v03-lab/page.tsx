import type { Metadata } from 'next';
import ChatV03Lab from './ChatV03Lab';
import styles from './lab.module.css';

export const metadata: Metadata = {
  title: 'Chat V0.3 Lab — SiBantu Internal',
  robots: { index: false, follow: false },
};

export default async function ChatV03LabPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const params = await searchParams;
  const expectedKey = process.env.CHAT_LAB_KEY;
  if (!expectedKey || params.key !== expectedKey) {
    return (
      <main className={styles.locked}>
        <div><span>🔒</span><h1>SiBantu Internal Lab</h1><p>Halaman pengujian memerlukan akses internal.</p></div>
      </main>
    );
  }
  return <ChatV03Lab labKey={expectedKey} />;
}
