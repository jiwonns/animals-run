import { StyleSheet, Text, View } from 'react-native';

import { useColors } from '@/hooks/use-colors';

export const TICKET_COLOR = '#8B5CF6';

export function TicketBadge({ tickets }: { tickets: number }) {
  const colors = useColors();
  return (
    <View accessibilityLabel={`보유 뽑기권 ${tickets}장`} style={[styles.badge, { backgroundColor: colors.surface }]}>
      <View style={styles.ticket}>
        <Text style={styles.ticketMark}>T</Text>
      </View>
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
