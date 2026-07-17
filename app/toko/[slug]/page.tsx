import PublicStorePage from '@/components/store/PublicStorePage';
import './store.css';
export default async function TokoPage({params}:{params:Promise<{slug:string}>}){const {slug}=await params;return <PublicStorePage slug={slug}/>}
