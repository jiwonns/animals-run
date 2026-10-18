import { StyleSheet, Text, View } from 'react-native';

import { useColors } from '@/hooks/use-colors';

export function CoinBadge({ coins }: { coins: number }) {
  const colors = useColors();
  return (
    <View
      accessibilityLabel={`보유 코인 ${coins}개`}
      style={[styles.badge, { backgroundColor: colors.surface }]}>
      <View style={styles.coin}>
        <Text style={styles.coinMark}>C</Text>
      </View>
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
