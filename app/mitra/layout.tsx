import type { ReactNode } from 'react';
import './mitra.css';

export default function MitraLayout({children}:{children:ReactNode}){return <main className="mitra-shell"><nav><a href="/"><span>S</span><b>SiBantu</b></a><small>Portal Mitra</small></nav>{children}</main>}
