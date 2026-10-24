import { useCatalog } from '@/providers/catalog-provider';
import { FlatList, ScrollView } from '@/components/refreshable';
import { Image } from '@/components/gacha-image';
import { router, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { CoinBadge } from '@/components/coin-badge';
import { GradeBadge } from '@/components/grade-badge';
import { RunningLoader } from '@/components/running-loader';
import { CHARACTERS, COLLECTIONS, GRADE_ORDER, GRADES, type Character, type Grade } from '@/constants/characters';
import { useAuction, useAuctionBandSweep, useAuctionQuoteSettle, useMyBids, useMyListings } from '@/hooks/use-auction';
import { useColors } from '@/hooks/use-colors';
import { useGridCellWidth } from '@/hooks/use-grid-cell-width';
import { lastWindowBoard, lastWindowVolume, marketBand, nextAuctionSlot, type AuctionQuote } from '@/lib/auction';
import { AUCTION_BID_COLOR, AUCTION_SELL_COLOR, auctionSearchHit } from '@/lib/auction-ui';
import { useSession } from '@/providers/session-provider';

const COLUMNS = 2;
const PADDING = 20;
const GAP = 10;

type Scope = 'all' | 'live' | 'mine';

const SCOPES: { id: Scope; label: string }[] = [
  { id: 'all', label: '모든 동물' },
  { id: 'live', label: '거래중' },
  { id: 'mine', label: '내 등록' },
];

export default function AuctionCatalogScreen() {
  useCatalog();
  const colors = useColors();
  const { user, profile } = useSession();
  const { listings, bids, quotes, failed } = useAuction();
  const mineSell = useMyListings(user?.uid, listings);
  const mineBuy = useMyBids(user?.uid, bids);
  useAuctionBandSweep(user?.uid, listings, bids, quotes);
  useAuctionQuoteSettle(quotes);
  const cellWidth = useGridCellWidth(COLUMNS, PADDING, GAP);
  const [search, setSearch] = useState('');
  const [grade, setGrade] = useState<Grade | null>(null);
  const [scope, setScope] = useState<Scope>('all');
  const lastWindow = useMemo(() => lastWindowBoard(quotes), [quotes]);
  const nextHour = new Date(nextAuctionSlot() + 9 * 60 * 60 * 1000).getUTCHours();
  const mineIds = useMemo(() => new Set([...mineSell, ...mineBuy].map((row) => row.character)), [mineBuy, mineSell]);
  const sellCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of listings ?? []) map.set(row.character, (map.get(row.character) ?? 0) + 1);
    return map;
  }, [listings]);
  const buyCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of bids ?? []) map.set(row.character, (map.get(row.character) ?? 0) + 1);
    return map;
  }, [bids]);
  const ready = listings !== null && bids !== null;

  const rows = useMemo(() => {
    return CHARACTERS.filter((character) => {
      if (grade && character.grade !== grade) return false;
      if (!auctionSearchHit(character, search)) return false;
      const sell = sellCounts.get(character.id) ?? 0;
      const buy = buyCounts.get(character.id) ?? 0;
      if (scope === 'live' && sell + buy === 0) return false;
      if (scope === 'mine' && !mineIds.has(character.id)) return false;
      return true;
    }).sort((a, b) => {
      const aLive = (sellCounts.get(a.id) ?? 0) + (buyCounts.get(a.id) ?? 0);
      const bLive = (sellCounts.get(b.id) ?? 0) + (buyCounts.get(b.id) ?? 0);
      return (
        bLive - aLive ||
        GRADE_ORDER.indexOf(a.grade) - GRADE_ORDER.indexOf(b.grade) ||
        a.name.localeCompare(b.name, 'ko')
      );
    });
  }, [buyCounts, grade, mineIds, scope, search, sellCounts]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.toolbar}>
        <TextInput
          accessibilityLabel="동물 검색"
          placeholder="이름·등급·종류 검색"
          placeholderTextColor={colors.secondary}
          value={search}
          onChangeText={setSearch}
          style={[styles.search, { backgroundColor: colors.surface, color: colors.text }]}
        />
        <CoinBadge coins={profile?.coins ?? 0} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {SCOPES.map((item) => {
          const selected = scope === item.id;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setScope(item.id)}
              style={[styles.chip, { backgroundColor: selected ? colors.primary : colors.surface }]}>
              <Text style={[styles.chipLabel, { color: selected ? '#fff' : colors.text }]}>
                {item.label}
                {item.id === 'mine' && mineIds.size ? ` ${mineIds.size}` : ''}
              </Text>
            </Pressable>
          );
        })}
        {[null, ...GRADE_ORDER].map((g) => {
          const selected = grade === g;
          const color = g ? GRADES[g].color : colors.text;
          return (
            <Pressable
              key={g ?? 'all'}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setGrade(g)}
              style={[styles.chip, { backgroundColor: selected ? `${color}22` : colors.surface, borderColor: selected ? color : 'transparent' }]}>
              <Text style={[styles.chipLabel, { color: selected ? color : colors.text }]}>{g ? GRADES[g].label : '전체 등급'}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <Text style={[styles.hint, { color: colors.secondary }]}>
        {`동물을 누르면 시세와 팔아요·살게요 목록이 나와요. 시세는 한국 시간 2시간마다 바뀌고, 다음 갱신은 ${nextHour}시예요.`}
      </Text>
      {lastWindow.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.volumeRow}>
          {lastWindow.map((row) => {
            const character = CHARACTERS.find((c) => c.id === row.id);
            if (!character) return null;
            return (
              <Pressable
                key={row.id}
                accessibilityRole="button"
                onPress={() => router.push(`/auction/${row.id}` as Href)}
                style={[styles.volumeCard, { backgroundColor: colors.surface }]}>
                <Image source={character.thumb} style={styles.volumeThumb} contentFit="contain" />
                <Text style={[styles.volumeName, { color: colors.text }]} numberOfLines={1}>
                  {character.name}
                </Text>
                <Text style={[styles.volumeMeta, { color: colors.secondary }]}>
                  {row.quote.toLocaleString()} · {row.count.toLocaleString()}건
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {failed ? (
        <Text style={[styles.empty, { color: colors.secondary }]}>목록을 불러오지 못했어요. 아래로 당겨 다시 시도해주세요.</Text>
      ) : !ready ? (
        <RunningLoader label="경매장을 열고 있어요" />
      ) : (
        <FlatList
          data={rows}
          numColumns={COLUMNS}
          keyExtractor={(item) => item.id}
          columnWrapperStyle={styles.columns}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.secondary }]}>
              {scope === 'mine' ? '내가 올린 동물이 없어요.' : scope === 'live' ? '지금 올라온 거래가 없어요.' : '검색과 맞는 동물이 없어요.'}
            </Text>
          }
          renderItem={({ item }) => (
            <MarketCard
              character={item}
              width={cellWidth}
              sellCount={sellCounts.get(item.id) ?? 0}
              buyCount={buyCounts.get(item.id) ?? 0}
              quote={quotes[item.id]}
            />
          )}
        />
      )}
    </View>
  );
}

function MarketCard({
  character,
  width,
  sellCount,
  buyCount,
  quote,
}: {
  character: Character;
  width: number;
  sellCount: number;
  buyCount: number;
  quote?: AuctionQuote;
}) {
  const colors = useColors();
  const band = marketBand(character.id, quote);
  const volume = lastWindowVolume(quote);
  const collection = COLLECTIONS.find((c) => c.id === character.collection)?.name;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${character.name} 시세 ${band.quote}`}
      onPress={() => router.push(`/auction/${character.id}` as Href)}
      style={[styles.card, { width, backgroundColor: colors.surface }]}>
      <Image source={character.thumb} style={styles.thumb} contentFit="contain" />
      <View style={styles.cardTop}>
        <GradeBadge grade={character.grade} />
      </View>
      <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
        {character.name}
      </Text>
      <Text style={[styles.meta, { color: colors.secondary }]} numberOfLines={1}>
        {collection ? `${collection.replace(' 컬렉션', '')} · ` : ''}시세 {band.quote.toLocaleString()}
        {volume > 0 ? ` · ${volume}건` : ''}
      </Text>
      <View style={styles.counts}>
        <Text style={[styles.count, { color: sellCount ? AUCTION_SELL_COLOR : colors.secondary }]}>팔아요 {sellCount}</Text>
        <Text style={[styles.count, { color: buyCount ? AUCTION_BID_COLOR : colors.secondary }]}>살게요 {buyCount}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: PADDING, paddingTop: 12 },
  search: { flex: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
  chips: { paddingHorizontal: PADDING, paddingTop: 10, gap: 8, alignItems: 'center' },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1.5 },
  chipLabel: { fontSize: 13, fontWeight: '800' },
  hint: { paddingHorizontal: PADDING, paddingTop: 10, fontSize: 12, lineHeight: 17 },
  volumeRow: { paddingHorizontal: PADDING, paddingTop: 10, gap: 8 },
  volumeCard: { width: 92, alignItems: 'center', gap: 2, borderRadius: 16, padding: 8 },
  volumeThumb: { width: 44, height: 44 },
  volumeName: { fontSize: 11, fontWeight: '800' },
  volumeMeta: { fontSize: 11, fontWeight: '700' },
  list: { paddingHorizontal: PADDING, paddingTop: 12, paddingBottom: 32 },
  columns: { gap: GAP, marginBottom: GAP },
  empty: { textAlign: 'center', padding: 28, lineHeight: 22 },
  card: { borderRadius: 18, padding: 12, gap: 4 },
  thumb: { width: '100%', aspectRatio: 1 },
  cardTop: { position: 'absolute', top: 10, left: 10 },
  name: { fontSize: 15, fontWeight: '800' },
  meta: { fontSize: 11, fontWeight: '600' },
  counts: { flexDirection: 'row', gap: 8, paddingTop: 2 },
  count: { fontSize: 12, fontWeight: '800' },
});
