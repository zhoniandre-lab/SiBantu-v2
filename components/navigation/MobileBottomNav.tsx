'use client';

type NavKey='home'|'menu'|'orders'|'notifications'|'account';
const ITEMS:[NavKey,string,string,string][]=[
 ['home','⌂','Beranda','/'],['menu','▦','Menu','/?view=store'],['orders','▣','Pesanan','/akun/dashboard?tab=orders'],['notifications','♧','Notifikasi','/akun/dashboard?tab=notifications'],['account','♙','Akun','/akun/dashboard'],
];
export default function MobileBottomNav({active}: {active:NavKey}){return <nav className="mobile-bottom-nav" aria-label="Navigasi utama">{ITEMS.map(([key,icon,label,href])=><a className={active===key?'active':''} href={href} key={key}><span>{icon}</span><b>{label}</b></a>)}</nav>}
