import type { ReactNode } from 'react';
import './account.css';
export default function AccountLayout({children}:{children:ReactNode}){return <main className="account-shell"><nav><a href="/"><span>S</span><b>SiBantu</b></a><small>Pusat Akun</small></nav>{children}</main>}
