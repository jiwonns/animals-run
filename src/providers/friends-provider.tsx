import { onSnapshot, query, where } from 'firebase/firestore';
import { createContext, use, useEffect, useState, type ReactNode } from 'react';
import { friendNotifications, friendshipsRef, type Friendship } from '@/lib/friends';
import { useSession } from './session-provider';

function useFriendsState() {
  const { user } = useSession();
  const uid = user?.uid;
  const [state, setState] = useState<{ uid: string; relationships: Friendship[]; failed: boolean } | null>(null);
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(query(friendshipsRef(), where('members', 'array-contains', uid)), snapshot => {
      setState({ uid, relationships: snapshot.docs.map(d => ({ ...d.data(), id: d.id }) as Friendship), failed: false });
    }, () => setState({ uid, relationships: [], failed: true }));
  }, [uid]);
  const current = state?.uid === uid ? state : null;
  const relationships = current?.relationships ?? [];
  const friends = relationships.filter(r => r.status === 'accepted');
  const incoming = relationships.filter(r => r.status === 'pending' && r.recipient === uid);
  const outgoing = relationships.filter(r => r.status === 'pending' && r.sender === uid);
  const notifications = uid ? friendNotifications(relationships, uid) : [];
  return { relationships, friends, incoming, outgoing, notifications, unread: notifications.filter(n => n.unread).length,
    loading: !!uid && !current, failed: current?.failed ?? false };
}
const FriendsContext = createContext<ReturnType<typeof useFriendsState> | null>(null);
export function FriendsProvider({ children }: { children: ReactNode }) {
  const value = useFriendsState();
  return <FriendsContext value={value}>{children}</FriendsContext>;
}
export function useFriends() {
  const value = use(FriendsContext);
  if (!value) throw new Error('useFriends requires FriendsProvider');
  return value;
}
