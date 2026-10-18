import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tintOf } from '@/components/gacha/card-back';
import { Halo, Sparkles } from '@/components/gacha/effects';
import { CHARACTER_BY_ID, GRADES, type CharacterId } from '@/constants/characters';
import { useColors } from '@/hooks/use-colors';
import { tierOf } from '@/lib/craft';

export type CraftKind = 'fuse' | 'recycle' | 'evolve';
export type CraftResult = { output: CharacterId | null; isNew: boolean };

/** Keep the build-up visible even when the server answers instantly. */
const MIN_WORK_MS = 1300;

const COPY: Record<CraftKind, { working: string; done: string }> = {
  fuse: { working: '합성하는 중…', done: '합성에 성공했어요!' },
  recycle: { working: '재활용하는 중…', done: '새 친구가 나왔어요!' },
  evolve: { working: '진화하는 중…', done: '진화했어요!' },
};

/** Full-screen build-up and reveal for fusion, recycling and evolution. `result` stays null until saved. */
export function CraftShow({ kind, inputs, result, onClose }: {
  kind: CraftKind;
  inputs: CharacterId[];
  result: CraftResult | null;
  onClose: () => void;
}) {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [minDone, setMinDone] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMinDone(true), MIN_WORK_MS);
    return () => clearTimeout(timer);
  }, []);

  const revealed = minDone && result !== null;
  const imageSize = Math.min(width * 0.55, 240);
  const output = result?.output ? CHARACTER_BY_ID[result.output] : null;
  const grade = output ? GRADES[output.grade] : null;
  const rare = !!output && output.grade !== 'N';

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingBottom: insets.bottom + 20 }]}>
      <View style={styles.stage}>
        {!revealed ? (
          <>
            <Shaking>
              <WorkVisual kind={kind} inputs={inputs} size={Math.min(width * 0.42, 180)} />
            </Shaking>
            <Text style={[styles.caption, styles.workCaption, { color: colors.secondary }]}>{COPY[kind].working}</Text>
          </>
        ) : output && grade ? (
          <>
            <Halo color={grade.color} size={imageSize * 1.6} opacity={rare ? 0.2 : 0.12} />
            <Sparkles color={grade.color} count={rare ? 14 : 8} radius={imageSize * 0.8} />
            <Animated.View entering={ZoomIn.springify().damping(12)}>
              <Image source={output.image} style={{ width: imageSize, height: imageSize }} contentFit="contain" />
            </Animated.View>
            <Animated.View entering={FadeInDown.delay(150)} style={styles.info}>
              <View style={styles.gradeRow}>
                <View style={[styles.dot, { backgroundColor: grade.color }]} />
                <Text style={[styles.gradeLabel, { color: grade.color }]}>{grade.label}</Text>
                {result?.isNew && (
                  <View style={[styles.newBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.newLabel}>NEW</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.name, { color: colors.text }]}>{output.name}</Text>
              <Text style={[styles.caption, { color: colors.secondary }]}>{COPY[kind].done}</Text>
            </Animated.View>
          </>
        ) : (
          <Animated.View entering={FadeInDown} style={styles.info}>
            <Text style={[styles.name, { color: colors.text }]}>합성에 실패했어요</Text>
            <Text style={[styles.caption, { color: colors.secondary }]}>넣은 동물과 코인이 사라졌어요.</Text>
          </Animated.View>
        )}
      </View>

      {revealed && (
        <Animated.View entering={FadeIn.delay(300)} style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.button, { backgroundColor: colors.primary }, pressed && styles.pressed]}>
            <Text style={styles.buttonLabel}>확인</Text>
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

function Shaking({ children }: { children: React.ReactNode }) {
  const rotate = useSharedValue(0);
  useEffect(() => {
    const tilt = (deg: number) => withTiming(deg, { duration: 60 });
    rotate.set(withRepeat(withSequence(tilt(-6), tilt(6)), -1, true));
    return () => cancelAnimation(rotate);
  }, [rotate]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotate.get()}deg` }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

/** Recycling shows a face-down card in the lowest input's grade color; the others show what goes in. */
function WorkVisual({ kind, inputs, size }: { kind: CraftKind; inputs: CharacterId[]; size: number }) {
  if (kind === 'recycle') {
    const lowest = inputs.reduce((a, b) => (tierOf(b) < tierOf(a) ? b : a), inputs[0]);
    const color = GRADES[CHARACTER_BY_ID[lowest].grade].color;
    return (
      <View
        style={[
          styles.card,
          { width: size * 0.78, height: size * 1.1, backgroundColor: color, borderColor: tintOf(color, 0.5) },
        ]}>
        <Text style={styles.cardMark}>?</Text>
      </View>
    );
  }
  const character = CHARACTER_BY_ID[inputs[0]];
  if (kind === 'fuse') {
    return (
      <View style={[styles.pair, { width: size * 1.3, height: size }]}>
        <Image source={character.image} style={[styles.pairLeft, { width: size * 0.75, height: size * 0.75 }]} />
        <Image
          source={CHARACTER_BY_ID[inputs[1] ?? inputs[0]].image}
          style={[styles.pairRight, { width: size * 0.75, height: size * 0.75 }]}
        />
      </View>
    );
  }
  return <Image source={character.image} style={{ width: size, height: size }} contentFit="contain" />;
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
  info: {
    alignItems: 'center',
    gap: 4,
    marginTop: 20,
  },
  gradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  gradeLabel: {
    fontSize: 14,
    fontWeight: '800',
  },
  newBadge: {
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  newLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
  },
  name: {
    fontSize: 26,
    fontWeight: '800',
  },
  caption: {
    fontSize: 14,
    fontWeight: '600',
  },
  workCaption: {
    marginTop: 28,
  },
  card: {
    borderRadius: 18,
    borderWidth: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardMark: {
    color: '#fff',
    fontSize: 56,
    fontWeight: '900',
  },
  pair: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pairLeft: {
    position: 'absolute',
    left: 0,
  },
  pairRight: {
    position: 'absolute',
    right: 0,
  },
  footer: {
    paddingHorizontal: 20,
  },
  button: {
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.8,
  },
});
