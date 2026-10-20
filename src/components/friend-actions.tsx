import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import { acceptFriendRequest, removeFriendship, sendFriendRequest, type FriendIdentity } from '@/lib/friends';
import { useFriends } from '@/providers/friends-provider';
import { useSession } from '@/providers/session-provider';

export function FriendActions({ targetUid, target }: { targetUid: string; target: FriendIdentity }) {
  const c = useColors();
  const { user, profile } = useSession();
  const { relationships, loading, failed } = useFriends();
  const [busy, setBusy] = useState(false);
  const relationship = relationships.find(r => r.members.includes(targetUid));
  if (!user || user.uid === targetUid) return null;
  async function run(action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    try { await action(); }
    catch { Alert.alert('친구 상태를 변경하지 못했어요', '상대가 신청을 처리했거나 연결이 끊겼을 수 있어요. 목록을 확인하고 다시 시도해주세요.'); }
    finally { setBusy(false); }
  }
  function remove() {
    if (!relationship || !user) return;
    const r = relationship;
    Alert.alert('친구를 삭제할까요?', '서로의 친구 목록에서 삭제되고, 친구에게만 공유하는 위치도 볼 수 없게 돼요.', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => run(() => removeFriendship(user.uid, r)) },
    ]);
  }
  const disabled = busy || loading || failed || !profile;
  const button = (label: string, action: () => void, secondary = false) => <Pressable key={label} accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={action}
    style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, justifyContent: 'center', backgroundColor: secondary ? c.border : c.primary, opacity: disabled || pressed ? 0.6 : 1 })}>
    <Text style={{ color: secondary ? c.text : '#fff', fontWeight: '700' }}>{busy ? '처리 중…' : label}</Text>
  </Pressable>;
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
    {failed ? <Text style={{ color: c.secondary }}>친구 정보를 불러오지 못했어요.</Text> : loading ? <Text style={{ color: c.secondary }}>친구 확인 중…</Text>
      : !relationship ? button('친구 신청', () => { if (profile) void run(() => sendFriendRequest(user.uid, profile, targetUid, target)); })
      : relationship.status === 'accepted' ? button('친구 · 삭제', remove, true)
      : relationship.recipient === user.uid ? <>
        {button('친구 수락', () => { if (profile) void run(() => acceptFriendRequest(user.uid, profile, relationship.id)); })}
        {button('거절', () => { void run(() => removeFriendship(user.uid, relationship)); }, true)}
      </> : button('신청 취소', () => { void run(() => removeFriendship(user.uid, relationship)); }, true)}
  </View>;
}
