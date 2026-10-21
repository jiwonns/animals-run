import { useEffect, useState } from 'react';
import { limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { arenaWalletRef, duelsRef, type Duel } from '@/lib/duel-service';
import type { DuelState } from '@/lib/duel';
export function useDuels(uid: string | undefined) {
  const [data, setData] = useState<{ uid: string; duels: Duel[]; failed: boolean } | null>(null);
  const [wallet, setWallet] = useState<{ uid: string; day: number; count: number } | null>(null);
  const [previous, setPrevious] = useState<Record<string, DuelState | null>>({});
  useEffect(() => {
    if (!uid) return;
    const cache = new Map<string, Duel>();
    const stop = onSnapshot(query(duelsRef(), where('members', 'array-contains', uid), orderBy('createdAt', 'desc'), limit(60)), snap => {
      const duels = snap.docs.map(d => ({ ...d.data(), id: d.id }) as Duel);
      const before: Record<string, DuelState | null> = {};
      duels.forEach(d => { const old = cache.get(d.id); if (old?.state && d.state && old.state.turn !== d.state.turn) before[d.id] = old.state; cache.set(d.id, d); });
      if (Object.keys(before).length) setPrevious(p => ({ ...p, ...before }));
      setData({ uid, duels: duels.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0)), failed: false });
    }, () => setData({ uid, duels: [], failed: true }));
    const stopWallet = onSnapshot(arenaWalletRef(uid), snap => setWallet({ uid, day: snap.data()?.day ?? -1, count: snap.data()?.count ?? 0 }), () => {});
    return () => { stop(); stopWallet(); };
  }, [uid]);
  const current = data?.uid === uid ? data : null;
  return { duels: current?.duels ?? [], previous, loading: !current, failed: current?.failed ?? false,
    wallet: wallet?.uid === uid ? wallet : null };
}
