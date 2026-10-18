import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

/** Deterministic 0..1 noise so particle layouts stay stable across renders. */
export function noise(i: number, seed = 0) {
  const x = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Flat translucent disc that breathes behind the focal element. */
export function Halo({ color, size, opacity = 0.18 }: { color: string; size: number; opacity?: number }) {
  const scale = useSharedValue(0.6);
  useEffect(() => {
    scale.set(withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }, () => {
      scale.set(withRepeat(withTiming(1.06, { duration: 1200, easing: Easing.inOut(Easing.sin) }), -1, true));
    }));
    return () => cancelAnimation(scale);
  }, [scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.centered,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity },
        style,
      ]}
    />
  );
}

export function Sparkles({ color, count = 10, radius = 140, delay = 0, seed = 1 }: {
  color: string;
  count?: number;
  radius?: number;
  delay?: number;
  seed?: number;
}) {
  return (
    <View pointerEvents="none" style={styles.fill}>
      {Array.from({ length: count }, (_, i) => (
        <Particle
          key={i}
          angle={(i / count) * Math.PI * 2 + noise(i, seed) * 0.5}
          distance={radius * (0.6 + noise(i, seed + 1) * 0.5)}
          delay={delay + noise(i, seed + 2) * 120}
          size={4 + noise(i, seed + 3) * 4}
          color={color}
        />
      ))}
    </View>
  );
}

function Particle({ angle, distance, delay, size, color }: {
  angle: number;
  distance: number;
  delay: number;
  size: number;
  color: string;
}) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.set(withDelay(delay, withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) })));
  }, [p, delay]);
  const style = useAnimatedStyle(() => {
    const v = p.get();
    return {
      opacity: v === 0 ? 0 : 1 - v,
      transform: [{ translateX: Math.cos(angle) * distance * v }, { translateY: Math.sin(angle) * distance * v }],
    };
  });
  return (
    <Animated.View
      style={[{ position: 'absolute', width: size, height: size, borderRadius: size, backgroundColor: color }, style]}
    />
  );
}

/** Soft colored glow around a card that pulses; place it behind the card. */
export function GlowPulse({ color, radius }: { color: string; radius: number }) {
  const o = useSharedValue(0.35);
  useEffect(() => {
    o.set(withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => cancelAnimation(o);
  }, [o]);
  const style = useAnimatedStyle(() => ({ opacity: o.get() }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { borderRadius: radius, backgroundColor: color, boxShadow: `0 0 18px 6px ${color}` },
        style,
      ]}
    />
  );
}

/** A light streak that sweeps across its (overflow-hidden) parent every few seconds. */
export function Shine({ width, height, delay = 0 }: { width: number; height: number; delay?: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.set(
      withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(0, { duration: 0 }),
            withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
            withTiming(1, { duration: 1100 }),
          ),
          -1,
        ),
      ),
    );
    return () => cancelAnimation(p);
  }, [p, delay]);
  const bar = Math.max(14, width * 0.35);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: -bar * 2 + p.get() * (width + bar * 3) }, { rotate: '25deg' }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          top: -height * 0.5,
          left: 0,
          width: bar,
          height: height * 2,
          backgroundImage: 'linear-gradient(to right, #ffffff00 0%, #ffffffcc 50%, #ffffff00 100%)',
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    position: 'absolute',
  },
  fill: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
