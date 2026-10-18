import { router, type Href } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { Icon, ICONS } from '@/components/icon';
import { useColors } from '@/hooks/use-colors';
import { useSession } from '@/providers/session-provider';
import { useWalk } from '@/providers/walk-provider';

export default function SettingsScreen() {
  const colors = useColors();
  const { profile } = useSession();
  const { foregroundOnly, setForegroundOnly } = useWalk();

  const accountRows: { label: string; value?: string; href: Href; icon: keyof typeof ICONS; tint: string }[] = [
    { label: '닉네임 변경', value: profile?.nickname, href: '/mypage/change-nickname', icon: 'nickname', tint: '#F97316' },
    { label: '아이디 변경', value: profile?.username, href: '/mypage/change-username', icon: 'person', tint: '#3B82F6' },
    { label: '비밀번호 변경', href: '/mypage/change-password', icon: 'key', tint: '#8E8E93' },
  ];

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}>
      <Text style={[styles.sectionLabel, { color: colors.secondary }]}>걸음</Text>
      <View style={[styles.group, { backgroundColor: colors.surface }]}>
        <View style={styles.row}>
          <View style={[styles.rowIcon, { backgroundColor: '#22C55E' }]}>
            <Icon name={ICONS.walk} size={17} color="#fff" />
          </View>
          <Text style={[styles.rowLabel, { color: colors.text }]}>앱이 켜져 있을 때만 걸음 세기</Text>
          <Switch
            value={foregroundOnly}
            onValueChange={setForegroundOnly}
            trackColor={{ true: colors.primary }}
            thumbColor={Platform.OS === 'android' ? '#fff' : undefined}
          />
        </View>
      </View>
      <Text style={[styles.caption, { color: colors.secondary }]}>
        켜면 앱을 보고 있는 동안 걸은 걸음만 코인으로 바뀌어요. 끄면 앱이 꺼져 있던 동안 걸은 걸음도 다음에 열 때 함께
        세요. 다시 끌 때는 켜 둔 동안 앱 밖에서 걸은 걸음은 세지 않아요.
      </Text>

      <Text style={[styles.sectionLabel, { color: colors.secondary }]}>계정</Text>
      <View style={[styles.group, { backgroundColor: colors.surface }]}>
        {accountRows.map((row, index) => (
          <Pressable
            key={row.label}
            accessibilityRole="button"
            onPress={() => router.push(row.href)}
            style={({ pressed }) => [
              styles.row,
              index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
              pressed && styles.pressed,
            ]}>
            <View style={[styles.rowIcon, { backgroundColor: row.tint }]}>
              <Icon name={ICONS[row.icon]} size={17} color="#fff" />
            </View>
            <Text style={[styles.rowLabel, { color: colors.text }]}>{row.label}</Text>
            {row.value && <Text style={[styles.rowValue, { color: colors.secondary }]}>{row.value}</Text>}
            <Icon name={ICONS.chevron} size={16} color={colors.secondary} />
          </Pressable>
        ))}
      </View>

      <View style={[styles.group, styles.spaced, { backgroundColor: colors.surface }]}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/mypage/delete-account')}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
          <View style={[styles.rowIcon, { backgroundColor: colors.danger }]}>
            <Icon name={ICONS.leave} size={17} color="#fff" />
          </View>
          <Text style={[styles.rowLabel, { color: colors.danger }]}>회원탈퇴</Text>
          <Icon name={ICONS.chevron} size={16} color={colors.secondary} />
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    gap: 8,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
    marginLeft: 4,
  },
  group: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  spaced: {
    marginTop: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 54,
  },
  rowIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  rowValue: {
    fontSize: 14,
  },
  caption: {
    fontSize: 12,
    lineHeight: 17,
    marginHorizontal: 4,
  },
  pressed: {
    opacity: 0.6,
  },
});
