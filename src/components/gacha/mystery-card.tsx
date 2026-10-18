import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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

import { CardBack } from './card-back';
import { GlowPulse, Shine } from './effects';

export type MysteryState = 'wiggle' | 'rumble' | 'open';

export function MysteryCard({ banner, width, state, tint, stacked, color, shine = false }: {
  banner: Banner;
  width: number;
  state: MysteryState;
  /** Glow and sweep a light streak across the card (hidden-grade pulls). */
  shine?: boolean;
  /** Repaint the back in this color once the result is known. */
  color?: string;
  /** Border color; switches to the best grade's color once results are in. */
  tint: string;
  /** Fan extra cards behind for multi draws. */
  stacked: boolean;
}) {
  const height = width * 1.4;
  const enter = useSharedValue(0);
  const rotate = useSharedValue(0);
  const scale = useSharedValue(1);
  const flip = useSharedValue(0);

  useEffect(() => {
    enter.set(withSpring(1, { damping: 14, stiffness: 140 }));
  }, [enter]);

  useEffect(() => {
    if (state === 'wiggle') {
      rotate.set(
        withDelay(
          500,
          withRepeat(
            withSequence(
              withTiming(-4, { duration: 90 }),
              withTiming(4, { duration: 160 }),
              withTiming(0, { duration: 90 }),
              withTiming(0, { duration: 500 }),
            ),
            -1,
          ),
        ),
      );
    } else if (state === 'rumble') {
      rotate.set(withRepeat(withSequence(withTiming(-2.5, { duration: 45 }), withTiming(2.5, { duration: 45 })), -1, true));
      scale.set(withTiming(1.06, { duration: 600, easing: Easing.in(Easing.quad) }));
    } else {
      cancelAnimation(rotate);
      rotate.set(withTiming(0, { duration: 60 }));
      flip.set(withTiming(1, { duration: 280, easing: Easing.in(Easing.cubic) }));
    }
    return () => cancelAnimation(rotate);
  }, [state, rotate, scale, flip]);

  const cardStyle = useAnimatedStyle(() => {
    const e = enter.get();
    return {
      opacity: Math.min(1, e * 1.5),
      transform: [
        { perspective: 900 },
        { translateY: (1 - e) * 60 },
        { rotate: `${rotate.get()}deg` },
        { rotateY: `${flip.get() * 90}deg` },
        { scale: scale.get() * (0.9 + 0.1 * e) },
      ],
    };
  });
  const fanStyle = useAnimatedStyle(() => ({ opacity: enter.get() * (1 - flip.get()) }));

  const face = (
    <View style={[styles.face, { borderColor: tint }]}>
      <CardBack banner={banner} width={width} height={height} radius={18} color={color} />
      {shine && <Shine width={width} height={height} />}
      <Text style={[styles.title, { color: color ?? banner.poster.text }]} numberOfLines={1}>
        {banner.title}
      </Text>
    </View>
  );

  return (
    <View style={{ width, height }}>
      {stacked && (
        <Animated.View style={[StyleSheet.absoluteFill, fanStyle]}>
          {[-8, 8].map((deg) => (
            <View
              key={deg}
              style={[
                styles.face,
                styles.fan,
                { backgroundColor: banner.poster.background, transform: [{ rotate: `${deg}deg` }] },
              ]}
            />
          ))}
        </Animated.View>
      )}
      <Animated.View style={[StyleSheet.absoluteFill, styles.shadow, cardStyle]}>
        {shine && color && <GlowPulse color={color} radius={20} />}
        {face}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  face: {
    ...StyleSheet.absoluteFill,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fan: {
    borderColor: 'rgba(0,0,0,0.06)',
    opacity: 0.6,
  },
  shadow: {
    borderRadius: 20,
    boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
  },
  title: {
    position: 'absolute',
    bottom: '14%',
    left: 12,
    right: 12,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    opacity: 0.7,
  },
});
