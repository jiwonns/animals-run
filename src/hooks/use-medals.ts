import { useRefreshRevision } from '@/lib/app-refresh';
import { onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { medalsRef } from '@/lib/medals';

export function useMedals(uid?: string) {
  const refreshRevision=useRefreshRevision();
  const [state, setState] = useState<{ uid: string; ids: ReadonlySet<string> } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(medalsRef(uid), snapshot => {
      setState({ uid, ids: new Set(snapshot.docs.map(d => d.id)) }); setFailed(false);
    }, () => setFailed(true));
  }, [uid, refreshRevision]);
  return { claimed: state && state.uid === uid ? state.ids : null, failed };
}
