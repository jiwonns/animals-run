import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { GradeBadge } from '@/components/grade-badge';
import { GRADES, type Character } from '@/constants/characters';
import { useColors } from '@/hooks/use-colors';

type Props = {
  character: Character;
  width: number;
  /** Unowned characters render as a silhouette named "???". */
  owned?: boolean;
  /** Shows a ×N badge when above 1. */
  count?: number;
};

export function CharacterCard({ character, width, owned = true, count = 0 }: Props) {
  const colors = useColors();
  const { color } = GRADES[character.grade];
  const rare = owned && character.grade !== 'N';
  return (
    <View
      style={[
        styles.cell,
        { width, backgroundColor: colors.surface },
        rare && { borderWidth: 1.5, borderColor: `${color}66` },
      ]}>
      <Image
        source={character.thumb}
        style={styles.image}
        contentFit="contain"
        tintColor={owned ? undefined : colors.silhouette}
      />
      <Text style={[styles.name, { color: owned ? colors.text : colors.secondary }]} numberOfLines={1}>
        {owned ? character.name : '???'}
      </Text>
      <View style={styles.gradeBadge}>
        <GradeBadge grade={character.grade} />
      </View>
      {count > 1 && (
        <View style={[styles.countBadge, { backgroundColor: colors.primary }]}>
          <Text style={styles.countLabel}>×{count}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cell: {
    aspectRatio: 0.85,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  image: {
    width: '80%',
    aspectRatio: 1,
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  gradeBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
  },
  countBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  countLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
});
