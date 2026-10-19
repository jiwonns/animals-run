import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, ZoomIn, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Halo, Sparkles } from '@/components/gacha/effects';
import { CHARACTER_BY_ID, GRADES } from '@/constants/characters';
import { useColors } from '@/hooks/use-colors';
import type { Egg } from '@/lib/home';

import { EggView, EGG_PALETTES } from './egg-view';

/** Keep the rattle visible even when the server answers instantly. */
const MIN_SHAKE_MS = 1000;
const CRACK_MS = 380;
const BURST_MS = 320;

type Stage = 'shake' | 'crack' | 'burst' | 'reveal';

function ShellShard({ side, size, shell, edge }: { side: number; size: number; shell: string; edge: string }) {
  const progress = useSharedValue(0);
  useEffect(() => { progress.set(withTiming(1, { duration: 720, easing: Easing.out(Easing.quad) })); }, [progress]);
  const motion = useAnimatedStyle(() => {
    const p = progress.get();
    return { opacity: 1 - p, transform: [{ translateX: side * size * .9 * p }, { translateY: -size * .4 * p + size * 1.5 * p * p }, { rotate: `${side * 65 * p}deg` }] };
  });
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: size * .42, height: size * .32, borderWidth: 2, borderColor: edge, backgroundColor: shell, borderBottomLeftRadius: size * .25, borderBottomRightRadius: size * .25 }, motion]}><View style={{ width: '60%', height: '16%', backgroundColor: '#fff9', borderRadius: 8, margin: 6 }} /></Animated.View>;
}

export function HatchShow({ egg, saved, isNew, onClose }: {
  egg: Egg;
  /** The hatch write went through. */
  saved: boolean;
  isNew: boolean;
  onClose: () => void;
}) {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [stage, setStage] = useState<Stage>('shake');
  const [minDone, setMinDone] = useState(false);
  const character = CHARACTER_BY_ID[egg.child];
  const grade = GRADES[character.grade];
  const rare = character.grade !== 'N';

  useEffect(() => {
    const timer = setTimeout(() => setMinDone(true), MIN_SHAKE_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!saved || !minDone || stage !== 'shake') return;
    const timer = setTimeout(() => setStage('crack'), 0);
    return () => clearTimeout(timer);
  }, [saved, minDone, stage]);

  useEffect(() => {
    if (stage !== 'crack') return;
    const timer = setTimeout(() => setStage('burst'), CRACK_MS);
    return () => clearTimeout(timer);
  }, [stage]);

  useEffect(() => {
    if (stage !== 'burst') return;
    const timer = setTimeout(() => setStage('reveal'), BURST_MS);
    return () => clearTimeout(timer);
  }, [stage]);

  const imageSize = Math.min(width * 0.55, 240);
  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingBottom: insets.bottom + 20 }]}>
      <View style={styles.stage}>
        {(stage === 'burst' || stage === 'reveal') && [-1, 1].map(side => <ShellShard key={side} side={side} size={imageSize} {...EGG_PALETTES[egg.grade]} />)}
        {stage === 'reveal' ? (
          <>
            <Halo color={grade.color} size={imageSize * 1.6} opacity={rare ? 0.2 : 0.12} />
            <Sparkles color={grade.color} count={rare ? 14 : 8} radius={imageSize * 0.8} />
            <Animated.View entering={ZoomIn.springify().damping(12)}>
              <Image source={character.image} style={{ width: imageSize, height: imageSize }} contentFit="contain" />
            </Animated.View>
            <Animated.View entering={FadeInDown.delay(150)} style={styles.info}>
              <View style={styles.gradeRow}>
                <View style={[styles.dot, { backgroundColor: grade.color }]} />
                <Text style={[styles.gradeLabel, { color: grade.color }]}>{grade.label}</Text>
                {isNew && (
                  <View style={[styles.newBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.newLabel}>NEW</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.name, { color: colors.text }]}>{character.name}</Text>
              <Text style={[styles.caption, { color: colors.secondary }]}>{character.collection === 'baby' ? '작은 친구가 세상에 나왔어요!' : '알에서 태어났어요!'}</Text>
            </Animated.View>
          </>
        ) : (
          <>
            <Halo color={grade.color} size={imageSize * 1.4} opacity={stage === 'shake' ? .08 : .18} />
            <EggView grade={egg.grade} size={Math.min(width * 0.4, 170)} state={stage} />
            <Text style={[styles.caption, styles.shakeCaption, { color: colors.secondary }]}>{stage === 'shake' ? '안에서 작은 발소리가 들려요…' : stage === 'crack' ? '톡, 톡! 껍질이 갈라져요' : '작은 친구를 만나는 순간!'}</Text>
          </>
        )}
      </View>

      {stage === 'reveal' && (
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
  shakeCaption: {
    marginTop: 28,
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
