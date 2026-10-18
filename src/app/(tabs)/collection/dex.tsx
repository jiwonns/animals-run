import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { CharacterCard } from '@/components/character-card';
import { GradeBadge } from '@/components/grade-badge';
import { RunningLoader } from '@/components/running-loader';
import { CHARACTERS, charactersIn, COLLECTIONS, GRADE_ORDER, GRADES } from '@/constants/characters';
import { useColors } from '@/hooks/use-colors';
import { useGridCellWidth } from '@/hooks/use-grid-cell-width';
import { useSession } from '@/providers/session-provider';

const COLUMNS = 3;
const PADDING = 20;
const GAP = 12;

export default function DexScreen() {
  const colors = useColors();
  const cellWidth = useGridCellWidth(COLUMNS, PADDING, GAP);
  const { profile } = useSession();
  const owned = profile?.characters ?? {};
  const isOwned = (id: keyof typeof owned) => (owned[id] ?? 0) > 0;
  const progress = (list: typeof CHARACTERS) => `${list.filter((c) => isOwned(c.id)).length} / ${list.length}`;

  if (!profile) return <RunningLoader label="도감을 펼치는 중" style={styles.loading} />;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}>
      <Text style={[styles.total, { color: colors.secondary }]}>전체 {progress(CHARACTERS)}</Text>

      {GRADE_ORDER.map((grade) => {
        const collections = COLLECTIONS.filter((c) => c.grade === grade);
        if (collections.length === 0) return null;
        const members = CHARACTERS.filter((c) => c.grade === grade);
        return (
          <View key={grade} style={styles.gradeSection}>
            <View style={[styles.gradeHeader, { borderColor: GRADES[grade].color }]}>
              <GradeBadge grade={grade} />
              <Text style={[styles.gradeTitle, { color: colors.text }]}>{GRADES[grade].label}</Text>
              <Text style={[styles.progress, { color: colors.secondary }]}>{progress(members)}</Text>
            </View>

            {collections.map((collection) => {
              const characters = charactersIn(collection.id);
              return (
                <View key={collection.id} style={styles.collection}>
                  <View style={styles.collectionHeader}>
                    <Text style={[styles.collectionTitle, { color: colors.text }]}>{collection.name}</Text>
                    <Text style={[styles.progress, { color: colors.secondary }]}>{progress(characters)}</Text>
                  </View>
                  <View style={styles.grid}>
                    {characters.map((character) => (
                      <CharacterCard
                        key={character.id}
                        character={character}
                        width={cellWidth}
                        owned={isOwned(character.id)}
                      />
                    ))}
                  </View>
                </View>
              );
            })}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: {
    marginTop: 48,
  },
  content: {
    paddingHorizontal: PADDING,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 32,
  },
  total: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'right',
    marginBottom: -16,
  },
  gradeSection: {
    gap: 20,
  },
  gradeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 2,
    paddingBottom: 8,
  },
  gradeTitle: {
    fontSize: 22,
    fontWeight: '900',
    flex: 1,
  },
  collection: {
    gap: 12,
  },
  collectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  collectionTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  progress: {
    fontSize: 14,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
});
