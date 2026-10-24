import { useCatalog } from '@/providers/catalog-provider';
import { FlatList } from '@/components/refreshable';
import { Stack, router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { AvatarFace } from '@/components/avatar-face';
import { FriendActions } from '@/components/friend-actions';
import { useColors } from '@/hooks/use-colors';
import { useListWindow } from '@/hooks/use-list-window';
import { readAllFriendNotifications, readFriendNotification, type FriendNotification } from '@/lib/friends';
import { useFriends } from '@/providers/friends-provider';
import { useSession } from '@/providers/session-provider';

export default function NotificationsScreen() {
  useCatalog();
  const c = useColors();
  const { user } = useSession();
  const { notifications, unread, loading, failed } = useFriends();
  const [busy, setBusy] = useState(false);
  const page = useListWindow(notifications, user?.uid ?? '');
  async function readAll() {
    if (!user || busy) return;
    setBusy(true);
    try { await readAllFriendNotifications(user.uid, notifications); }
    catch { Alert.alert('읽음 처리하지 못했어요', '연결 상태를 확인하고 다시 시도해주세요.'); }
    finally { setBusy(false); }
  }
  async function open(n: FriendNotification) {
    if (!user) return;
    try { if (n.unread) await readFriendNotification(user.uid, n); }
    catch { Alert.alert('읽음 처리하지 못했어요', '잠시 후 다시 시도해주세요.'); return; }
    router.push({ pathname: '/player/[uid]', params: { uid: n.actorId } });
  }
  return <View style={{ flex: 1, backgroundColor: c.background }}>
    <Stack.Screen options={{ title: '알림', headerShown: true, headerTintColor: c.text, headerStyle: { backgroundColor: c.background } }} />
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 10 }}>
      <Text style={{ color: c.secondary }}>읽지 않은 알림 {unread}개</Text>
      <Pressable accessibilityRole="button" disabled={!unread || busy} onPress={readAll} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 10, opacity: unread ? 1 : 0.5 }}><Text style={{ color: c.primary, fontWeight: '700' }}>{busy ? '처리 중…' : '모두 읽음'}</Text></Pressable>
    </View>
    <FlatList data={page.data} onEndReached={page.loadMore} onEndReachedThreshold={0.4} maxToRenderPerBatch={12} windowSize={5} keyExtractor={n => n.id} initialNumToRender={12} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 12 }}
      ListEmptyComponent={<Text style={{ color: c.secondary, textAlign: 'center', paddingVertical: 48 }}>{failed ? '알림을 불러오지 못했어요. 연결 상태를 확인해주세요.' : loading ? '알림을 확인하고 있어요…' : '새로운 알림이 없어요.'}</Text>}
      renderItem={({ item: n }) => <View style={{ padding: 16, gap: 12, borderRadius: 20, backgroundColor: n.unread ? `${c.primary}12` : c.surface }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${n.name}님 ${n.kind === 'accepted' ? '친구 수락' : '친구 신청'}${n.unread ? ', 읽지 않음' : ''}`} onPress={() => open(n)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 }}>
          <AvatarFace avatar={n.avatar} size={44} fallback={n.name} />
          <View style={{ flex: 1, gap: 5 }}><Text style={{ color: c.text, lineHeight: 21, fontWeight: n.unread ? '800' : '500' }}>{n.name}님이 {n.kind === 'accepted' ? '친구 신청을 수락했어요.' : n.relationship.status === 'accepted' ? '함께하는 친구가 되었어요.' : '친구 신청을 보냈어요.'}</Text>
            {n.at && <Text style={{ color: c.secondary, fontSize: 12 }}>{n.at.toDate().toLocaleString('ko-KR')}</Text>}
          </View>
          {n.unread && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' }} />}
        </Pressable>
        {n.kind === 'request' && n.relationship.status === 'pending' && <FriendActions targetUid={n.actorId} target={{ username: n.name, avatar: n.avatar }} />}
      </View>} />
  </View>;
}
