import { useRefreshRevision } from '@/lib/app-refresh';
import { onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { companionRef, eggsRef, EGG_SLOTS, type Companion, type Egg, type EggSlot } from '@/lib/home';
import { useSession } from '@/providers/session-provider';

type Eggs = Partial<Record<EggSlot, Egg>>;

/** Live users/{uid}/eggs by slot; null until the first snapshot arrives. */
export function useEggs(): Eggs | null {
  const refreshRevision=useRefreshRevision();
  const { user } = useSession();
  const uid = user?.uid;
  const [state, setState] = useState<{ uid: string; eggs: Eggs } | null>(null);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      eggsRef(uid),
      (snapshot) => {
        const eggs: Eggs = {};
        for (const d of snapshot.docs) {
          if ((EGG_SLOTS as readonly string[]).includes(d.id)) eggs[d.id as EggSlot] = d.data() as Egg;
        }
        setState({ uid, eggs });
      },
      () => setState({ uid, eggs: {} }),
    );
  }, [uid, refreshRevision]);

  return state && state.uid === uid ? state.eggs : null;
}

/** Steps walked with each character as the avatar; empty until something is recorded. */
export function useCompanionSteps(): Companion['steps'] {
  const refreshRevision=useRefreshRevision();
  const { user } = useSession();
  const uid = user?.uid;
  const [state, setState] = useState<{ uid: string; steps: Companion['steps'] } | null>(null);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      companionRef(uid),
      (snapshot) => setState({ uid, steps: (snapshot.data() as Companion | undefined)?.steps ?? {} }),
      () => setState({ uid, steps: {} }),
    );
  }, [uid, refreshRevision]);

  return state && state.uid === uid ? state.steps : {};
}

/** Current time, refreshed every `intervalMs`. */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
