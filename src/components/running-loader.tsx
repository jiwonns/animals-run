import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { charactersIn } from '@/constants/characters';
import { useColors } from '@/hooks/use-colors';

const RUNNERS = charactersIn('normal').map((c) => c.thumb);
const LAP_MS = 1800;
const HOP_MS = 180;

function useHop(height: number) {
  const hop = useSharedValue(0);
  useEffect(() => {
    hop.value = withRepeat(
      withSequence(
        withTiming(-height, { duration: HOP_MS, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: HOP_MS, easing: Easing.in(Easing.quad) }),
      ),
      -1,
    );
    return () => cancelAnimation(hop);
  }, [hop, height]);
  return useAnimatedStyle(() => ({
    transform: [{ translateY: hop.value }, { rotate: `${(hop.value / height) * 8}deg` }],
  }));
}

/** Picks a new animal each lap so long waits don't look frozen. */
function useRunner() {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * RUNNERS.length));
  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => (i + 1) % RUNNERS.length), LAP_MS);
    return () => clearInterval(timer);
  }, []);
  return RUNNERS[index];
}

/** A hopping animal for small spaces such as buttons. */
export function RunningDot({ size = 26 }: { size?: number }) {
  const hopStyle = useHop(size * 0.3);
  const runner = useRunner();
  return (
    <Animated.View style={[{ width: size, height: size }, hopStyle]}>
      <Image source={runner} style={{ width: size, height: size }} contentFit="contain" />
    </Animated.View>
  );
}

/** An animal running along a track, for screens and sections that are loading. */
export function RunningLoader({ label, style }: { label?: string; style?: StyleProp<ViewStyle> }) {
  const colors = useColors();
  const [width, setWidth] = useState(0);
  const lap = useSharedValue(0);
  const hopStyle = useHop(10);
  const runner = useRunner();
  const size = 40;

  useEffect(() => {
    lap.value = withRepeat(withTiming(1, { duration: LAP_MS, easing: Easing.inOut(Easing.sin) }), -1);
    return () => cancelAnimation(lap);
  }, [lap]);

  const runnerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: lap.value * Math.max(width - size, 0) }],
  }));
  const fillStyle = useAnimatedStyle(() => ({ width: size / 2 + lap.value * Math.max(width - size, 0) }));

  return (
    <View style={[styles.container, style]} accessibilityRole="progressbar" accessibilityLabel={label ?? '불러오는 중'}>
      <View style={styles.track} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        <Animated.View style={[styles.runner, { width: size, height: size }, runnerStyle]}>
          <Animated.View style={hopStyle}>
            <Image source={runner} style={{ width: size, height: size }} contentFit="contain" />
          </Animated.View>
        </Animated.View>
        <View style={[styles.bar, { backgroundColor: colors.surface }]}>
          <Animated.View style={[styles.fill, { backgroundColor: colors.primary }, fillStyle]} />
        </View>
      </View>
      {label && <Text style={[styles.label, { color: colors.secondary }]}>{label}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 24,
    gap: 10,
  },
  track: {
    alignSelf: 'stretch',
    paddingTop: 52,
  },
  runner: {
    position: 'absolute',
    left: 0,
    top: 4,
  },
  bar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
});
