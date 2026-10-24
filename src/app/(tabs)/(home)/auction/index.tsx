import { useCatalog } from '@/providers/catalog-provider';
import { FlatList, ScrollView } from '@/components/refreshable';
import { Image } from '@/components/gacha-image';
import { router, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuctionOfferSheet } from '@/components/auction-offer-sheet';
import { CoinBadge } from '@/components/coin-badge';
import { GradeBadge } from '@/components/grade-badge';
import { RunningLoader } from '@/components/running-loader';
import { CHARACTERS, COLLECTIONS, GRADE_ORDER, GRADES, type Character, type Grade } from '@/constants/characters';
import { useAuction, useAuctionBandSweep, useAuctionQuoteSettle, useMyBids, useMyListings } from '@/hooks/use-auction';
import { useColors } from '@/hooks/use-colors';
import { useListWindow } from '@/hooks/use-list-window';
import { useGridCellWidth } from '@/hooks/use-grid-cell-width';
import { lastWindowVolume, marketBand, nextAuctionSlot, type AuctionQuote } from '@/lib/auction';
import { AUCTION_BID_COLOR, AUCTION_SELL_COLOR, auctionSearchHit } from '@/lib/auction-ui';
import { useSession } from '@/providers/session-provider';

const COLUMNS = 2;
const PADDING = 20;
const GAP = 10;

type Scope = 'live' | 'mine';

const SCOPES: { id: Scope; label: string }[] = [
  { id: 'live', label: '거래중' },
  { id: 'mine', label: '내 등록' },
];

export default function AuctionCatalogScreen() {
  useCatalog();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, profile } = useSession();
  const { listings, bids, quotes, failed } = useAuction();
  const mineSell = useMyListings(user?.uid, listings);
  const mineBuy = useMyBids(user?.uid, bids);
  useAuctionBandSweep(user?.uid, listings, bids, quotes);
  useAuctionQuoteSettle(quotes);
  const cellWidth = useGridCellWidth(COLUMNS, PADDING, GAP);
  const [search, setSearch] = useState('');
  const [grade, setGrade] = useState<Grade | null>(null);
  const [scope, setScope] = useState<Scope>('live');
  const [offering, setOffering] = useState(false);
  const lastVolume = useMemo(
    () => Object.values(quotes).reduce((sum, quote) => sum + lastWindowVolume(quote), 0),
    [quotes],
  );
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
  const liveCount = useMemo(() => {
    const ids = new Set([...sellCounts.keys(), ...buyCounts.keys()]);
    return [...ids].filter((id) => (sellCounts.get(id) ?? 0) + (buyCounts.get(id) ?? 0) > 0).length;
  }, [buyCounts, sellCounts]);
  const ready = listings !== null && bids !== null;

  const rows = useMemo(() => {
    return CHARACTERS.filter((character) => {
      if (grade && character.grade !== grade) return false;
      if (!auctionSearchHit(character, search)) return false;
      const sell = sellCounts.get(character.id) ?? 0;
      const buy = buyCounts.get(character.id) ?? 0;
      if (scope === 'mine') return mineIds.has(character.id);
      return sell + buy > 0;
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

  const page = useListWindow(rows, `${scope}:${grade ?? 'all'}:${search}`);
  const scopeCount = (id: Scope) => (id === 'mine' ? mineIds.size : liveCount);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.toolbar}>
        <View style={[styles.searchWrap, { backgroundColor: colors.surface }]}>
          <TextInput
            accessibilityLabel="동물 검색"
            placeholder="이름·등급·종류"
            placeholderTextColor={colors.secondary}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            returnKeyType="search"
            style={[styles.search, { color: colors.text }]}
          />
          {search ? (
            <Pressable accessibilityRole="button" accessibilityLabel="검색 지우기" onPress={() => setSearch('')} hitSlop={8}>
              <Text style={[styles.clear, { color: colors.secondary }]}>지우기</Text>
            </Pressable>
          ) : null}
        </View>
        <CoinBadge coins={profile?.coins ?? 0} />
      </View>
      <View style={[styles.scopes, { backgroundColor: colors.surface }]}>
        {SCOPES.map((item) => {
          const selected = scope === item.id;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setScope(item.id)}
              style={[styles.scope, selected && { backgroundColor: colors.background }]}>
              <Text style={[styles.scopeLabel, { color: selected ? colors.text : colors.secondary }]}>
                {item.label} {scopeCount(item.id)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chips}>
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
              <Text style={[styles.chipLabel, { color: selected ? color : colors.text }]} numberOfLines={1}>
                {g ? GRADES[g].label : '전체 등급'}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <Text style={[styles.tick, { color: colors.secondary }]}>
        {`다음 시세 ${nextHour}시`}
        {lastVolume > 0 ? ` · 지난 ${lastVolume.toLocaleString()}건` : ' · 지난 2시간 거래가 아직 없어요'}
      </Text>

      {failed ? (
        <Text style={[styles.empty, { color: colors.secondary }]}>목록을 불러오지 못했어요. 아래로 당겨 다시 시도해주세요.</Text>
      ) : !ready ? (
        <RunningLoader label="경매장을 열고 있어요" />
      ) : (
        <FlatList
          data={page.data}
          numColumns={COLUMNS}
          keyExtractor={(item) => item.id}
          onEndReached={page.loadMore}
          onEndReachedThreshold={0.4}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={5}
          columnWrapperStyle={styles.columns}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.secondary }]}>
              {scope === 'mine' ? '내가 올린 동물이 없어요.' : search || grade ? '검색과 맞는 거래가 없어요.' : '지금 올라온 거래가 없어요.'}
            </Text>
          }
          renderItem={({ item }) => (
            <MarketCard
              character={item}
              width={cellWidth}
              sellCount={sellCounts.get(item.id) ?? 0}
              buyCount={buyCounts.get(item.id) ?? 0}
              owned={profile?.characters[item.id] ?? 0}
              quote={quotes[item.id]}
            />
          )}
        />
      )}
      <View style={[styles.bar, { paddingBottom: Math.max(12, insets.bottom), backgroundColor: colors.background }]}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setOffering(true)}
          style={[styles.offer, { backgroundColor: AUCTION_SELL_COLOR }]}>
          <Text style={styles.offerLabel}>여분 올리기</Text>
        </Pressable>
      </View>
      {offering ? (
        <AuctionOfferSheet
          mode="sell"
          initial={null}
          gradeFilter={grade}
          quotes={quotes}
          busy={false}
          onClose={() => setOffering(false)}
          onDone={() => setOffering(false)}
        />
      ) : null}
    </View>
  );
}

function MarketCard({
  character,
  width,
  sellCount,
  buyCount,
  owned,
  quote,
}: {
  character: Character;
  width: number;
  sellCount: number;
  buyCount: number;
  owned: number;
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
        {collection ? `${collection.replace(' 컬렉션', '')} · ` : ''}
        {band.quote.toLocaleString()}코인
        {owned ? ` · 보유 ${owned}` : ''}
        {volume > 0 ? ` · ${volume}건` : ''}
      </Text>
      <View style={styles.counts}>
        <View style={[styles.pill, { backgroundColor: sellCount ? `${AUCTION_SELL_COLOR}18` : colors.background }]}>
          <Text style={[styles.count, { color: sellCount ? AUCTION_SELL_COLOR : colors.secondary }]}>팔아요 {sellCount}</Text>
        </View>
        <View style={[styles.pill, { backgroundColor: buyCount ? `${AUCTION_BID_COLOR}18` : colors.background }]}>
          <Text style={[styles.count, { color: buyCount ? AUCTION_BID_COLOR : colors.secondary }]}>살게요 {buyCount}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: PADDING, paddingTop: 12 },
  searchWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: 16, paddingHorizontal: 14 },
  search: { flex: 1, paddingVertical: 10, fontSize: 15 },
  clear: { fontSize: 13, fontWeight: '700' },
  scopes: { marginHorizontal: PADDING, marginTop: 10, flexDirection: 'row', borderRadius: 14, padding: 4, gap: 4 },
  scope: { flex: 1, minHeight: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  scopeLabel: { fontSize: 13, fontWeight: '800' },
  chipScroll: { flexGrow: 0, flexShrink: 0 },
  chips: { paddingHorizontal: PADDING, paddingTop: 10, paddingBottom: 2, gap: 8, alignItems: 'center', flexDirection: 'row' },
  chip: {
    flexGrow: 0,
    flexShrink: 0,
    minHeight: 36,
    borderRadius: 999,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  chipLabel: { fontSize: 13, fontWeight: '800' },
  tick: { paddingHorizontal: PADDING, paddingTop: 10, paddingBottom: 2, fontSize: 12, fontWeight: '700' },
  list: { paddingHorizontal: PADDING, paddingTop: 12, paddingBottom: 16 },
  bar: { paddingHorizontal: PADDING, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#00000014' },
  offer: { minHeight: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  offerLabel: { color: '#fff', fontSize: 16, fontWeight: '800' },
  columns: { gap: GAP, marginBottom: GAP },
  empty: { textAlign: 'center', padding: 28, lineHeight: 22 },
  card: { borderRadius: 18, padding: 12, gap: 6 },
  thumb: { width: '100%', aspectRatio: 1 },
  cardTop: { position: 'absolute', top: 10, left: 10 },
  name: { fontSize: 15, fontWeight: '800' },
  meta: { fontSize: 11, fontWeight: '600' },
  counts: { flexDirection: 'row', gap: 6 },
  pill: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3 },
  count: { fontSize: 11, fontWeight: '800' },
});
