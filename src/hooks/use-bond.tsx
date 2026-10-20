import { onSnapshot } from 'firebase/firestore';
import { createContext, use, useEffect, useState, type ReactNode } from 'react';
import { bondRef, bondStatus, selectCompanion, type Bonds } from '@/lib/bond';
import { useSession } from '@/providers/session-provider';

function useBondState() {
  const { user, profile } = useSession();
  const uid = user?.uid;
  const [data, setData] = useState<{ uid: string; animals: Bonds; active: string | null } | null>(null);
  const [now, setNow] = useState(Date.now);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(bondRef(uid), snap => { setData({ uid, animals: snap.data()?.animals ?? {}, active: snap.data()?.active ?? null }); setFailed(false); }, () => setFailed(true));
  }, [uid]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const avatar = profile?.avatar;
  const ready = !!data && data.uid === uid;
  const started = avatar && ready && data.active === avatar ? data.animals[avatar]?.since : null;
  useEffect(() => {
    if (uid && ready && avatar && !started) void selectCompanion(uid, avatar).catch(() => setFailed(true));
  }, [uid, ready, avatar, started]);
  return { status: profile && ready && data.active === (profile.avatar ?? null) ? bondStatus(profile, data.animals, now) : null, failed };
}

const BondContext = createContext<ReturnType<typeof useBondState> | null>(null);
export function BondProvider({ children }: { children: ReactNode }) {
  const value = useBondState();
  return <BondContext value={value}>{children}</BondContext>;
}
export function useBond() {
  const value = use(BondContext);
  if (!value) throw new Error('useBond requires BondProvider');
  return value;
}
