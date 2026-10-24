import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const EASE = Easing.inOut(Easing.quad);

export function BrandSplash({ notice }: { notice?: string | null } = {}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const mark = Math.round(Math.min(width * 0.58, height * 0.3, 220));
  const lift = useSharedValue(0);
  const squash = useSharedValue(1);

  useEffect(() => {
    lift.set(
      withRepeat(
        withSequence(withTiming(-10, { duration: 780, easing: EASE }), withTiming(0, { duration: 780, easing: EASE })),
        -1,
      ),
    );
    squash.set(
      withRepeat(
        withSequence(withTiming(0.78, { duration: 780, easing: EASE }), withTiming(1, { duration: 780, easing: EASE })),
        -1,
      ),
    );
    return () => {
      cancelAnimation(lift);
      cancelAnimation(squash);
    };
  }, [lift, squash]);

  const hop = useAnimatedStyle(() => ({ transform: [{ translateY: lift.get() }] }));
  const ground = useAnimatedStyle(() => ({
    transform: [{ scaleX: squash.get() }, { scaleY: 1.15 - squash.get() * 0.15 }],
    opacity: 0.22 + squash.get() * 0.28,
  }));

  return (
    <View style={s.root} accessibilityLabel="Animals Run 시작 중">
      <View pointerEvents="none" style={[s.sun, { top: -height * 0.08, right: -width * 0.18 }]} />
      <View pointerEvents="none" style={[s.hill, { bottom: -width * 0.28, left: -width * 0.22 }]} />

      <View style={[s.stage, { paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        <View style={s.center}>
          <View style={[s.hero, { width: mark + 36, height: mark + 40 }]}>
            <View style={[s.glow, { width: mark * 0.9, height: mark * 0.9, borderRadius: mark }]} />
            <Animated.View style={[hop, s.mark]}>
              <Image
                source={require('../../assets/images/splash-icon.png')}
                style={{ width: mark, height: mark }}
                contentFit="contain"
              />
            </Animated.View>
            <Animated.View style={[s.shadow, ground, { width: mark * 0.52, height: Math.max(10, mark * 0.08) }]} />
          </View>

          <Animated.View entering={FadeInDown.duration(480).delay(80)} style={s.copy}>
            <Text style={s.eyebrow}>EVERY STEP, A NEW FRIEND</Text>
            <Text style={s.title} allowFontScaling={false} numberOfLines={1} adjustsFontSizeToFit>
              Animals <Text style={s.run}>Run</Text>
            </Text>
            <View style={s.rule} />
            <Text style={s.caption}>작은 발걸음이 새로운 친구로</Text>
          </Animated.View>

          <View style={s.paws}>
            {[0, 1, 2].map((i) => (
              <Paw key={i} delay={i * 180} />
            ))}
          </View>
        </View>

        <Animated.View entering={FadeIn.duration(400).delay(160)}>
          <Text style={s.bottom}>{notice || '걷고, 만나고, 함께 자라요.'}</Text>
        </Animated.View>
      </View>
    </View>
  );
}

function Paw({ delay }: { delay: number }) {
  const opacity = useSharedValue(0.2);
  useEffect(() => {
    opacity.set(
      withDelay(
        delay,
        withRepeat(withSequence(withTiming(0.95, { duration: 380, easing: EASE }), withTiming(0.2, { duration: 380, easing: EASE })), -1),
      ),
    );
    return () => cancelAnimation(opacity);
  }, [delay, opacity]);
  const blink = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return <Animated.View style={[s.paw, blink]} />;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFF3E7' },
  sun: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: '#FFD7B0',
    opacity: 0.55,
  },
  hill: {
    position: 'absolute',
    width: 420,
    height: 420,
    borderRadius: 210,
    backgroundColor: '#F4D2B0',
    opacity: 0.45,
  },
  stage: { flex: 1, justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 28 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 22, maxWidth: 420, width: '100%' },
  hero: { alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  glow: { position: 'absolute', alignSelf: 'center', top: '8%', backgroundColor: '#FFE9CF', opacity: 0.95 },
  mark: { zIndex: 1 },
  shadow: { position: 'absolute', alignSelf: 'center', bottom: 2, borderRadius: 999, backgroundColor: '#C9844A' },
  copy: { alignItems: 'center', gap: 8 },
  eyebrow: { fontSize: 10, letterSpacing: 2.4, color: '#C4844E', fontWeight: '800' },
  title: { fontSize: 36, letterSpacing: -1.2, fontWeight: '900', color: '#5C3324', textAlign: 'center' },
  run: { color: '#FB7103' },
  rule: { width: 36, height: 3, borderRadius: 99, backgroundColor: '#FB7103', marginTop: 2, opacity: 0.85 },
  caption: { fontSize: 14, color: '#A07155', fontWeight: '600', textAlign: 'center' },
  paws: { flexDirection: 'row', gap: 10, paddingTop: 4 },
  paw: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E28A43' },
  bottom: { color: '#BE9B80', fontSize: 12, letterSpacing: 0.3, textAlign: 'center', fontWeight: '600', lineHeight: 18 },
});
