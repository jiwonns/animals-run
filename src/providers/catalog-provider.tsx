import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { loadRemoteCatalog, subscribeCatalog, watchRemoteCatalog } from '@/lib/remote-catalog';
import { useRefreshTask } from '@/lib/app-refresh';
import { useSession } from './session-provider';

const CatalogContext = createContext({ version: 0, refresh: async () => {} });
export function CatalogProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const uid=user?.uid;
  const [version, setVersion] = useState(0);
  const refresh = useCallback(async () => {
    if (!uid) return;
    const value = await loadRemoteCatalog({server:true});
    if (value) setVersion(value.version);
  }, [uid]);
  useRefreshTask(refresh);
  useEffect(()=>subscribeCatalog(value=>setVersion(value.version)),[]);
  useEffect(()=>{
    if(!uid)return;
    let off: (()=>void)|undefined;
    const connect=()=>{off?.();off=watchRemoteCatalog();};
    connect();
    const subscription=AppState.addEventListener('change',state=>{if(state==='active')connect();else{off?.();off=undefined;}});
    return()=>{off?.();subscription.remove();};
  },[uid]);
  useEffect(() => {
    const timer = setTimeout(() => void refresh().catch(() => {}), 0);
    return () => { clearTimeout(timer); };
  }, [refresh]);
  const value=useMemo(()=>({version,refresh}),[version,refresh]);
  return <CatalogContext value={value}>{children}</CatalogContext>;
}
export const useCatalog = () => use(CatalogContext);
