import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Image } from './gacha-image';
import { CHARACTER_BY_ID, GRADES, type CharacterId } from '@/constants/characters';
import { DUEL_MOVES, DUEL_STATS, turnSide, type DuelState } from '@/lib/duel';
import type { Duel } from '@/lib/duel-service';

function Health({ id, hp, energy, guarded, enemy }: { id: CharacterId; hp: number; energy: number; guarded: boolean; enemy?: boolean }) {
  const ch = CHARACTER_BY_ID[id];
  const stats = DUEL_STATS[ch.grade];
  return <View style={s.health}>
    <View style={s.healthTop}><Text style={[s.grade, { color: GRADES[ch.grade].color }]}>{ch.grade}</Text><Text style={s.name}>{ch.name}</Text></View>
    <View accessibilityRole="progressbar" accessibilityLabel={`${ch.name} 체력`} accessibilityValue={{ min: 0, max: stats.hp, now: hp }} style={s.track}>
      <View style={{ height: '100%', width: `${hp / stats.hp * 100}%`, borderRadius: 8, backgroundColor: hp < stats.hp * 0.25 ? '#FF737D' : enemy ? '#B59BFF' : '#5ED7C8' }} />
    </View>
    <View style={s.healthTop}><Text style={s.hp}>{hp}<Text style={{ color: '#797E97' }}> / {stats.hp}</Text></Text><Text style={s.hp}>{guarded ? '가드 ON' : '기력'}</Text></View>
    <View style={s.energy}>{[0,1,2,3,4].map(n => <View key={n} style={[s.pip, { backgroundColor: n < energy ? '#FFD28A' : '#35394E' }]} />)}</View>
  </View>;
}
export function DuelStage({ duel, before, viewer }: { duel: Duel; before?: DuelState | null; viewer: string }) {
  const state = duel.state!;
  const player = CHARACTER_BY_ID[duel.playerId];
  const rival = CHARACTER_BY_ID[duel.rivalId!];
  const [action] = useState(() => new Animated.Value(0));
  const [impact] = useState(() => new Animated.Value(0));
  const [reduceMotion, setReduceMotion] = useState(false);
  const isPlayerAction = state.turn % 2 === 1;
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (!state.turn || reduceMotion) return;
    action.setValue(0); impact.setValue(0);
    const motion = Animated.sequence([
      Animated.timing(action, { toValue: 1, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(action, { toValue: 0, duration: 280, useNativeDriver: true }),
        Animated.sequence([Animated.timing(impact, { toValue: 1, duration: 90, useNativeDriver: true }), Animated.timing(impact, { toValue: 0, duration: 350, useNativeDriver: true })]),
      ]),
    ]);
    motion.start();
    return () => motion.stop();
  }, [action, impact, state.turn, reduceMotion]);
  const attacks = duel.lastMove === 'attack' || duel.lastMove === 'burst';
  const pDamage = before ? Math.max(0, before.pHp - state.pHp) : 0;
  const rDamage = before ? Math.max(0, before.rHp - state.rHp) : 0;
  const actorId = turnSide(state) === 'player' ? duel.owner : duel.recipient;
  const label = state.winner !== 'none' ? 'MATCH COMPLETE' : duel.mode === 'solo' && turnSide(state) === 'rival' ? '상대의 행동' : actorId === viewer ? '당신의 차례' : '친구의 차례를 기다리는 중';
  return <View style={s.stage}>
    <View style={s.scoreboard}><Health id={player.id} hp={state.pHp} energy={state.pEnergy} guarded={state.pGuard} /><Text style={s.vs}>VS</Text><Health id={rival.id} hp={state.rHp} energy={state.rEnergy} guarded={state.rGuard} enemy /></View>
    <View style={s.scene}>
      <View style={s.moon} /><View style={s.horizon} />
      <View style={[s.platform, { left: '3%', borderColor: '#5ED7C85C' }]} /><View style={[s.platform, { right: '3%', borderColor: '#BAA0FF5C' }]} />
      <View style={s.characters}>
        {[player, rival].map((ch, i) => {
          const acting = isPlayerAction === (i === 0);
          const damage = i === 0 ? pDamage : rDamage;
          const offset = acting && attacks ? action.interpolate({ inputRange: [0, 1], outputRange: [0, i === 0 ? 32 : -32] }) : damage > 0 ? impact.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, i === 0 ? -7 : 7, 0] }) : 0;
          return <Animated.View key={`${ch.id}:${i}`} style={[s.character, { transform: [{ translateX: offset }, { scale: acting && duel.lastMove === 'burst' ? action.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) : 1 }] }]}>
            <Image source={ch.image} contentFit="contain" style={s.animal} />
            {damage > 0 && <Animated.Text style={[s.damage, { opacity: impact.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 1, 1] }), transform: [{ translateY: impact.interpolate({ inputRange: [0, 1], outputRange: [0, -25] }) }] }]}>−{damage}</Animated.Text>}
            {(i === 0 ? state.pGuard : state.rGuard) && <View style={s.shield}><Text style={{ color: '#BCD7FF', fontWeight: '900' }}>GUARD</Text></View>}
          </Animated.View>;
        })}
      </View>
      <Text style={s.round}>ROUND {Math.min(15, Math.floor(state.turn / 2) + 1)} <Text style={{ color: '#676D88' }}>/ 15</Text></Text>
    </View>
    <View accessibilityLiveRegion="polite" style={s.ticker}><View style={s.dot} /><Text style={s.tickerText}>{label}</Text>{duel.lastMove && <Text style={s.last}>{DUEL_MOVES[duel.lastMove].title}</Text>}</View>
  </View>;
}
const s = StyleSheet.create({
  stage: { backgroundColor: '#15192D', borderWidth: 1, borderColor: '#30354C', borderRadius: 24, overflow: 'hidden' },
  scoreboard: { padding: 16, flexDirection: 'row', gap: 10, alignItems: 'center' }, health: { flex: 1, minWidth: 0, gap: 7 },
  healthTop: { flexDirection: 'row', gap: 6, justifyContent: 'space-between', alignItems: 'center' },
  name: { color: '#F7F5FF', fontSize: 11, fontWeight: '700', flex: 1 }, grade: { fontSize: 11, fontWeight: '900' },
  track: { height: 7, backgroundColor: '#32364C', borderRadius: 8 }, hp: { color: '#DADCEC', fontSize: 10, fontWeight: '700' },
  energy: { flexDirection: 'row', gap: 4 }, pip: { height: 4, flex: 1, borderRadius: 2 }, vs: { color: '#F2D096', fontWeight: '900', fontSize: 13 },
  scene: { height: 265, overflow: 'hidden', backgroundColor: '#101526' },
  moon: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: '#8170CB10', top: -100, alignSelf: 'center', borderColor: '#9A89D922', borderWidth: 1 },
  horizon: { position: 'absolute', left: '-10%', right: '-10%', bottom: -80, height: 180, borderRadius: 200, borderWidth: 1, borderColor: '#6F659844', backgroundColor: '#24233A' },
  platform: { position: 'absolute', bottom: 43, width: '43%', height: 38, borderRadius: 100, borderWidth: 2, backgroundColor: '#0A1020', transform: [{ scaleY: 0.65 }] },
  characters: { flexDirection: 'row', paddingTop: 20, flex: 1 }, character: { flex: 1, position: 'relative', justifyContent: 'center', alignItems: 'center' },
  animal: { width: '115%', height: 205 }, damage: { position: 'absolute', top: 50, color: '#FFD18B', fontSize: 34, fontWeight: '900', textShadowColor: '#482C1C', textShadowRadius: 5 },
  shield: { position: 'absolute', bottom: 60, borderRadius: 30, borderColor: '#9CC6FF88', backgroundColor: '#6EAAFF33', borderWidth: 2, padding: 12 },
  round: { position: 'absolute', bottom: 14, alignSelf: 'center', color: '#E6DEFA', fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  ticker: { minHeight: 45, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: '#30354C' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#5ED7C8' }, tickerText: { color: '#D9DDEC', fontSize: 11, flex: 1 }, last: { color: '#A7ABC2', fontSize: 10 },
});
