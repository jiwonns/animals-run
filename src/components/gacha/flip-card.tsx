import { Image } from '@/components/gacha-image';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import type { Banner } from '@/constants/banners';
import { GRADES, GRADE_ORDER } from '@/constants/characters';
import { useColors } from '@/hooks/use-colors';
import type { DrawResult } from '@/lib/gacha';

import { CardBack } from './card-back';
import { GlowPulse, Shine, Sparkles } from './effects';

export const FLIP_MS = 420;
const RADIUS = 12;

export function FlipCard({ result, width, banner, open, delay, onPress }: {
  result: DrawResult;
  width: number;
  banner: Banner;
  open: boolean;
  /** Wait before flipping once `open` turns true, for staggered "open all". */
  delay: number;
  onPress: () => void;
}) {
  const colors = useColors();
  const { character, isNew } = result;
  const { color } = GRADES[character.grade];
  const rare = GRADE_ORDER.indexOf(character.grade) > 0;
  const hidden = character.grade === 'H';
  const height = width * 1.38;

  const flip = useSharedValue(0);
  const pop = useSharedValue(1);
  const breathe = useSharedValue(0);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!rare || open) return;
    breathe.set(withRepeat(withTiming(1, { duration: 700, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => {
      cancelAnimation(breathe);
      breathe.set(withTiming(0, { duration: 120 }));
    };
  }, [rare, open, breathe]);

  useEffect(() => {
    if (!open) return;
    flip.set(withDelay(delay, withTiming(1, { duration: FLIP_MS, easing: Easing.inOut(Easing.cubic) })));
    pop.set(
      withDelay(
        delay + FLIP_MS * 0.6,
        withSequence(withTiming(rare ? 1.12 : 1.04, { duration: 110 }), withSpring(1, { damping: 12 })),
      ),
    );
    const timer = setTimeout(() => setShown(true), delay + FLIP_MS / 2);
    return () => clearTimeout(timer);
  }, [open, delay, rare, flip, pop]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 800 },
      { rotateY: `${flip.get() * 180}deg` },
      { scale: pop.get() * (1 + breathe.get() * 0.03) },
    ],
  }));
  const backStyle = useAnimatedStyle(() => ({ opacity: flip.get() < 0.5 ? 1 : 0 }));
  const frontStyle = useAnimatedStyle(() => ({ opacity: flip.get() < 0.5 ? 0 : 1 }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={open ? character.name : '카드 열기'}
      disabled={open}
      onPress={onPress}
      style={{ width, height }}>
      {hidden && <GlowPulse color={color} radius={RADIUS} />}
      <Animated.View style={[StyleSheet.absoluteFill, cardStyle]}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.shadow, backStyle]}>
          <CardBack
            banner={banner}
            width={width}
            height={height}
            radius={RADIUS}
            color={color}
          />
          {hidden && (
            <View style={[StyleSheet.absoluteFill, styles.clip]}>
              <Shine width={width} height={height} />
            </View>
          )}
        </Animated.View>

        <Animated.View
          style={[
            styles.face,
            {
              borderColor: rare ? color : colors.surface,
              backgroundColor: colors.surface,
              transform: [{ rotateY: '180deg' }],
            },
            frontStyle,
          ]}>
          <Image source={character.image} style={{ width: width * 0.82, height: width * 0.82 }} contentFit="contain" />
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {character.name}
          </Text>
          <View style={[styles.grade, { backgroundColor: color }]}>
            <Text style={styles.gradeLabel}>{character.grade}</Text>
          </View>
          {hidden && <Shine width={width} height={height} delay={600} />}
          {isNew && (
            <View style={[styles.newBadge, { backgroundColor: colors.primary }]}>
              <Text style={styles.newLabel}>NEW</Text>
            </View>
          )}
        </Animated.View>
      </Animated.View>
      {shown && rare && <Sparkles color={color} count={hidden ? 14 : 6} radius={width * (hidden ? 1.1 : 0.75)} seed={width} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  clip: {
    borderRadius: RADIUS,
    overflow: 'hidden',
  },
  shadow: {
    borderRadius: RADIUS,
    boxShadow: '0 3px 8px rgba(0,0,0,0.12)',
  },
  face: {
    ...StyleSheet.absoluteFill,
    borderRadius: RADIUS,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  name: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
    paddingHorizontal: 4,
  },
  grade: {
    position: 'absolute',
    top: 5,
    left: 5,
    borderRadius: 5,
    paddingHorizontal: 5,
  },
  gradeLabel: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
  },
  newBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    borderRadius: 5,
    paddingHorizontal: 4,
  },
  newLabel: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
  },
});
