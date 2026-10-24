import { useCatalog } from '@/providers/catalog-provider';
import { ScrollView } from '@/components/refreshable';
import { router, type Href } from 'expo-router';
import { Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Icon, ICONS } from '@/components/icon';
import { useColors } from '@/hooks/use-colors';
import { useSession } from '@/providers/session-provider';
import { useWalk } from '@/providers/walk-provider';
import { useAdministrator } from '@/lib/admin-catalog';

export default function SettingsScreen() {
  useCatalog();
  const colors = useColors();
  const { profile } = useSession();
  const administrator = useAdministrator();
  const { foregroundOnly, setForegroundOnly, backgroundSupported } = useWalk();

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
          <Text style={[styles.rowLabel, { color: colors.text }]}>앱을 닫아도 걸음 기록</Text>
          <Switch
            value={backgroundSupported && !foregroundOnly}
            disabled={!backgroundSupported}
            onValueChange={on => setForegroundOnly(!on)}
            trackColor={{ true: colors.primary }}
            thumbColor={Platform.OS === 'android' ? '#fff' : undefined}
          />
        </View>
      </View>
      <Text style={[styles.caption, { color: colors.secondary }]}>
        {backgroundSupported
          ? '앱을 닫거나 화면을 꺼도 걸음을 기록해요. 다음에 앱을 열면 자동 로그인하고 걸음과 코인을 반영해요. Android에서는 걸음 기록 알림이 표시돼요. 끄면 앱을 보고 있을 때만 기록해요.'
          : '이 기기에서는 앱을 열어둔 동안의 걸음만 기록할 수 있어요.'}
      </Text>

      {administrator.allowed && <Pressable accessibilityRole="button" onPress={() => router.push('/admin')} style={[styles.group, { backgroundColor: colors.surface, padding: 18, minHeight: 52 }]}><Text style={{ color: colors.primary, fontWeight: '800' }}>뽑기 관리자 페이지</Text></Pressable>}
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
