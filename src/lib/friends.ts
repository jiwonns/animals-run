import { collection, doc, runTransaction, serverTimestamp, updateDoc, writeBatch, type Timestamp } from 'firebase/firestore';
import type { CharacterId } from '@/constants/characters';
import { db } from './firebase';
import { displayName, type Profile } from './profile';

export type FriendIdentity = { username: string; nickname?: string; avatar?: CharacterId | null };
export type Friendship = {
  id: string; members: string[]; sender: string; recipient: string; status: 'pending' | 'accepted';
  senderName: string; senderAvatar: CharacterId | null; recipientName: string; recipientAvatar: CharacterId | null;
  createdAt: Timestamp | null; updatedAt: Timestamp | null; requestReadAt: Timestamp | null; acceptedReadAt: Timestamp | null;
};
export type FriendNotification = { id: string; relationship: Friendship; actorId: string; name: string; avatar: CharacterId | null; kind: 'request' | 'accepted'; unread: boolean; at: Timestamp | null };
export const friendshipId = (a: string, b: string) => [a, b].sort().join(':');
export const friendshipsRef = () => collection(db, 'friendships');
export const friendshipRef = (a: string, b: string) => doc(friendshipsRef(), friendshipId(a, b));
export function friendIdentity(friendship: Friendship, uid: string) {
  return friendship.sender === uid
    ? { uid: friendship.recipient, name: friendship.recipientName, avatar: friendship.recipientAvatar }
    : { uid: friendship.sender, name: friendship.senderName, avatar: friendship.senderAvatar };
}
export function friendNotifications(relationships: Friendship[], uid: string): FriendNotification[] {
  return relationships.flatMap<FriendNotification>(r => r.recipient === uid
    ? [{ id: `request:${r.id}`, relationship: r, actorId: r.sender, name: r.senderName, avatar: r.senderAvatar, kind: 'request', unread: !r.requestReadAt, at: r.createdAt }]
    : r.status === 'accepted' && r.sender === uid
      ? [{ id: `accepted:${r.id}`, relationship: r, actorId: r.recipient, name: r.recipientName, avatar: r.recipientAvatar, kind: 'accepted', unread: !r.acceptedReadAt, at: r.updatedAt }] : [])
    .sort((a, b) => (b.at?.toMillis() ?? 0) - (a.at?.toMillis() ?? 0) || a.id.localeCompare(b.id));
}

export function sendFriendRequest(uid: string, profile: FriendIdentity, targetUid: string, target: FriendIdentity) {
  if (uid === targetUid) return Promise.reject(new Error('나에게는 친구 신청을 보낼 수 없어요.'));
  return runTransaction(db, async tx => {
    const ref = friendshipRef(uid, targetUid);
    const before = await tx.get(ref);
    if (before.exists()) throw new Error(before.data().status === 'accepted' ? '이미 친구예요.' : '이미 진행 중인 친구 신청이 있어요.');
    tx.set(ref, { members: [uid, targetUid].sort(), sender: uid, recipient: targetUid, status: 'pending',
      senderName: displayName(profile), senderAvatar: profile.avatar ?? null,
      recipientName: displayName(target), recipientAvatar: target.avatar ?? null,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(), requestReadAt: null, acceptedReadAt: null });
  });
}
export function acceptFriendRequest(uid: string, profile: Pick<Profile, 'username' | 'nickname' | 'avatar'>, id: string) {
  return runTransaction(db, async tx => {
    const ref = doc(friendshipsRef(), id);
    const snapshot = await tx.get(ref);
    const r = snapshot.data() as Friendship | undefined;
    if (!r || r.recipient !== uid || r.status !== 'pending') throw new Error('이미 처리되었거나 취소된 친구 신청이에요.');
    tx.update(ref, { status: 'accepted', recipientName: displayName(profile), recipientAvatar: profile.avatar ?? null,
      updatedAt: serverTimestamp(), requestReadAt: serverTimestamp() });
  });
}
/** Reject, cancel or remove. A transaction avoids deleting a newly changed request by accident. */
export function removeFriendship(uid: string, friendship: Friendship) {
  return runTransaction(db, async tx => {
    const ref = doc(friendshipsRef(), friendship.id);
    const snapshot = await tx.get(ref);
    if (!snapshot.exists()) return;
    const current = snapshot.data() as Friendship;
    if (!current.members.includes(uid) || current.status !== friendship.status) throw new Error('친구 상태가 바뀌었어요. 다시 확인해주세요.');
    tx.delete(ref);
  });
}
export function readFriendNotification(uid: string, notification: FriendNotification) {
  const key = notification.relationship.recipient === uid ? 'requestReadAt' : 'acceptedReadAt';
  return updateDoc(doc(friendshipsRef(), notification.relationship.id), { [key]: serverTimestamp() });
}
export async function readAllFriendNotifications(uid: string, notifications: FriendNotification[]) {
  const unread = notifications.filter(n => n.unread);
  for (let i = 0; i < unread.length; i += 400) {
    const batch = writeBatch(db);
    unread.slice(i, i + 400).forEach(n => batch.update(doc(friendshipsRef(), n.relationship.id), { [n.relationship.recipient === uid ? 'requestReadAt' : 'acceptedReadAt']: serverTimestamp() }));
    await batch.commit();
  }
}
