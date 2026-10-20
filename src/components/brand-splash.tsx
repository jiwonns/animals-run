import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { Icon, ICONS } from './icon';

export function BrandSplash({ notice }: { notice?: string | null } = {}) {
  const lift = useSharedValue(0);
  useEffect(() => { lift.set(withRepeat(withSequence(withTiming(-7, { duration: 850, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 850, easing: Easing.inOut(Easing.quad) })), -1)); return () => cancelAnimation(lift); }, [lift]);
  const motion = useAnimatedStyle(() => ({ transform: [{ translateY: lift.get() }] }));
  return <View style={s.root} accessibilityLabel="Animals Run 시작 중">
    <View style={s.orb} /><View style={[s.orb, s.smallOrb]} />
    <View style={s.center}>
      <View style={s.seal}><View style={s.innerSeal} /><Animated.View style={motion}><Image source={require('../../assets/images/splash-icon.png')} style={{ width: 205, height: 205 }} contentFit="contain" /></Animated.View></View>
      <Animated.View entering={FadeInDown.duration(500)} style={{ alignItems: 'center', gap: 10 }}><Text style={s.eyebrow}>EVERY STEP, A NEW FRIEND</Text><Text style={s.title}>Animals Run</Text><Text style={s.caption}>작은 발걸음이 새로운 친구로</Text></Animated.View>
      <View style={s.paws}>{[0, 1, 2].map(i => <View key={i} style={{ opacity: .28 + i * .25, transform: [{ rotate: `${i % 2 ? 15 : -15}deg` }] }}><Icon name={ICONS.character} color="#DB8950" size={15} /></View>)}</View>
    </View><Text style={[s.bottom, { paddingHorizontal: 24, textAlign: 'center' }]}>{notice || '걷고, 만나고, 함께 자라요.'}</Text>
  </View>;
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFF3E7', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  orb: { position: 'absolute', width: 360, height: 360, borderRadius: 180, backgroundColor: '#FFDCC0', top: -160, right: -170, opacity: .65 },
  smallOrb: { width: 270, height: 270, borderRadius: 135, backgroundColor: '#FBE5C7', top: '73%', left: -160 },
  center: { alignItems: 'center', gap: 28, padding: 25 },
  seal: { width: 245, height: 245, borderRadius: 123, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E8C5A644', backgroundColor: '#FFFAF4', boxShadow: '0 12px 40px #A7622420' },
  innerSeal: { position: 'absolute', width: 220, height: 220, borderRadius: 110, borderWidth: 1, borderColor: '#E8C5A660' },
  eyebrow: { fontSize: 9, letterSpacing: 2, color: '#B17D58', fontWeight: '800' },
  title: { fontSize: 34, letterSpacing: -1, fontWeight: '900', color: '#693F2D' },
  caption: { fontSize: 13, color: '#A17A60', fontWeight: '600' },
  paws: { flexDirection: 'row', gap: 15, paddingTop: 8 },
  bottom: { position: 'absolute', bottom: 52, color: '#BE9B80', fontSize: 11, letterSpacing: .5 },
});
