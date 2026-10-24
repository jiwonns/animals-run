import { useCatalog } from '@/providers/catalog-provider';
import { FlatList } from '@/components/refreshable';
import { Stack, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AvatarFace } from '@/components/avatar-face';
import { FriendActions } from '@/components/friend-actions';
import { useColors } from '@/hooks/use-colors';
import { useListWindow } from '@/hooks/use-list-window';
import { friendIdentity } from '@/lib/friends';
import { useFriends } from '@/providers/friends-provider';
import { useSession } from '@/providers/session-provider';

export default function FriendsScreen() {
  useCatalog();
  const c = useColors();
  const { user } = useSession();
  const { friends, incoming, outgoing, loading, failed } = useFriends();
  const [tab, setTab] = useState<'friends' | 'incoming' | 'outgoing'>('friends');
  const rows = (tab === 'friends' ? friends : tab === 'incoming' ? incoming : outgoing)
    .map(r => ({ relationship: r, ...friendIdentity(r, user?.uid ?? '') })).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  const page = useListWindow(rows, `${user?.uid}:${tab}`);
  return <View style={{ flex: 1, backgroundColor: c.background }}>
    <Stack.Screen options={{ title: '친구', headerShown: true, headerTintColor: c.text, headerStyle: { backgroundColor: c.background } }} />
    <View style={{ flexDirection: 'row', gap: 8, padding: 16 }}>
      {([{ id: 'friends', label: '친구', count: friends.length }, { id: 'incoming', label: '받은 신청', count: incoming.length }, { id: 'outgoing', label: '보낸 신청', count: outgoing.length }] as const).map(t =>
        <Pressable key={t.id} accessibilityRole="tab" accessibilityState={{ selected: tab === t.id }} onPress={() => setTab(t.id)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 44, borderRadius: 14, backgroundColor: tab === t.id ? c.primary : c.surface }}>
          <Text style={{ color: tab === t.id ? '#fff' : c.text, fontWeight: '700', fontSize: 13 }}>{t.label} {t.count}</Text>
        </Pressable>)}
    </View>
    <FlatList data={page.data} onEndReached={page.loadMore} onEndReachedThreshold={0.4} maxToRenderPerBatch={12} windowSize={5} keyExtractor={r => r.relationship.id} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 12 }} initialNumToRender={12}
      ListHeaderComponent={failed ? <Text style={{ color: c.secondary }}>친구 목록을 불러오지 못했어요. 연결 상태를 확인해주세요.</Text> : undefined}
      ListEmptyComponent={<Text style={{ color: c.secondary, textAlign: 'center', paddingVertical: 48 }}>{loading ? '친구를 확인하고 있어요…' : failed ? '' : tab === 'friends' ? '지도나 랭킹에서 프로필을 눌러 친구를 만나보세요.' : tab === 'incoming' ? '받은 친구 신청이 없어요.' : '보낸 친구 신청이 없어요.'}</Text>}
      renderItem={({ item }) => <View style={{ padding: 16, backgroundColor: c.surface, borderRadius: 20, gap: 12 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${item.name} 프로필 보기`} onPress={() => router.push({ pathname: '/player/[uid]', params: { uid: item.uid } })} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 }}>
          <AvatarFace avatar={item.avatar} size={48} fallback={item.name} /><Text style={{ color: c.text, flex: 1, fontSize: 16, fontWeight: '800' }}>{item.name}</Text>
        </Pressable>
        <FriendActions targetUid={item.uid} target={{ username: item.name, avatar: item.avatar }} />
      </View>} />
  </View>;
}
