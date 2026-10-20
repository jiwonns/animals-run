import { Image } from '@/components/gacha-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TICKET_COLOR } from '@/components/ticket-badge';
import type { Banner } from '@/constants/banners';
import { GRADES, GRADE_ORDER, type Grade } from '@/constants/characters';
import { useColors } from '@/hooks/use-colors';
import type { DrawResult } from '@/lib/gacha';
import { totalTickets, type Reward } from '@/lib/rewards';

import { GlowPulse, Halo, Sparkles } from './effects';
import { FLIP_MS, FlipCard } from './flip-card';
import { MysteryCard } from './mystery-card';

type Stage = 'charge' | 'open' | 'reveal';

/** Keep the suspense visible even when the server answers instantly. */
const MIN_CHARGE_MS = 1300;
const RUMBLE_MS = 650;
const OPEN_MS = 280;
const DEAL_STAGGER_MS = 45;
const OPEN_ALL_STAGGER_MS = 130;
const REWARD_ROWS = 3;

export function bestGrade(results: DrawResult[]): Grade {
  return results.reduce<Grade>((best, r) => {
    return GRADE_ORDER.indexOf(r.character.grade) > GRADE_ORDER.indexOf(best) ? r.character.grade : best;
  }, 'N');
}

export function DrawShow({ banner, results, rewards, againLabel, againDisabled, onAgain, onClose }: {
  banner: Banner;
  /** null while the server is still rolling. */
  results: DrawResult[] | null;
  rewards: Reward[];
  againLabel: string;
  againDisabled: boolean;
  onAgain: () => void;
  onClose: () => void;
}) {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [stage, setStage] = useState<Stage>('charge');
  const [minDone, setMinDone] = useState(false);
  /** Card index -> flip delay, for every card the player has opened. */
  const [opened, setOpened] = useState<Record<number, number>>({});

  const best = results ? bestGrade(results) : null;
  const ready = results !== null && minDone;
  const multi = (results?.length ?? 0) > 1;
  const closedCount = multi ? results!.length - Object.keys(opened).length : 0;
  const lastFlipAt = Math.max(0, ...Object.values(opened)) + FLIP_MS;

  function openCard(index: number) {
    setOpened((prev) => (index in prev ? prev : { ...prev, [index]: 0 }));
  }

  function openAll() {
    if (!results) return;
    setOpened((prev) => {
      const next = { ...prev };
      let order = 0;
      results.forEach((_, index) => {
        if (!(index in next)) next[index] = order++ * OPEN_ALL_STAGGER_MS;
      });
      return next;
    });
  }
  const tint = ready && best && best !== 'N' ? GRADES[best].color : colors.border;

  useEffect(() => {
    const timer = setTimeout(() => setMinDone(true), MIN_CHARGE_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!ready || stage !== 'charge') return;
    const timer = setTimeout(() => setStage('open'), RUMBLE_MS);
    return () => clearTimeout(timer);
  }, [ready, stage]);

  useEffect(() => {
    if (stage !== 'open') return;
    const timer = setTimeout(() => setStage('reveal'), OPEN_MS);
    return () => clearTimeout(timer);
  }, [stage]);

  function skip() {
    if (ready) setStage('reveal');
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {stage !== 'reveal' && (
        <Pressable accessibilityLabel="건너뛰기" style={styles.stage} onPress={skip}>
          {ready && best !== 'N' && <Halo color={tint} size={width * 0.85} opacity={0.14} />}
          <MysteryCard
            banner={banner}
            width={Math.min(width * 0.44, 190)}
            state={stage === 'open' ? 'open' : ready ? 'rumble' : 'wiggle'}
            tint={tint}
            color={ready && best ? GRADES[best].color : undefined}
            shine={ready && best === 'H'}
            stacked={multi}
          />
          {ready && (
            <Animated.Text entering={FadeIn} style={[styles.skipHint, { bottom: insets.bottom + 40, color: colors.secondary }]}>
              탭해서 바로 열기
            </Animated.Text>
          )}
        </Pressable>
      )}

      {stage === 'reveal' && results && results.length === 1 && <SingleReveal result={results[0]} width={width} />}
      {stage === 'reveal' && results && results.length > 1 && (
        <View style={styles.stage}>
          <MultiReveal
            results={results}
            width={width}
            banner={banner}
            opened={opened}
            onOpen={openCard}
            summaryDelay={closedCount === 0 ? lastFlipAt : null}
          />
        </View>
      )}

      {stage === 'reveal' && results && closedCount > 0 && (
        <Animated.View
          key="open-all"
          entering={FadeInDown.delay(300).duration(300)}
          style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
          <Text style={[styles.openHint, { color: colors.secondary }]}>카드를 눌러 한 장씩 열어보세요</Text>
          <Pressable
            accessibilityRole="button"
            onPress={openAll}
            style={({ pressed }) => [
              styles.openAll,
              { backgroundColor: colors.primary },
              pressed && styles.pressed,
            ]}>
            <Text style={styles.actionLabel}>모두 열기 ({closedCount})</Text>
          </Pressable>
        </Animated.View>
      )}

      {stage === 'reveal' && results && closedCount === 0 && (
        <Animated.View
          key="actions"
          entering={FadeInDown.delay(multi ? lastFlipAt : 600).duration(300)}
          style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
          {rewards.length > 0 && <RewardsPanel rewards={rewards} onOpen={onClose} />}
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={({ pressed }) => [styles.action, { backgroundColor: colors.surface }, pressed && styles.pressed]}>
              <Text style={[styles.actionLabel, { color: colors.text }]}>확인</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={againDisabled}
              onPress={onAgain}
              style={({ pressed }) => [
                styles.action,
                { backgroundColor: colors.primary },
                againDisabled && styles.disabled,
                pressed && styles.pressed,
              ]}>
              <Text style={styles.actionLabel}>한 번 더</Text>
              <Text style={styles.actionCost}>{againLabel}</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

function SingleReveal({ result, width }: { result: DrawResult; width: number }) {
  const colors = useColors();
  const { character, isNew } = result;
  const { color, label } = GRADES[character.grade];
  const rank = GRADE_ORDER.indexOf(character.grade);
  const size = Math.min(width * 0.6, 260);
  const hidden = character.grade === 'H';

  const bob = useSharedValue(0);
  useEffect(() => {
    bob.set(withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => cancelAnimation(bob);
  }, [bob]);
  const bobStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -6 * bob.get() }] }));

  return (
    <View style={styles.stage} pointerEvents="none">
      <View style={[styles.hero, { width: size, height: size }]}>
        <Halo color={rank > 0 ? color : colors.surface} size={size * 1.15} opacity={rank > 0 ? 0.16 : 1} />
        {hidden && (
          <View style={[styles.hiddenGlow, { width: size * 0.95, height: size * 0.95, borderRadius: size }]}>
            <GlowPulse color={color} radius={size} />
          </View>
        )}
        {rank > 0 && <Sparkles color={color} count={8 + rank * 4} radius={size * 0.75} />}
        {hidden && <Sparkles color={color} count={16} radius={size * 1.05} delay={450} seed={9} />}
        <Animated.View entering={ZoomIn.springify().damping(13)} style={bobStyle}>
          <Image source={character.image} style={{ width: size, height: size }} contentFit="contain" />
        </Animated.View>
      </View>

      <Animated.View entering={FadeInDown.delay(250).duration(300)} style={styles.info}>
        <View style={styles.infoRow}>
          <View style={[styles.dot, { backgroundColor: color }]} />
          <Text style={[styles.gradeText, { color }]}>
            {character.grade} {label}
          </Text>
          {isNew && <Text style={styles.newText}>NEW</Text>}
        </View>
        <Text style={[styles.name, { color: colors.text }]}>{character.name}</Text>
      </Animated.View>
    </View>
  );
}

function MultiReveal({ results, width, banner, opened, onOpen, summaryDelay }: {
  results: DrawResult[];
  width: number;
  banner: Banner;
  opened: Record<number, number>;
  onOpen: (index: number) => void;
  /** null until every card is open. */
  summaryDelay: number | null;
}) {
  const colors = useColors();
  const columns = 5;
  const gap = 8;
  const cardWidth = Math.floor((width - 40 - gap * (columns - 1)) / columns);
  const newCount = results.filter((r) => r.isNew).length;
  const counts = GRADE_ORDER.map((grade) => ({
    grade,
    count: results.filter((r) => r.character.grade === grade).length,
  })).filter((g) => g.count > 0);

  return (
    <View style={styles.multi} pointerEvents="box-none">
      <Text style={[styles.multiTitle, { color: colors.secondary }]}>{results.length}회 결과</Text>
      <View style={[styles.grid, { gap }]}>
        {results.map((result, index) => (
          <Animated.View key={index} entering={FadeInDown.delay(index * DEAL_STAGGER_MS).springify().damping(16)}>
            <FlipCard
              result={result}
              width={cardWidth}
              banner={banner}
              open={index in opened}
              delay={opened[index] ?? 0}
              onPress={() => onOpen(index)}
            />
          </Animated.View>
        ))}
      </View>
      <View style={styles.summarySlot}>
        {summaryDelay !== null && (
          <Animated.View entering={FadeIn.delay(summaryDelay)} style={styles.summary}>
            {counts.map(({ grade, count }) => (
              <View key={grade} style={styles.infoRow}>
                <View style={[styles.dot, { backgroundColor: GRADES[grade].color }]} />
                <Text style={[styles.countLabel, { color: colors.text }]}>
                  {grade} {count}
                </Text>
              </View>
            ))}
            {newCount > 0 && <Text style={styles.newText}>NEW {newCount}</Text>}
          </Animated.View>
        )}
      </View>
    </View>
  );
}

function RewardsPanel({ rewards, onOpen }: { rewards: Reward[]; onOpen: () => void }) {
  const colors = useColors();
  return (
    <View style={[styles.rewards, { backgroundColor: colors.surface }]}>
      <Text style={styles.rewardsTitle}>업적 달성 · 뽑기권 +{totalTickets(rewards)}장</Text>
      {rewards.slice(0, REWARD_ROWS).map((reward) => (
        <View key={reward.id} style={styles.rewardRow}>
          <Text style={[styles.rewardLabel, { color: colors.text }]} numberOfLines={1}>
            {reward.label}
          </Text>
          <Text style={styles.rewardTickets}>+{reward.tickets}</Text>
        </View>
      ))}
      {rewards.length > REWARD_ROWS && <Text style={[styles.rewardMore, { color: colors.secondary }]}>외 {rewards.length - REWARD_ROWS}개</Text>}
      <Pressable
        accessibilityRole="button"
        hitSlop={8}
        onPress={() => {
          onOpen();
          router.navigate('/mypage/achievements');
        }}>
        <Text style={styles.rewardLink}>업적에서 받기 ›</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipHint: {
    position: 'absolute',
    alignSelf: 'center',
    fontSize: 13,
    fontWeight: '600',
  },
  hero: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    alignItems: 'center',
    gap: 6,
    marginTop: 24,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  gradeText: {
    fontSize: 14,
    fontWeight: '800',
  },
  newText: {
    color: '#FF6B35',
    fontSize: 13,
    fontWeight: '900',
    marginLeft: 4,
  },
  name: {
    fontSize: 28,
    fontWeight: '800',
  },
  multi: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  multiTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  hiddenGlow: {
    position: 'absolute',
    opacity: 0.3,
  },
  openAll: {
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summarySlot: {
    minHeight: 44,
    justifyContent: 'flex-end',
  },
  openHint: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
  },
  summary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
    marginTop: 20,
  },
  countLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  footer: {
    paddingHorizontal: 20,
    gap: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  action: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  actionCost: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.8,
  },
  rewards: {
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  rewardsTitle: {
    color: TICKET_COLOR,
    fontSize: 14,
    fontWeight: '800',
  },
  rewardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  rewardLabel: {
    flex: 1,
    fontSize: 14,
  },
  rewardTickets: {
    color: TICKET_COLOR,
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  rewardMore: {
    fontSize: 13,
  },
  rewardLink: {
    color: TICKET_COLOR,
    fontSize: 14,
    fontWeight: '700',
    alignSelf: 'flex-end',
  },
});
