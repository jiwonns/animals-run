import { onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { locationRef, locationsRef, type PlayerLocation } from '@/lib/profile';
import { friendIdentity } from '@/lib/friends';
import { useFriends } from '@/providers/friends-provider';

/** Players whose shared location is older than this are treated as gone. */
const ACTIVE_MS = 10 * 60_000;
const REFRESH_MS = 2 * 60_000;

export type ActivePlayer = PlayerLocation & { id: string };

/** Other players sharing their location recently; excludes `uid`. */
export function useActivePlayers(uid: string | undefined) {
  const { friends } = useFriends();
  const friendKey = uid ? friends.map(r => friendIdentity(r, uid).uid).sort().join(',') : '';
  const [friendState, setFriendState] = useState<{ uid: string; players: ActivePlayer[] } | null>(null);
  const [since, setSince] = useState(() => Date.now() - ACTIVE_MS);
  const [state, setState] = useState<{ uid?: string; players: ActivePlayer[]; failed: boolean }>({ players: [], failed: false });

  useEffect(() => {
    const timer = setInterval(() => setSince(Date.now() - ACTIVE_MS), REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      query(locationsRef(), where('audience', '==', 'public')),
      (snapshot) =>
        setState({
          uid,
          players: snapshot.docs
            .filter((d) => d.id !== uid)
            .map((d) => ({ id: d.id, ...(d.data() as PlayerLocation) })),
          failed: false,
        }),
      () => setState({ uid, players: [], failed: true }),
    );
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    const players = new Map<string, ActivePlayer>();
    const publish = () => setFriendState({ uid, players: [...players.values()] });
    const off = (friendKey ? friendKey.split(',') : []).map(id => onSnapshot(locationRef(id), snap => {
      if (snap.exists()) players.set(id, { id, ...(snap.data() as PlayerLocation) });
      else players.delete(id);
      publish();
    }, () => { players.delete(id); publish(); }));
    return () => off.forEach(unsubscribe => unsubscribe());
  }, [uid, friendKey]);

  const friendIds = new Set(friendKey ? friendKey.split(',') : []);
  const visible = new Map<string, ActivePlayer>();
  if (state.uid === uid) state.players.filter(p => p.audience === 'public').forEach(p => visible.set(p.id, p));
  if (friendState && friendState.uid === uid) friendState.players.filter(p => friendIds.has(p.id)).forEach(p => visible.set(p.id, p));
  return { players: [...visible.values()].filter(p => p.id !== uid && (p.updatedAt?.toMillis() ?? 0) >= since), failed: state.uid === uid && state.failed };
}
