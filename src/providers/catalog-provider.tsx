import { createContext, use, useCallback, useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { loadRemoteCatalog } from '@/lib/remote-catalog';
import { useSession } from './session-provider';

const CatalogContext = createContext({ version: 0, refresh: async () => {} });
export function CatalogProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const [version, setVersion] = useState(0);
  const refresh = useCallback(async () => {
    if (!user) return;
    const value = await loadRemoteCatalog();
    if (value) setVersion(value.version);
  }, [user]);
  useEffect(() => {
    const timer = setTimeout(() => void refresh().catch(() => {}), 0);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void refresh().catch(() => {}); });
    return () => { clearTimeout(timer); subscription.remove(); };
  }, [refresh]);
  return <CatalogContext value={{ version, refresh }}>{children}</CatalogContext>;
}
export const useCatalog = () => use(CatalogContext);
