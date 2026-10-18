import { StyleSheet, Text, View } from 'react-native';

import { GRADES, type Grade } from '@/constants/characters';

export function GradeBadge({ grade, showLabel = false }: { grade: Grade; showLabel?: boolean }) {
  const { label, color } = GRADES[grade];
  return (
    <View style={[styles.badge, { backgroundColor: color }]}>
      <Text style={styles.text}>{showLabel ? `${grade} ${label}` : grade}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    alignSelf: 'flex-start',
  },
  text: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
});
