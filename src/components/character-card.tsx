import { Image } from '@/components/gacha-image';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { GradeBadge } from '@/components/grade-badge';
import { GRADES, type Character } from '@/constants/characters';
import { useColors } from '@/hooks/use-colors';
import { COLLECTION_DATA } from '@/constants/gacha.generated';

const EVOLUTION_COLLECTIONS = new Set(
  COLLECTION_DATA.filter((c) => c.acquisition === 'evolution').map((c) => c.id),
);

type Props = {
  character: Character;
  width: number;
  /** Unowned characters render as a silhouette with a clear undiscovered label. */
  owned?: boolean;
  /** Shows a ×N ownership badge when supplied. */
  count?: number;
};

export const CharacterCard = memo(function CharacterCard({ character, width, owned = true, count = 0 }: Props) {
  const colors = useColors();
  const { color } = GRADES[character.grade];
  const rare = owned && character.grade !== 'N';
  const evolved = EVOLUTION_COLLECTIONS.has(character.collection);
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
        {owned ? character.name : '미발견'}
      </Text>
      <View style={styles.gradeBadge}>
        <GradeBadge grade={character.grade} />
      </View>
      {evolved && <Text style={{position:'absolute',bottom:4,fontSize:9,fontWeight:'800',color}}>✦ 진화 전용</Text>}
      {count > 0 && (
        <View style={[styles.countBadge, { backgroundColor: colors.primary }]}>
          <Text style={styles.countLabel}>×{count}</Text>
        </View>
      )}
    </View>
  );
});

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
    lineHeight: 20,
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
