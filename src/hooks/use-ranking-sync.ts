import { useEffect, useRef } from 'react';

import { rankingKey, syncRanking } from '@/lib/ranking';
import { useSession } from '@/providers/session-provider';

/** Waits for profile writes to settle; firestore.rules compare the entry with the saved profile. */
const DEBOUNCE_MS = 3000;

/** Keeps rankings/{uid} in step with the signed-in profile. */
export function useRankingSync() {
  const { user, profile } = useSession();
  const uid = user?.uid;
  const synced = useRef<string | null>(null);

  useEffect(() => {
    if (!uid || !profile) return;
    const key = rankingKey(profile);
    if (synced.current === `${uid}:${key}`) return;
    const timer = setTimeout(() => {
      syncRanking(uid, profile)
        .then(() => {
          synced.current = `${uid}:${key}`;
        })
        .catch(() => {});
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [uid, profile]);
}
