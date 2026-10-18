import { onSnapshot, query, Timestamp, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { locationsRef, type PlayerLocation } from '@/lib/profile';

/** Players whose shared location is older than this are treated as gone. */
const ACTIVE_MS = 10 * 60_000;
const REFRESH_MS = 2 * 60_000;

export type ActivePlayer = PlayerLocation & { id: string };

/** Other players sharing their location recently; excludes `uid`. */
export function useActivePlayers(uid: string | undefined) {
  const [since, setSince] = useState(() => Date.now() - ACTIVE_MS);
  const [state, setState] = useState<{ players: ActivePlayer[]; failed: boolean }>({ players: [], failed: false });

  useEffect(() => {
    const timer = setInterval(() => setSince(Date.now() - ACTIVE_MS), REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      query(locationsRef(), where('updatedAt', '>=', Timestamp.fromMillis(since))),
      (snapshot) =>
        setState({
          players: snapshot.docs
            .filter((d) => d.id !== uid)
            .map((d) => ({ id: d.id, ...(d.data() as PlayerLocation) })),
          failed: false,
        }),
      () => setState({ players: [], failed: true }),
    );
  }, [uid, since]);

  return state;
}
