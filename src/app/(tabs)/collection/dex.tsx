import { FlatList } from '@/components/refreshable';
import { useListWindow } from '@/hooks/use-list-window';
import { useCatalog } from '@/providers/catalog-provider';
import { memo, useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CharacterCard } from '@/components/character-card';
import { useMedals } from '@/hooks/use-medals';
import { RunningLoader } from '@/components/running-loader';
import { CHARACTERS, speciesGroups, type Character } from '@/constants/characters';
import { useColors } from '@/hooks/use-colors';
import { useGridCellWidth } from '@/hooks/use-grid-cell-width';
import { useSession } from '@/providers/session-provider';

const COLUMNS = 3;
const PADDING = 20;
const GAP = 12;
type HeaderRow = { type: 'header'; key: string; name: string; have: number; total: number };
type GridRow = { type: 'grid'; key: string; characters: Character[] };
type Row = HeaderRow | GridRow;

export default function DexScreen() {
  const { version } = useCatalog();
  const colors = useColors();
  const cellWidth = useGridCellWidth(COLUMNS, PADDING, GAP);
  const { user, profile } = useSession();
  const { failed } = useMedals(user?.uid);
  const owned = profile?.characters ?? EMPTY_OWNED;
  const ownedSet = useMemo(() => {
    const next = new Set<string>();
    for (const [id, count] of Object.entries(owned)) if ((count ?? 0) > 0) next.add(id);
    return next;
  }, [owned]);
  const rows = useMemo(() => {
    void version;
    const next: Row[] = [];
    for (const collection of speciesGroups()) {
      const characters = collection.characters;
      let have = 0;
      for (const character of characters) if (ownedSet.has(character.id)) have += 1;
      next.push({
        type: 'header',
        key: 'collection:' + collection.id,
        name: collection.name,
        have,
        total: characters.length,
      });
      for (let i = 0; i < characters.length; i += COLUMNS) {
        next.push({
          type: 'grid',
          key: collection.id + ':' + i,
          characters: characters.slice(i, i + COLUMNS),
        });
      }
    }
    return next;
  }, [ownedSet, version]);
  const totalHave = useMemo(() => {
    void version;
    return CHARACTERS.reduce((sum, c) => sum + (ownedSet.has(c.id) ? 1 : 0), 0);
  }, [ownedSet, version]);
  const page = useListWindow(rows, user?.uid ?? '');
  const renderRow = useCallback(
    ({ item }: { item: Row }) =>
      item.type === 'header' ? (
        <DexHeader name={item.name} have={item.have} total={item.total} titleColor={colors.text} metaColor={colors.secondary} />
      ) : (
        <DexGrid characters={item.characters} width={cellWidth} owned={ownedSet} />
      ),
    [cellWidth, colors.secondary, colors.text, ownedSet],
  );

  if (!profile) return <RunningLoader label="동물 도감을 여는 중" style={styles.loading}/>;
  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      data={page.data}
      keyExtractor={rowKey}
      renderItem={renderRow}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: PADDING, gap: 14, paddingBottom: 32 }}
      initialNumToRender={8}
      maxToRenderPerBatch={8}
      windowSize={5}
      removeClippedSubviews
      onEndReachedThreshold={0.4}
      onEndReached={page.loadMore}
      ListHeaderComponent={
        <View style={{ gap: 10 }}>
          <Text style={[styles.total, { color: colors.secondary }]}>전체 {totalHave} / {CHARACTERS.length}</Text>
          <Text style={{ color: colors.secondary }}>동물별로 모든 모습을 모아보세요. 진화한 동물은 진화로만 만나요.</Text>
          {failed && <Text style={{ color: colors.secondary }}>훈장 정보를 불러오지 못했어요.</Text>}
        </View>
      }
    />
  );
}

const EMPTY_OWNED: Partial<Record<string, number>> = {};
const rowKey = (row: Row) => row.key;

const DexHeader = memo(function DexHeader({
  name,
  have,
  total,
  titleColor,
  metaColor,
}: {
  name: string;
  have: number;
  total: number;
  titleColor: string;
  metaColor: string;
}) {
  return (
    <View style={styles.collectionHeader}>
      <Text style={[styles.collectionTitle, { color: titleColor }]}>{name}</Text>
      <Text style={{ color: metaColor }}>{have} / {total}</Text>
    </View>
  );
});

const DexGrid = memo(function DexGrid({
  characters,
  width,
  owned,
}: {
  characters: Character[];
  width: number;
  owned: Set<string>;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: GAP }}>
      {characters.map((character) => (
        <CharacterCard
          key={character.id}
          character={character}
          width={width}
          owned={owned.has(character.id)}
        />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  loading: {
    marginTop: 48,
  },
  total: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'right',
    lineHeight: 22,
  },
  collectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  collectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 24,
    flex: 1,
    paddingRight: 8,
  },
});
