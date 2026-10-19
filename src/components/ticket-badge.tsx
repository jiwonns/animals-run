import { StyleSheet, Text, View } from 'react-native';

import { useColors } from '@/hooks/use-colors';

export const TICKET_COLOR = '#8B5CF6';

export function TicketToken({ size = 24, cutoutColor = '#F2F2F7' }: { size?: number; cutoutColor?: string }) {
  return <View style={{ width: size, height: size * .75, borderRadius: size * .18, backgroundColor: TICKET_COLOR, borderWidth: Math.max(1, size * .045), borderColor: '#7445D8', alignItems: 'center', justifyContent: 'center' }}>
    <View style={{ position: 'absolute', inset: size * .10, borderWidth: .6, borderColor: '#CAB4FF', borderRadius: size * .09 }} />
    <View style={{ position: 'absolute', left: -size * .12, top: size * .24, width: size * .20, height: size * .20, borderRadius: size, backgroundColor: cutoutColor }} />
    <View style={{ position: 'absolute', right: -size * .12, top: size * .24, width: size * .20, height: size * .20, borderRadius: size, backgroundColor: cutoutColor }} />
    <Text style={{ color: '#fff', fontSize: size * .43, lineHeight: size * .55, fontWeight: '900' }}>T</Text>
  </View>;
}

export function TicketBadge({ tickets }: { tickets: number }) {
  const colors = useColors();
  return (
    <View accessibilityLabel={`보유 뽑기권 ${tickets}장`} style={[styles.badge, { backgroundColor: colors.surface }]}>
      <TicketToken cutoutColor={colors.surface} />
      <Text style={[styles.amount, { color: colors.text }]}>{tickets.toLocaleString()}</Text>
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
  ticket: {
    width: 24,
    height: 18,
    borderRadius: 4,
    backgroundColor: TICKET_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ticketMark: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
  },
  amount: {
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
