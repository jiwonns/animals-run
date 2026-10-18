import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Halo, Sparkles } from '@/components/gacha/effects';
import { CHARACTER_BY_ID, GRADES } from '@/constants/characters';
import { useColors } from '@/hooks/use-colors';
import type { Egg } from '@/lib/home';

import { EggView } from './egg-view';

/** Keep the rattle visible even when the server answers instantly. */
const MIN_SHAKE_MS = 1200;
const BURST_MS = 220;

type Stage = 'shake' | 'burst' | 'reveal';

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
    const timer = setTimeout(() => setStage('burst'), 0);
    return () => clearTimeout(timer);
  }, [saved, minDone, stage]);

  useEffect(() => {
    if (stage !== 'burst') return;
    const timer = setTimeout(() => setStage('reveal'), BURST_MS);
    return () => clearTimeout(timer);
  }, [stage]);

  const imageSize = Math.min(width * 0.55, 240);
  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingBottom: insets.bottom + 20 }]}>
      <View style={styles.stage}>
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
              <Text style={[styles.caption, { color: colors.secondary }]}>알에서 태어났어요!</Text>
            </Animated.View>
          </>
        ) : (
          <>
            <EggView grade={egg.grade} size={Math.min(width * 0.4, 170)} state={stage === 'burst' ? 'burst' : 'shake'} />
            <Text style={[styles.caption, styles.shakeCaption, { color: colors.secondary }]}>부화하는 중…</Text>
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
