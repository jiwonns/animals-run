import { useEffect } from 'react';
import { View } from 'react-native';
import { Image } from '@/components/gacha-image';
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

import type { Grade } from '@/constants/characters';
import { Icon, ICONS } from '@/components/icon';

export type EggState = 'idle' | 'ready' | 'shake' | 'crack' | 'burst';
export const EGG_PALETTES: Record<Grade, { shell: string; spots: string; edge: string }> = {
  N: { shell: '#FFF0D8', spots: '#D9B584', edge: '#B58C64' },
  R: { shell: '#D8F2FF', spots: '#66BCEB', edge: '#4799C4' },
  EP: { shell: '#EEDFFF', spots: '#B58AE7', edge: '#9264BE' },
  U: { shell: '#FFE2EF', spots: '#EB8DB9', edge: '#C96998' },
  L: { shell: '#FFF0CC', spots: '#E3AF52', edge: '#BB832F' },
  E: { shell: '#FFE9D5', spots: '#EFAD77', edge: '#C88752' },
  H: { shell: '#E8E5F6', spots: '#D3AC50', edge: '#8A789E' },
};
const CRACK = [{ x: .43, y: .36, a: 32 }, { x: .47, y: .46, a: -34 }, { x: .43, y: .56, a: 36 }, { x: .48, y: .66, a: -30 }];

const EGG_IMAGES = Object.fromEntries(Object.entries(EGG_PALETTES).map(([grade, p]) => {
  const shape = 'M50 4C31 4 10 43 7 73C4 102 21 123 50 123C79 123 96 102 93 73C90 43 69 4 50 4Z';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="128" viewBox="0 0 100 128"><defs><linearGradient id="shell" x1="0" y1="0" x2=".65" y2="1"><stop stop-color="#FFFDF8"/><stop offset=".48" stop-color="${p.shell}"/><stop offset="1" stop-color="${p.spots}"/></linearGradient><clipPath id="body"><path d="${shape}"/></clipPath></defs><path d="${shape}" fill="url(#shell)" stroke="${p.edge}" stroke-width="1.8"/><g clip-path="url(#body)" fill="${p.spots}" opacity=".67"><ellipse cx="25" cy="57" rx="10" ry="13" transform="rotate(22 25 57)"/><ellipse cx="68" cy="39" rx="6" ry="8" transform="rotate(-20 68 39)"/><ellipse cx="69" cy="93" rx="12" ry="15" transform="rotate(-20 69 93)"/><ellipse cx="25" cy="102" rx="6" ry="7"/></g><path d="M37 20C26 32 20 47 17 60" fill="none" stroke="#FFF" stroke-width="6" stroke-linecap="round" opacity=".7"/><ellipse cx="45" cy="15" rx="3" ry="4" fill="#FFF" opacity=".85"/></svg>`;
  return [grade, { uri: `data:image/svg+xml;base64,${btoa(svg)}` }];
})) as Record<Grade, { uri: string }>;
/** Grade-colored egg; `ready` wobbles now and then, `shake` rattles, `burst` pops it away. */
export function EggView({ grade, size, state = 'idle' }: { grade: Grade; size: number; state?: EggState }) {
  const palette = EGG_PALETTES[grade];
  const rotate = useSharedValue(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    cancelAnimation(rotate);
    cancelAnimation(scale);
    cancelAnimation(opacity);
    rotate.set(0);
    scale.set(1);
    opacity.set(1);
    if (state === 'ready') {
      const tilt = (deg: number) => withTiming(deg, { duration: 90, easing: Easing.inOut(Easing.quad) });
      rotate.set(withRepeat(withDelay(1400, withSequence(tilt(-8), tilt(8), tilt(-5), tilt(4), tilt(0))), -1));
    } else if (state === 'shake') {
      const tilt = (deg: number) => withTiming(deg, { duration: 55 });
      rotate.set(withRepeat(withSequence(tilt(-12), tilt(12)), -1, true));
    } else if (state === 'crack') {
      rotate.set(withRepeat(withSequence(withTiming(-4, { duration: 65 }), withTiming(4, { duration: 65 })), -1, true));
      scale.set(withTiming(1.05, { duration: 250 }));
    } else if (state === 'burst') {
      scale.set(withTiming(1.35, { duration: 220, easing: Easing.out(Easing.cubic) }));
      opacity.set(withTiming(0, { duration: 220 }));
    }
    return () => { cancelAnimation(rotate); cancelAnimation(scale); cancelAnimation(opacity); };
  }, [state, rotate, scale, opacity]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ rotate: `${rotate.get()}deg` }, { scale: scale.get() }],
  }));

  const height = size * 1.28;

  return (
    <Animated.View style={[{ width: size, height, transformOrigin: 'bottom' }, style]}>
      <View style={{ position: 'absolute', width: size * .78, height: size * .10, bottom: -size * .025, left: size * .11, backgroundColor: `${palette.edge}25`, borderRadius: size }} />
      <Image source={EGG_IMAGES[grade]} style={{ width: size, height }} contentFit="contain" />
      <View style={{ position: 'absolute', left: size * .36, top: height * .46, opacity: .28 }}><Icon name={ICONS.character} size={size * .28} color={palette.edge} /></View>
      {(state === 'ready' || state === 'shake' || state === 'crack' || state === 'burst') && CRACK.slice(0, state === 'ready' ? 2 : 4).map((line, i) => <View key={`crack-${i}`} style={{ position: 'absolute', left: size * line.x, top: height * line.y, width: Math.max(1.5, size * .018), height: size * .18, borderRadius: 2, backgroundColor: palette.edge, transform: [{ rotate: `${line.a}deg` }], opacity: state === 'ready' ? .7 : 1 }} />)}
    </Animated.View>
  );
}
