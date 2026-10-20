import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import { useFriends } from '@/providers/friends-provider';
import { Icon, ICONS } from './icon';

export function NotificationBell() {
  const c = useColors();
  const { unread } = useFriends();
  return <Pressable accessibilityRole="button" accessibilityLabel={unread ? `알림, 읽지 않은 알림 ${unread}개` : '알림'} onPress={() => router.push('/notifications')}
    style={({ pressed }) => ({ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
    <Icon name={ICONS.bell} size={24} color={c.text} />
    {unread > 0 && <View style={{ position: 'absolute', top: 8, right: 8, width: 9, height: 9, borderRadius: 5, backgroundColor: '#EF4444', borderWidth: 1.5, borderColor: c.background }} />}
  </Pressable>;
}
