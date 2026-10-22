import { router, type Href } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AvatarFace } from '@/components/avatar-face';
import { BondCard } from '@/components/bond-card';
import { EquippedMedal } from '@/components/medal-showcase';
import { useMedalShowcase } from '@/hooks/use-medal-showcase';
import { Icon, ICONS } from '@/components/icon';
import { TICKET_COLOR } from '@/components/ticket-badge';
import { CHARACTERS } from '@/constants/characters';
import { useAchievements } from '@/hooks/use-achievements';
import { useColors } from '@/hooks/use-colors';
import { useConfirmExit } from '@/hooks/use-confirm-exit';
import { signOut } from '@/lib/auth';
import { displayName } from '@/lib/profile';
import { mapProfileRoute } from '@/lib/map-profile-route';
import { useSession } from '@/providers/session-provider';

const MENU: { label: string; href: Href; icon: keyof typeof ICONS; tint: string }[] = [
  { label: '친구', href: '/friends', icon: 'people', tint: '#10B981' },
  { label: '알림', href: '/notifications', icon: 'bell', tint: '#F59E0B' },
  { label: '랭킹', href: '/mypage/ranking', icon: 'ranking', tint: '#8B5CF6' },
  { label: '업적', href: '/mypage/achievements', icon: 'trophy', tint: '#F59E0B' },
  { label: '뽑기 기록', href: '/mypage/history', icon: 'history', tint: '#3B82F6' },
  { label: '환경설정', href: '/mypage/settings', icon: 'settings', tint: '#8E8E93' },
  { label: '이용약관', href: '/mypage/terms', icon: 'terms', tint: '#64748B' },
];

const AVATAR_SIZE = 92;

export default function MyPageScreen() {
  const colors = useColors();
  useConfirmExit();
  const { user, profile } = useSession();
  const showcase = useMedalShowcase(user?.uid);
  const { claimable } = useAchievements();
  const name = profile ? displayName(profile) : '';
  const owned = CHARACTERS.filter((c) => (profile?.characters[c.id] ?? 0) > 0).length;

  const stats = [
    { label: '보유 동물', value: `${owned}종` },
    { label: '뽑기 횟수', value: (profile?.drawCount ?? 0).toLocaleString() },
    { label: '총 걸음', value: (profile?.steps ?? 0).toLocaleString() },
  ];
  const wallet = [
    { label: '코인', value: profile?.coins ?? 0, mark: 'C', markStyle: styles.coinMark },
    { label: '뽑기권', value: profile?.tickets ?? 0, mark: 'T', markStyle: styles.ticketMark },
  ];

  function confirmSignOut() {
    Alert.alert('로그아웃', '로그아웃할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '로그아웃', style: 'destructive', onPress: signOut },
    ]);
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}>
      <View style={[styles.hero, { backgroundColor: colors.surface }]}>
        <View style={styles.heroTop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="내 프로필 보기"
            onPress={() => user && router.push(mapProfileRoute(user.uid,user.uid))}
            style={({ pressed }) => pressed && { opacity: 0.8 }}>
            <AvatarFace avatar={profile?.avatar} size={AVATAR_SIZE} fallback={name} />
            <View style={[styles.edit, { backgroundColor: colors.primary, borderColor: colors.surface }]}>
              <Text style={styles.editLabel}>프로필</Text>
            </View>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="내 프로필 상세 보기"
            onPress={() => user && router.push(mapProfileRoute(user.uid,user.uid))}
            style={({ pressed }) => [styles.names, pressed && { opacity: 0.6 }]}>
            <View style={styles.nameRow}>
              <Text style={[styles.userId, { color: colors.text }]} numberOfLines={1}>
                {name}
              </Text>
              <Icon name={ICONS.chevron} size={15} color={colors.secondary} />
            </View>
            {profile?.nickname && (
              <Text style={[styles.loginId, { color: colors.secondary }]} numberOfLines={1}>
                @{profile.username}
              </Text>
            )}
          </Pressable>
        </View>

        <EquippedMedal showcase={showcase} />
        <View style={{flexDirection:'row',gap:12,flexWrap:'wrap'}}>{([{label:'대표 동물 변경',href:'/mypage/avatar'},{label:'닉네임 변경',href:'/mypage/change-nickname'}] as const).map(item=><Pressable key={item.href} accessibilityRole="button" onPress={()=>router.push(item.href)} style={{minHeight:44,justifyContent:'center',paddingHorizontal:12,borderRadius:12,backgroundColor:colors.background}}><Text style={{color:colors.primary,fontWeight:'700'}}>{item.label}</Text></Pressable>)}</View>
        <View style={[styles.stats, { borderColor: colors.border }]}>
          {stats.map((stat, index) => (
            <View
              key={stat.label}
              style={[styles.stat, index > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderColor: colors.border }]}>
              <Text style={[styles.statValue, { color: colors.text }]}>{stat.value}</Text>
              <Text style={[styles.statLabel, { color: colors.secondary }]}>{stat.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <BondCard />
      <View style={styles.wallet}>
        {wallet.map((item) => (
          <View key={item.label} style={[styles.walletCard, { backgroundColor: colors.surface }]}>
            <View style={item.markStyle}>
              <Text style={styles.markLabel}>{item.mark}</Text>
            </View>
            <View>
              <Text style={[styles.walletLabel, { color: colors.secondary }]}>{item.label}</Text>
              <Text style={[styles.walletValue, { color: colors.text }]}>{item.value.toLocaleString()}</Text>
            </View>
          </View>
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.navigate({ pathname: '/collection', params: { section: 'medals' } })}
        style={({ pressed }) => [styles.menu, styles.row, { backgroundColor: colors.surface }, pressed && { opacity: 0.6 }]}>
        <View style={[styles.rowIcon, { backgroundColor: '#F59E0B' }]}>
          <Icon name={ICONS.grade} size={17} color="#fff" />
        </View>
        <Text style={[styles.rowLabel, { color: colors.text }]}>훈장 장착하러 가기</Text>
        <Icon name={ICONS.chevron} size={16} color={colors.secondary} />
      </Pressable>
      <View style={[styles.menu, { backgroundColor: colors.surface }]}>
        {MENU.map((item, index) => (
          <Pressable
            key={item.label}
            accessibilityRole="button"
            onPress={() => router.push(item.href)}
            style={({ pressed }) => [
              styles.row,
              index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
              pressed && { opacity: 0.6 },
            ]}>
            <View style={[styles.rowIcon, { backgroundColor: item.tint }]}>
              <Icon name={ICONS[item.icon]} size={17} color="#fff" />
            </View>
            <Text style={[styles.rowLabel, { color: colors.text }]}>{item.label}</Text>
            {item.href === '/mypage/achievements' && claimable.length > 0 && (
              <View style={[styles.pending, { backgroundColor: TICKET_COLOR }]}>
                <Text style={styles.pendingLabel}>받을 보상 {claimable.length}</Text>
              </View>
            )}
            <Icon name={ICONS.chevron} size={16} color={colors.secondary} />
          </Pressable>
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={confirmSignOut}
        style={({ pressed }) => [
          styles.menu,
          styles.row,
          { backgroundColor: colors.surface },
          pressed && { opacity: 0.6 },
        ]}>
        <View style={[styles.rowIcon, { backgroundColor: colors.danger }]}>
          <Icon name={ICONS.logout} size={17} color="#fff" />
        </View>
        <Text style={[styles.rowLabel, { color: colors.danger }]}>로그아웃</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    gap: 16,
  },
  hero: {
    borderRadius: 20,
    padding: 20,
    gap: 18,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  edit: {
    position: 'absolute',
    right: -4,
    bottom: -2,
    borderRadius: 999,
    borderWidth: 2,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  editLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  names: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userId: {
    flexShrink: 1,
    fontSize: 22,
    fontWeight: '800',
  },
  loginId: {
    fontSize: 13,
    fontWeight: '600',
  },
  stats: {
    flexDirection: 'row',
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontSize: 17,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  wallet: {
    flexDirection: 'row',
    gap: 12,
  },
  walletCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
  },
  coinMark: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFC531',
    borderWidth: 3,
    borderColor: '#E8A300',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ticketMark: {
    width: 36,
    height: 28,
    borderRadius: 6,
    backgroundColor: TICKET_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
  walletLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  walletValue: {
    fontSize: 18,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  menu: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
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
  pending: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  pendingLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});
