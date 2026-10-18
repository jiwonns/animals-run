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

import { tintOf } from '@/components/gacha/card-back';
import { GRADES, type Grade } from '@/constants/characters';

export type EggState = 'idle' | 'ready' | 'shake' | 'burst';

const SPOTS = [
  { x: 0.22, y: 0.3, r: 0.13 },
  { x: 0.62, y: 0.22, r: 0.09 },
  { x: 0.55, y: 0.58, r: 0.15 },
  { x: 0.2, y: 0.68, r: 0.08 },
];

/** Grade-colored egg; `ready` wobbles now and then, `shake` rattles, `burst` pops it away. */
export function EggView({ grade, size, state = 'idle' }: { grade: Grade; size: number; state?: EggState }) {
  const color = GRADES[grade].color;
  const rotate = useSharedValue(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    cancelAnimation(rotate);
    rotate.set(0);
    if (state === 'ready') {
      const tilt = (deg: number) => withTiming(deg, { duration: 90, easing: Easing.inOut(Easing.quad) });
      rotate.set(withRepeat(withDelay(1400, withSequence(tilt(-8), tilt(8), tilt(-5), tilt(4), tilt(0))), -1));
    } else if (state === 'shake') {
      const tilt = (deg: number) => withTiming(deg, { duration: 55 });
      rotate.set(withRepeat(withSequence(tilt(-12), tilt(12)), -1, true));
    } else if (state === 'burst') {
      scale.set(withTiming(1.35, { duration: 220, easing: Easing.out(Easing.cubic) }));
      opacity.set(withTiming(0, { duration: 220 }));
    }
    return () => cancelAnimation(rotate);
  }, [state, rotate, scale, opacity]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ rotate: `${rotate.get()}deg` }, { scale: scale.get() }],
  }));

  const height = size * 1.28;
  const spot = tintOf(color, 0.45);
  return (
    <Animated.View style={[{ width: size, height, transformOrigin: 'bottom' }, style]}>
      <View
        style={[
          styles.shell,
          {
            width: size,
            height: size,
            top: (height - size) / 2,
            borderRadius: size / 2,
            backgroundColor: color,
            transform: [{ scaleY: 1.28 }],
          },
        ]}>
        {SPOTS.map((s, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: s.x * size,
              top: s.y * size,
              width: s.r * 2 * size,
              height: s.r * 2 * size,
              borderRadius: s.r * size,
              backgroundColor: spot,
            }}
          />
        ))}
        <View
          style={[
            styles.highlight,
            { left: size * 0.2, top: size * 0.1, width: size * 0.18, height: size * 0.26, borderRadius: size },
          ]}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shell: {
    position: 'absolute',
    left: 0,
    overflow: 'hidden',
  },
  highlight: {
    position: 'absolute',
    backgroundColor: '#ffffff',
    opacity: 0.35,
    transform: [{ rotate: '-20deg' }],
  },
});
