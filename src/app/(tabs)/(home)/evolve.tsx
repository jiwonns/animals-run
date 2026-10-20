import { Image } from '@/components/gacha-image';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CraftShow, type CraftResult } from '@/components/home/craft-show';
import { MysteryImage } from '@/components/home/outcomes';
import { OddsButton, type OddsRow } from '@/components/odds-info';
import { CHARACTER_BY_ID, CHARACTERS, COLLECTIONS, GRADES, type CharacterId, type Grade } from '@/constants/characters';
import { REWARDS } from '@/constants/gacha.generated';
import { useColors } from '@/hooks/use-colors';
import { useCompanionSteps } from '@/hooks/use-home';
import { evolveCharacter, evolveCost, evolveTarget } from '@/lib/craft';
import { HomeError } from '@/lib/home';
import { useSession } from '@/providers/session-provider';

type Show = { key: number; id: CharacterId; result: CraftResult | null };

const collectionOf = (id: string) => COLLECTIONS.find((c) => c.id === id)!;
const evolveRows: OddsRow[] = Object.entries(REWARDS.evolution.paths).map(([from, to]) => ({
  key: from,
  label: `${collectionOf(from).name} → ${collectionOf(to).name}`,
  chance: 1,
  color: GRADES[collectionOf(to).grade].color,
}));
const evolveCostNotes = (Object.entries(REWARDS.evolution.steps) as [Grade, number][]).map(
  ([g, steps]) => `${GRADES[g].label}: 함께 ${steps.toLocaleString()}걸음 · ${REWARDS.evolution.coins[g] ?? 0}코인`,
);

export default function EvolveScreen() {
  const colors = useColors();
  const { user, profile } = useSession();
  const companion = useCompanionSteps();
  const [show, setShow] = useState<Show | null>(null);
  const showKey = useRef(0);

  const rows = CHARACTERS.flatMap((c) => {
    const target = evolveTarget(c.id);
    if (!target || !(profile?.characters[c.id] ?? 0)) return [];
    const cost = evolveCost(c.id);
    const steps = companion[c.id] ?? 0;
    return [{ character: c, target: CHARACTER_BY_ID[target], cost, steps, ready: steps >= cost.steps }];
  }).sort((a, b) => Number(b.ready) - Number(a.ready) || b.steps / b.cost.steps - a.steps / a.cost.steps);

  async function evolve(id: CharacterId, coins: number) {
    if (!user || !profile || show) return;
    if (profile.coins < coins) {
      Alert.alert('코인이 부족해요', `진화하려면 ${coins}코인이 필요해요.`);
      return;
    }
    const key = ++showKey.current;
    setShow({ key, id, result: null });
    try {
      const result = await evolveCharacter(user.uid, id);
      setShow((s) => (s?.key === key ? { ...s, result } : s));
    } catch (error) {
      setShow(null);
      Alert.alert('진화하지 못했어요', error instanceof HomeError ? error.message : '잠시 후 다시 시도해주세요.');
    }
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}>
      <View style={[styles.hint, { backgroundColor: colors.surface }]}>
        <Text style={[styles.hintText, { color: colors.secondary }]}>
          대표 동물로 정하고 함께 걸으면 그 동물의 걸음이 쌓여요. 걸음을 채우면 같은 동물의 상위 등급으로 꼭 진화해요.
        </Text>
        <View style={styles.hintActions}>
          <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.navigate('/mypage/avatar')}>
            {({ pressed }) => (
              <Text style={[styles.hintLink, { color: colors.primary }, pressed && styles.pressed]}>대표 동물 바꾸기 ›</Text>
            )}
          </Pressable>
          <OddsButton
            title="진화 확률"
            rows={evolveRows}
            notes={['같은 동물의 다음 등급으로 진화하고, 실패하지 않아요.', ...evolveCostNotes]}
          />
        </View>
      </View>

      {rows.length === 0 ? (
        <Text style={[styles.hintText, { color: colors.secondary }]}>진화할 수 있는 동물이 없어요.</Text>
      ) : (
        rows.map(({ character, target, cost, steps, ready }) => {
          const targetGrade = GRADES[target.grade];
          const isAvatar = profile?.avatar === character.id;
          const known = (profile?.characters[target.id] ?? 0) > 0;
          return (
            <View key={character.id} style={[styles.row, { backgroundColor: colors.surface }]}>
              <View style={styles.pair}>
                <Image source={character.image} style={styles.image} contentFit="contain" />
                <Text style={[styles.arrow, { color: colors.secondary }]}>→</Text>
                <MysteryImage character={target} revealed={known} style={styles.image} />
              </View>
              <View style={styles.body}>
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                  {character.name} →{' '}
                  <Text style={{ color: targetGrade.color }}>{known ? target.name : `${targetGrade.label} ???`}</Text>
                </Text>
                <View style={[styles.track, { backgroundColor: colors.border }]}>
                  <View
                    style={[
                      styles.bar,
                      { width: `${Math.min(1, steps / cost.steps) * 100}%`, backgroundColor: ready ? '#8B5CF6' : '#22C55E' },
                    ]}
                  />
                </View>
                <Text style={[styles.meta, { color: colors.secondary }]}>
                  {Math.min(steps, cost.steps).toLocaleString()} / {cost.steps.toLocaleString()}걸음 · {cost.coins}코인
                  {isAvatar ? ' · 대표' : ''}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                disabled={!ready || !!show}
                onPress={() => evolve(character.id, cost.coins)}
                style={({ pressed }) => [
                  styles.button,
                  { backgroundColor: ready ? '#8B5CF6' : colors.border },
                  pressed && styles.pressed,
                ]}>
                <Text style={[styles.buttonLabel, !ready && { color: colors.secondary }]}>진화</Text>
              </Pressable>
            </View>
          );
        })
      )}

      <Modal visible={!!show} transparent statusBarTranslucent navigationBarTranslucent animationType="fade" onRequestClose={() => {
          if (show?.result) setShow(null);
        }}>
        {show && <CraftShow key={show.key} kind="evolve" inputs={[show.id]} result={show.result} onClose={() => setShow(null)} />}
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    gap: 12,
  },
  hint: {
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  hintText: {
    fontSize: 13,
    lineHeight: 18,
  },
  hintActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hintLink: {
    fontSize: 13,
    fontWeight: '800',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 12,
    gap: 10,
  },
  pair: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  image: {
    width: 44,
    height: 44,
  },
  arrow: {
    fontSize: 14,
    fontWeight: '800',
    marginHorizontal: 2,
  },
  body: {
    flex: 1,
    gap: 5,
  },
  name: {
    fontSize: 14,
    fontWeight: '800',
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: 3,
  },
  meta: {
    fontSize: 11,
    fontWeight: '600',
  },
  button: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  buttonLabel: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.7,
  },
});
