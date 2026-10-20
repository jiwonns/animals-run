import { Pressable, Text } from 'react-native';
import { useColors } from '@/hooks/use-colors';

export function MoreButton({ expanded, onPress, remaining, label = '더보기', unit = '개' }: { expanded: boolean; onPress: () => void; remaining: number; label?: string; unit?: string }) {
  const c = useColors();
  return <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={onPress}
    style={({ pressed }) => ({ minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderRadius: 12, backgroundColor: c.surface, opacity: pressed ? 0.65 : 1 })}>
    <Text style={{ color: c.primary, fontWeight: '700' }}>{expanded ? '접기' : `${label}${remaining > 0 ? ` · ${remaining.toLocaleString()}${unit}` : ''}`}</Text>
  </Pressable>;
}
