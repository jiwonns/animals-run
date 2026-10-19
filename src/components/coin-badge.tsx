import { StyleSheet, Text, View } from 'react-native';

import { useColors } from '@/hooks/use-colors';

export function CoinToken({ size = 22 }: { size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#FFC744', borderWidth: Math.max(1, size * .075), borderColor: '#D99818', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
    <View style={{ position: 'absolute', width: size * .72, height: size * .72, borderRadius: size, borderWidth: Math.max(.7, size * .035), borderColor: '#FFF1AB', backgroundColor: '#FFD76A' }} />
    <View style={{ position: 'absolute', width: size * .64, height: size * .13, backgroundColor: '#FFF6BF', opacity: .65, top: size * .05, left: size * .02, transform: [{ rotate: '-32deg' }] }} />
    <Text style={{ color: '#A56B0D', fontSize: size * .49, lineHeight: size * .62, fontWeight: '900' }}>C</Text>
  </View>;
}

export function CoinBadge({ coins }: { coins: number }) {
  const colors = useColors();
  return (
    <View
      accessibilityLabel={`보유 코인 ${coins}개`}
      style={[styles.badge, { backgroundColor: colors.surface }]}>
      <CoinToken />
      <Text style={[styles.amount, { color: colors.text }]}>{coins.toLocaleString()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 6,
    paddingRight: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  coin: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFC531',
    borderWidth: 2,
    borderColor: '#E8A300',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinMark: {
    color: '#9A6A00',
    fontSize: 11,
    fontWeight: '900',
  },
  amount: {
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
