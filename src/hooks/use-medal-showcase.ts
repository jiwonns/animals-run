import { onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { equippedMedal, equipMedal, medalDisplayRef, ownedMedals } from '@/lib/medal-display';
import { rankingsRef, type RankingEntry } from '@/lib/ranking';
import { useMedals } from './use-medals';

export function useMedalShowcase(uid?: string) {
  const { claimed, failed } = useMedals(uid);
  const [ranking, setRanking] = useState<{ entries: (RankingEntry & { uid: string })[]; failed: boolean } | null>(null);
  const [display, setDisplay] = useState<{ uid: string; id: string | null; failed: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!uid) return;
    const offRankings = onSnapshot(rankingsRef(), snap => setRanking({ entries: snap.docs.map(d => ({ ...d.data(), uid: d.id }) as RankingEntry & { uid: string }), failed: false }),
      () => setRanking({ entries: [], failed: true }));
    const offDisplay = onSnapshot(medalDisplayRef(uid), snap => setDisplay({ uid, id: snap.data()?.medalId ?? null, failed: false }),
      () => setDisplay({ uid, id: null, failed: true }));
    return () => { offRankings(); offDisplay(); };
  }, [uid]);
  const medals = uid ? ownedMedals(uid, claimed ?? new Set(), ranking?.entries ?? []) : [];
  const current = display?.uid === uid ? display : null;
  const equipped = equippedMedal(current?.id ?? null, medals);
  async function equip(id: string | null) {
    if (!uid || saving) return;
    setSaving(true);
    try { await equipMedal(uid, id); }
    finally { setSaving(false); }
  }
  return { medals, equipped, saving, equip, claimed, failed, rankingFailed: ranking?.failed ?? false,
    displayFailed: current?.failed ?? false, loading: !claimed || !ranking || !current };
}
export type MedalShowcase = ReturnType<typeof useMedalShowcase>;
