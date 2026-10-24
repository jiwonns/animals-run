import { useCatalog } from '@/providers/catalog-provider';
import { FlatList } from '@/components/refreshable';
import { Image } from '@/components/gacha-image';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuctionBookRow } from '@/components/auction-book-row';
import { AuctionOfferSheet, type AuctionOfferMode } from '@/components/auction-offer-sheet';
import { GradeBadge } from '@/components/grade-badge';
import { RunningLoader } from '@/components/running-loader';
import { CHARACTER_BY_ID, COLLECTIONS } from '@/constants/characters';
import { useAuction, useAuctionBandSweep, useAuctionQuoteSettle } from '@/hooks/use-auction';
import { useColors } from '@/hooks/use-colors';
import {
  AuctionError,
  buyListing,
  cancelBid,
  cancelListing,
  cheapestAsk,
  fillBid,
  highestBid,
  lastWindowVolume,
  marketBand,
} from '@/lib/auction';
import { AUCTION_BID_COLOR, AUCTION_SELL_COLOR, bidsFor, listingsFor } from '@/lib/auction-ui';
import { availableCopies } from '@/lib/inventory';
import { useSession } from '@/providers/session-provider';

type BookTab = 'sell' | 'buy';
type BookItem =
  | { type: 'empty'; key: string; label: string }
  | { type: 'sell'; key: string; row: ReturnType<typeof listingsFor>[number] }
  | { type: 'buy'; key: string; row: ReturnType<typeof bidsFor>[number] };

export default function AuctionAnimalScreen() {
  useCatalog();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, profile } = useSession();
  const { id, offer } = useLocalSearchParams<{ id?: string; offer?: string }>();
  const character = id && CHARACTER_BY_ID[id] ? CHARACTER_BY_ID[id] : null;
  const { listings, bids, quotes, failed } = useAuction();
  useAuctionBandSweep(user?.uid, listings, bids, quotes);
  useAuctionQuoteSettle(quotes);
  const [tab, setTab] = useState<BookTab>(offer === 'buy' ? 'buy' : 'sell');
  const [sheetMode, setSheetMode] = useState<AuctionOfferMode | null>(offer === 'buy' ? 'buy' : offer === 'sell' ? 'sell' : null);
  const [editing, setEditing] = useState<{ id: string; price: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const quote = character ? quotes[character.id] : undefined;
  const band = character ? marketBand(character.id, quote) : null;
  const sells = useMemo(() => (character ? listingsFor(listings, character.id) : []), [character, listings]);
  const buys = useMemo(() => (character ? bidsFor(bids, character.id) : []), [bids, character]);
  const volume = lastWindowVolume(quote);
  const collection = character ? COLLECTIONS.find((c) => c.id === character.collection) : null;
  const owned = character ? (profile?.characters[character.id] ?? 0) : 0;
  const extra = character ? availableCopies(profile, character.id) : 0;
  const ready = listings !== null && bids !== null;
  const tint = tab === 'sell' ? AUCTION_SELL_COLOR : AUCTION_BID_COLOR;

  const items = useMemo<BookItem[]>(() => {
    if (!character) return [];
    if (tab === 'sell') {
      return sells.length
        ? sells.map((row) => ({ type: 'sell' as const, key: `sell-${row.id}`, row }))
        : [{ type: 'empty', key: 'sell-empty', label: '아직 올라온 판매가 없어요.' }];
    }
    return buys.length
      ? buys.map((row) => ({ type: 'buy' as const, key: `buy-${row.id}`, row }))
      : [{ type: 'empty', key: 'buy-empty', label: '아직 걸어 둔 구매희망이 없어요.' }];
  }, [buys, character, sells, tab]);

  function closeSheet() {
    setSheetMode(null);
    setEditing(null);
    if (offer) router.setParams({ offer: undefined });
  }

  function openCreate(mode: AuctionOfferMode) {
    setEditing(null);
    setTab(mode);
    setSheetMode(mode);
  }

  function openEdit(mode: AuctionOfferMode, listingId: string, price: number) {
    setEditing({ id: listingId, price });
    setTab(mode);
    setSheetMode(mode);
  }

  async function run(label: string, task: () => Promise<unknown>, ok: string) {
    if (!user || lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      await task();
      Alert.alert(label, ok);
    } catch (error) {
      Alert.alert(label, error instanceof AuctionError ? error.message : '연결 상태를 확인하고 다시 시도해주세요.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  function confirmBuy(row: (typeof sells)[number]) {
    if (!character || !user || !profile || busy) return;
    const best = cheapestAsk(listings ?? [], character.id, user.uid, quote);
    if (row.seller === user.uid) return;
    if (!best) {
      Alert.alert('지금은 살 수 없어요', '시세 안의 가장 싼 등록이 없어요. 시세 밖 등록은 주인이 취소하면 사라져요.');
      return;
    }
    if (profile.coins < best.price) {
      Alert.alert('코인이 부족해요', `${best.price}코인이 필요해요.`);
      return;
    }
    Alert.alert(`${character.name}을(를) 살까요?`, `같은 동물은 싼 것부터 사져요. ${best.price.toLocaleString()}코인에 구매해요.`, [
      { text: '취소', style: 'cancel' },
      {
        text: '구매',
        onPress: () =>
          run('구매 완료', () => buyListing(user.uid, best.id), `${character.name}을(를) ${best.price.toLocaleString()}코인에 샀어요.`),
      },
    ]);
  }

  function confirmFill(row: (typeof buys)[number]) {
    if (!character || !user || !profile || busy) return;
    const best = highestBid(bids ?? [], character.id, user.uid, quote);
    if (row.buyer === user.uid) return;
    if (availableCopies(profile, character.id) < 1) {
      Alert.alert('여분이 없어요', '대표 동물 1마리는 남겨두고 팔 수 있어요.');
      return;
    }
    if (!best) {
      Alert.alert('지금은 팔 수 없어요', '시세 안의 가장 비싼 구매희망이 없어요.');
      return;
    }
    Alert.alert(`${character.name}을(를) 팔까요?`, `같은 동물은 비싸게 걸어 둔 것부터 팔려요. ${best.price.toLocaleString()}코인을 받아요.`, [
      { text: '취소', style: 'cancel' },
      {
        text: '팔기',
        onPress: () =>
          run('판매 완료', () => fillBid(user.uid, best.id), `${character.name}을(를) ${best.price.toLocaleString()}코인에 팔았어요.`),
      },
    ]);
  }

  function confirmCancelSell(row: (typeof sells)[number]) {
    if (!character || !user || busy) return;
    Alert.alert('등록을 취소할까요?', `${character.name}이(가) 보관함으로 돌아와요.`, [
      { text: '닫기', style: 'cancel' },
      {
        text: '취소하기',
        style: 'destructive',
        onPress: () => run('등록 취소', () => cancelListing(user.uid, row.id), `${character.name}을(를) 다시 보관함에 넣었어요.`),
      },
    ]);
  }

  function confirmCancelBuy(row: (typeof buys)[number]) {
    if (!character || !user || busy) return;
    Alert.alert('구매희망을 취소할까요?', `걸어 둔 ${row.price.toLocaleString()}코인이 돌아와요.`, [
      { text: '닫기', style: 'cancel' },
      {
        text: '취소하기',
        style: 'destructive',
        onPress: () => run('구매희망 취소', () => cancelBid(user.uid, row.id), `${row.price.toLocaleString()}코인을 돌려받았어요.`),
      },
    ]);
  }

  if (!character || !band) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <Text style={[styles.empty, { color: colors.secondary }]}>없는 동물이에요.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: character.name }} />
      {failed ? (
        <Text style={[styles.empty, { color: colors.secondary }]}>목록을 불러오지 못했어요. 아래로 당겨 다시 시도해주세요.</Text>
      ) : !ready ? (
        <RunningLoader label="시세를 열고 있어요" />
      ) : (
        <>
          <View style={[styles.info, { backgroundColor: colors.surface }]}>
            <Image source={character.image} style={styles.hero} contentFit="contain" />
            <View style={styles.infoBody}>
              <View style={styles.titleRow}>
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                  {character.name}
                </Text>
                <GradeBadge grade={character.grade} />
              </View>
              <Text style={[styles.quote, { color: colors.text }]}>{band.quote.toLocaleString()}코인</Text>
              <Text style={[styles.meta, { color: colors.secondary }]}>
                {owned ? `보유 ${owned}마리` : '미보유'}
                {extra ? ` · 등록 ${extra}` : ''}
                {volume > 0 ? ` · 지난 ${volume.toLocaleString()}건` : ''}
              </Text>
              <Text style={[styles.meta, { color: colors.secondary }]}>
                {collection?.name ?? character.collection} · {band.min.toLocaleString()}~{band.max.toLocaleString()}
              </Text>
            </View>
          </View>
          <View style={[styles.tabs, { backgroundColor: colors.surface }]}>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === 'sell' }}
              onPress={() => setTab('sell')}
              style={[styles.tab, tab === 'sell' && { backgroundColor: `${AUCTION_SELL_COLOR}22` }]}>
              <Text style={[styles.tabLabel, { color: tab === 'sell' ? AUCTION_SELL_COLOR : colors.secondary }]}>
                팔아요 {sells.length}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === 'buy' }}
              onPress={() => setTab('buy')}
              style={[styles.tab, tab === 'buy' && { backgroundColor: `${AUCTION_BID_COLOR}22` }]}>
              <Text style={[styles.tabLabel, { color: tab === 'buy' ? AUCTION_BID_COLOR : colors.secondary }]}>
                살게요 {buys.length}
              </Text>
            </Pressable>
          </View>
          <FlatList
            data={items}
            keyExtractor={(item) => item.key}
            extraData={`${tab}:${busy}`}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              if (item.type === 'empty') {
                return (
                  <View style={styles.emptyBox}>
                    <Text style={[styles.emptyRow, { color: colors.secondary }]}>{item.label}</Text>
                    <Pressable accessibilityRole="button" onPress={() => openCreate(tab)}>
                      <Text style={[styles.emptyAction, { color: tint }]}>
                        {tab === 'sell' ? '먼저 올려 볼까요?' : '구매희망을 걸어 볼까요?'}
                      </Text>
                    </Pressable>
                  </View>
                );
              }
              if (item.type === 'sell') {
                return (
                  <AuctionBookRow
                    kind="sell"
                    who={item.row.seller === user?.uid ? '내가 올림' : item.row.sellerName}
                    price={item.row.price}
                    characterId={item.row.character}
                    quote={quote}
                    next={cheapestAsk(listings ?? [], character.id, user?.uid, quote)?.id === item.row.id}
                    mine={item.row.seller === user?.uid}
                    busy={busy}
                    onEdit={item.row.seller === user?.uid ? () => openEdit('sell', item.row.id, item.row.price) : undefined}
                    onPress={() => (item.row.seller === user?.uid ? confirmCancelSell(item.row) : confirmBuy(item.row))}
                  />
                );
              }
              return (
                <AuctionBookRow
                  kind="buy"
                  who={item.row.buyer === user?.uid ? '내가 건 구매희망' : item.row.buyerName}
                  price={item.row.price}
                  characterId={item.row.character}
                  quote={quote}
                  next={highestBid(bids ?? [], character.id, user?.uid, quote)?.id === item.row.id}
                  mine={item.row.buyer === user?.uid}
                  busy={busy}
                  onEdit={item.row.buyer === user?.uid ? () => openEdit('buy', item.row.id, item.row.price) : undefined}
                  onPress={() => (item.row.buyer === user?.uid ? confirmCancelBuy(item.row) : confirmFill(item.row))}
                />
              );
            }}
          />
          <View style={[styles.bar, { paddingBottom: Math.max(12, insets.bottom), backgroundColor: colors.background }]}>
            <Text style={[styles.barHint, { color: colors.secondary }]}>
              {tab === 'sell' ? '살 때는 싼 것부터 사져요' : '팔 때는 비싼 것부터 팔려요'}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => openCreate(tab)}
              style={[styles.offer, { backgroundColor: tint }]}>
              <Text style={styles.offerLabel}>{tab === 'sell' ? '이 동물 팔기' : '구매희망 걸기'}</Text>
            </Pressable>
          </View>
        </>
      )}
      {sheetMode && (
        <AuctionOfferSheet
          key={`${sheetMode}:${character.id}:${editing?.id ?? 'new'}`}
          mode={sheetMode}
          initial={character}
          gradeFilter={character.grade}
          quotes={quotes}
          busy={busy}
          editing={editing}
          onClose={closeSheet}
          onDone={closeSheet}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  info: { flexDirection: 'row', gap: 12, marginHorizontal: 20, marginTop: 12, borderRadius: 20, padding: 12, alignItems: 'center' },
  hero: { width: 72, height: 72 },
  infoBody: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flexShrink: 1, fontSize: 18, fontWeight: '900' },
  quote: { fontSize: 20, fontWeight: '900' },
  meta: { fontSize: 12, fontWeight: '600', lineHeight: 16 },
  tabs: { flexDirection: 'row', marginHorizontal: 20, marginTop: 10, borderRadius: 16, padding: 4, gap: 4 },
  tab: { flex: 1, minHeight: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tabLabel: { fontSize: 14, fontWeight: '800' },
  list: { padding: 20, gap: 10, paddingBottom: 12 },
  empty: { textAlign: 'center', padding: 28, lineHeight: 22 },
  emptyBox: { alignItems: 'center', paddingVertical: 28, gap: 8 },
  emptyRow: { fontSize: 14 },
  emptyAction: { fontSize: 14, fontWeight: '800' },
  bar: { paddingHorizontal: 20, paddingTop: 8, gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#00000014' },
  barHint: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  offer: { minHeight: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  offerLabel: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
