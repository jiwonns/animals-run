import { Stack, router, type Href } from 'expo-router';
import { NotificationBell } from '@/components/notification-bell';
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AvatarFace } from '@/components/avatar-face';
import { EggView } from '@/components/home/egg-view';
import { HatchShow } from '@/components/home/hatch-show';
import { Icon, ICONS } from '@/components/icon';
import { IconTile } from '@/components/icon-tile';
import { CoinToken } from '@/components/coin-badge';
import { TICKET_COLOR } from '@/components/ticket-badge';
import { CHARACTER_BY_ID, CHARACTERS, GRADES } from '@/constants/characters';
import { REWARDS } from '@/constants/gacha.generated';
import { useAchievements } from '@/hooks/use-achievements';
import { useColors } from '@/hooks/use-colors';
import { useConfirmExit } from '@/hooks/use-confirm-exit';
import { useCompanionSteps, useEggs, useNow } from '@/hooks/use-home';
import { evolutionSteps, RECYCLE_COUNT } from '@/lib/craft';
import {
  EGG_SLOTS,
  hatchAt,
  hatchEgg,
  HomeError,
  skipCost,
  type Egg,
  type EggSlot,
} from '@/lib/home';
import { useSession } from '@/providers/session-provider';

type Hatching = { key: number; egg: Egg; saved: boolean; isNew: boolean };

/** Shortcuts to other tabs; navigate() switches the tab bar selection too. Null href is not built yet. */
const SHORTCUTS: { label: string; icon: keyof typeof ICONS; tint: string; href: Href | null }[] = [
  { label: '커뮤니티', icon: 'community', tint: '#6366F1', href: '/community' },
  { label: '지도', icon: 'map', tint: '#10B981', href: '/manage' },
  { label: '뽑기', icon: 'gift', tint: '#FF5A1F', href: '/gacha' },
  { label: '도감', icon: 'dex', tint: '#3B82F6', href: '/collection/dex' },
  { label: '보관함', icon: 'archive', tint: '#F59E0B', href: '/collection' },
  { label: '친구', icon: 'people', tint: '#10B981', href: '/friends' },
];

function formatLeft(ms: number) {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export default function HomeScreen() {
  const colors = useColors();
  useConfirmExit();
  const { user, profile } = useSession();
  const eggs = useEggs();
  const companion = useCompanionSteps();
  const now = useNow();
  const { claimable } = useAchievements();
  const [hatching, setHatching] = useState<Hatching | null>(null);

  const filled = EGG_SLOTS.filter((slot) => eggs?.[slot]).length;
  const nestFull = eggs !== null && filled === EGG_SLOTS.length;
  const avatar = profile?.avatar ?? null;
  const avatarSteps = avatar ? (companion[avatar] ?? 0) : 0;
  const avatarGoal = avatar ? evolutionSteps(avatar) : undefined;
  const evolvable = CHARACTERS.filter((c) => {
    const goal = evolutionSteps(c.id);
    return (profile?.characters[c.id] ?? 0) > 0 && goal !== undefined && (companion[c.id] ?? 0) >= goal;
  }).length;

  async function hatch(slot: EggSlot, egg: Egg) {
    if (!user || !profile || hatching) return;
    const cost = skipCost(egg, now);
    if (cost > profile.coins) {
      Alert.alert('코인이 부족해요', `바로 부화하려면 ${cost}코인이 필요해요.`);
      return;
    }
    const start = async () => {
      const key = Date.now();
      setHatching({ key, egg, saved: false, isNew: (profile.characters[egg.child] ?? 0) === 0 });
      try {
        await hatchEgg(user.uid, slot);
        setHatching((h) => (h?.key === key ? { ...h, saved: true } : h));
      } catch (error) {
        setHatching(null);
        Alert.alert(
          '부화하지 못했어요',
          error instanceof HomeError ? error.message : '남은 시간이 바뀌었을 수 있어요. 잠시 후 다시 시도해주세요.',
        );
      }
    };
    if (cost === 0) {
      start();
      return;
    }
    Alert.alert('바로 부화할까요?', `${cost}코인을 사용해요.`, [
      { text: '취소', style: 'cancel' },
      { text: '부화하기', onPress: start },
    ]);
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}>
      <Stack.Screen options={{ headerRight: () => <NotificationBell /> }} />
      <View style={styles.shortcuts}>
        {SHORTCUTS.map((item) => (
          <Pressable
            key={item.label}
            accessibilityRole="button"
            accessibilityState={{ disabled: !item.href }}
            onPress={() => {
              if (item.href) router.navigate(item.href);
              else Alert.alert('준비 중이에요', `${item.label}은(는) 곧 열려요.`);
            }}
            style={({ pressed }) => [styles.shortcut, pressed && styles.pressed]}>
            <IconTile name={ICONS[item.icon]} color={item.tint} />
            <Text style={[styles.shortcutLabel, { color: item.href ? colors.text : colors.secondary }]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {claimable.length > 0 && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`받지 않은 업적 보상 ${claimable.length}개, 업적 보러 가기`}
          onPress={() => router.navigate('/mypage/achievements')}
          style={({ pressed }) => [styles.notice, { backgroundColor: `${TICKET_COLOR}14` }, pressed && styles.pressed]}>
          <View style={[styles.cardIcon, { backgroundColor: '#F59E0B' }]}>
            <Icon name={ICONS.trophy} size={16} color="#fff" />
          </View>
          <View style={styles.noticeBody}>
            <Text style={[styles.noticeTitle, { color: colors.text }]}>
              받지 않은 업적 보상이 {claimable.length}개 있어요
            </Text>
            <Text style={[styles.noticeSub, { color: TICKET_COLOR }]}>
              뽑기권 {claimable.reduce((sum, r) => sum + r.tickets, 0)}장 받으러 가기
            </Text>
          </View>
          <Icon name={ICONS.chevron} size={16} color={colors.secondary} />
        </Pressable>
      )}

      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.cardIcon, { backgroundColor: '#F472B6' }]}>
            <Icon name={ICONS.heart} size={16} color="#fff" />
          </View>
          <Text style={[styles.cardTitle, { color: colors.text }]}>교배장</Text>
          <Text style={[styles.count, { color: colors.secondary }]}>
            {filled}/{EGG_SLOTS.length}
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={nestFull}
            onPress={() => router.push('/breed')}
            style={({ pressed }) => [
              styles.smallButton,
              { backgroundColor: nestFull ? colors.border : colors.primary },
              pressed && styles.pressed,
            ]}>
            <Text style={styles.smallButtonLabel}>{nestFull ? '가득 참' : '교배하기'}</Text>
          </Pressable>
        </View>

        <View style={styles.nest}>
          {EGG_SLOTS.map((slot) => {
            const egg = eggs?.[slot];
            if (!egg) {
              return (
                <Pressable
                  key={slot}
                  accessibilityRole="button"
                  accessibilityLabel="빈 자리, 교배하기"
                  disabled={eggs === null}
                  onPress={() => router.push('/breed')}
                  style={({ pressed }) => [
                    styles.slot,
                    styles.emptySlot,
                    { borderColor: colors.border, backgroundColor: colors.background },
                    pressed && styles.pressed,
                  ]}>
                  <Icon name={ICONS.plus} size={22} color={colors.secondary} />
                  <Text style={[styles.slotHint, { color: colors.secondary }]}>빈 자리</Text>
                </Pressable>
              );
            }
            const left = hatchAt(egg, now) - now;
            const ready = left <= 0;
            const cost = skipCost(egg, now);
            const grade = GRADES[egg.grade];
            return (
              <View key={slot} style={[styles.slot, { backgroundColor: colors.background }]}>
                <EggView grade={egg.grade} size={46} state={ready ? 'ready' : 'idle'} />
                <Text style={[styles.slotGrade, { color: grade.color }]}>{grade.label} 알</Text>
                <Text style={[styles.slotTime, { color: ready ? colors.primary : colors.text }]}>
                  {ready ? '부화 가능' : formatLeft(left)}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  disabled={!!hatching}
                  onPress={() => hatch(slot, egg)}
                  style={({ pressed }) => [
                    styles.hatchButton,
                    ready ? { backgroundColor: colors.primary } : { backgroundColor: colors.surface },
                    pressed && styles.pressed,
                  ]}>
                  {ready ? (
                    <Text style={styles.hatchLabel}>부화하기</Text>
                  ) : (
                    <View style={styles.skipRow}>
                      <CoinToken size={16} />
                      <Text style={[styles.skipLabel, { color: colors.text }]}>{cost}</Text>
                    </View>
                  )}
                </Pressable>
              </View>
            );
          })}
        </View>
        <Text style={[styles.note, { color: colors.secondary }]}>
          두 마리를 골라 알을 받아요. 부모는 그대로 남고, 남은 시간 1분당 {REWARDS.breeding.coinsPerMinute}코인으로
          바로 부화할 수 있어요.
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.cardIcon, { backgroundColor: '#22C55E' }]}>
            <Icon name={ICONS.walk} size={16} color="#fff" />
          </View>
          <Text style={[styles.cardTitle, { color: colors.text }]}>함께 걷기</Text>
        </View>
        {avatar ? (
          <View style={styles.companion}>
            <AvatarFace avatar={avatar} size={56} fallback="" />
            <View style={styles.companionBody}>
              <View style={styles.companionTop}>
                <Text style={[styles.companionName, { color: colors.text }]}>{CHARACTER_BY_ID[avatar].name}</Text>
                {avatarGoal !== undefined && avatarSteps >= avatarGoal && (
                  <View style={[styles.evolveBadge, { backgroundColor: '#8B5CF6' }]}>
                    <Text style={styles.evolveBadgeLabel}>진화 가능</Text>
                  </View>
                )}
              </View>
              {avatarGoal !== undefined ? (
                <>
                  <View style={[styles.track, { backgroundColor: colors.border }]}>
                    <View
                      style={[
                        styles.bar,
                        { width: `${Math.min(1, avatarSteps / avatarGoal) * 100}%`, backgroundColor: '#22C55E' },
                      ]}
                    />
                  </View>
                  <Text style={[styles.companionSteps, { color: colors.secondary }]}>
                    {Math.min(avatarSteps, avatarGoal).toLocaleString()} / {avatarGoal.toLocaleString()}걸음
                  </Text>
                </>
              ) : (
                <Text style={[styles.companionSteps, { color: colors.secondary }]}>
                  {avatarSteps.toLocaleString()}걸음 · 이 등급은 아직 진화할 수 없어요
                </Text>
              )}
            </View>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.navigate('/mypage/avatar')}
            style={({ pressed }) => [styles.companion, pressed && styles.pressed]}>
            <Text style={[styles.companionSteps, { color: colors.secondary }]}>
              대표 동물을 정하면 함께 걸은 걸음이 쌓여요 ›
            </Text>
          </Pressable>
        )}
      </View>

      <View style={styles.tiles}>
        {(
          [
            { label: '재활용', sub: `동물 ${RECYCLE_COUNT}마리 → 1마리`, icon: ICONS.recycle, tint: '#0EA5E9', href: '/recycle' },
            { label: '합성', sub: '같은 등급 2마리 → 상위 등급', icon: ICONS.fusion, tint: '#F59E0B', href: '/fuse' },
            { label: '진화', sub: '걸음을 채운 동물을 진화', icon: ICONS.evolve, tint: '#8B5CF6', href: '/evolve', badge: evolvable },
          ] as const
        ).map((tile) => (
          <Pressable
            key={tile.label}
            accessibilityRole="button"
            onPress={() => router.push(tile.href)}
            style={({ pressed }) => [styles.tile, { backgroundColor: colors.surface }, pressed && styles.pressed]}>
            <View style={[styles.tileIcon, { backgroundColor: tile.tint }]}>
              <Icon name={tile.icon} size={20} color="#fff" />
            </View>
            <Text style={[styles.tileLabel, { color: colors.text }]}>{tile.label}</Text>
            <Text style={[styles.tileSub, { color: colors.secondary }]} numberOfLines={2}>
              {tile.sub}
            </Text>
            {'badge' in tile && !!tile.badge && (
              <View style={[styles.tileBadge, { backgroundColor: tile.tint }]}>
                <Text style={styles.tileBadgeLabel}>{tile.badge}</Text>
              </View>
            )}
          </Pressable>
        ))}
      </View>

      <Modal
        visible={!!hatching}
        transparent
        statusBarTranslucent
        navigationBarTranslucent
        animationType="fade"
        onRequestClose={() => {
          if (hatching?.saved) setHatching(null);
        }}>
        {hatching && (
          <HatchShow
            key={hatching.key}
            egg={hatching.egg}
            saved={hatching.saved}
            isNew={hatching.isNew}
            onClose={() => setHatching(null)}
          />
        )}
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    gap: 16,
  },
  shortcuts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  shortcut: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  shortcutIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  noticeBody: {
    flex: 1,
    gap: 2,
  },
  noticeTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  noticeSub: {
    fontSize: 13,
    fontWeight: '700',
  },
  card: {
    borderRadius: 20,
    padding: 16,
    gap: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  count: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  smallButton: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  smallButtonLabel: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  nest: {
    flexDirection: 'row',
    gap: 10,
  },
  slot: {
    flex: 1,
    borderRadius: 16,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 6,
    gap: 4,
    minHeight: 160,
  },
  emptySlot: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    justifyContent: 'center',
  },
  slotHint: {
    fontSize: 12,
    fontWeight: '600',
  },
  slotGrade: {
    fontSize: 12,
    fontWeight: '800',
    marginTop: 6,
  },
  slotTime: {
    fontSize: 14,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  hatchButton: {
    alignSelf: 'stretch',
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  hatchLabel: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  skipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  coin: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFC531',
    borderWidth: 2,
    borderColor: '#E8A300',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinLabel: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '900',
  },
  skipLabel: {
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  note: {
    fontSize: 12,
    lineHeight: 17,
  },
  companion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  companionBody: {
    flex: 1,
    gap: 6,
  },
  companionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  companionName: {
    fontSize: 16,
    fontWeight: '800',
  },
  evolveBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  evolveBadgeLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: 4,
  },
  companionSteps: {
    fontSize: 13,
    fontWeight: '600',
  },
  tiles: {
    flexDirection: 'row',
    gap: 10,
  },
  tile: {
    flex: 1,
    borderRadius: 18,
    padding: 12,
    gap: 4,
  },
  tileIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  tileLabel: {
    fontSize: 15,
    fontWeight: '800',
  },
  tileSub: {
    fontSize: 11,
    lineHeight: 15,
    minHeight: 30,
  },
  soon: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 4,
  },
  soonLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  tileBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileBadgeLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.7,
  },
});
