import { useCatalog } from '@/providers/catalog-provider';
import { FlatList } from '@/components/refreshable';
import { Image } from '@/components/gacha-image';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

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

type BookItem =
  | { type: 'section'; key: string; label: string; tint: string }
  | { type: 'empty'; key: string; label: string }
  | { type: 'sell'; key: string; row: ReturnType<typeof listingsFor>[number] }
  | { type: 'buy'; key: string; row: ReturnType<typeof bidsFor>[number] };

export default function AuctionAnimalScreen() {
  useCatalog();
  const colors = useColors();
  const { user, profile } = useSession();
  const { id, offer } = useLocalSearchParams<{ id?: string; offer?: string }>();
  const character = id && CHARACTER_BY_ID[id] ? CHARACTER_BY_ID[id] : null;
  const { listings, bids, quotes, failed } = useAuction();
  useAuctionBandSweep(user?.uid, listings, bids, quotes);
  useAuctionQuoteSettle(quotes);
  const [sheetMode, setSheetMode] = useState<AuctionOfferMode | null>(offer === 'buy' ? 'buy' : offer === 'sell' ? 'sell' : null);
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

  const items = useMemo<BookItem[]>(() => {
    if (!character) return [];
    return [
      { type: 'section', key: 'sell-h', label: `팔아요 ${sells.length}`, tint: AUCTION_SELL_COLOR },
      ...(sells.length
        ? sells.map((row) => ({ type: 'sell' as const, key: `sell-${row.id}`, row }))
        : [{ type: 'empty' as const, key: 'sell-empty', label: '아직 올라온 판매가 없어요.' }]),
      { type: 'section', key: 'buy-h', label: `살게요 ${buys.length}`, tint: AUCTION_BID_COLOR },
      ...(buys.length
        ? buys.map((row) => ({ type: 'buy' as const, key: `buy-${row.id}`, row }))
        : [{ type: 'empty' as const, key: 'buy-empty', label: '아직 걸어 둔 구매희망이 없어요.' }]),
    ];
  }, [buys, character, sells]);

  function closeSheet() {
    setSheetMode(null);
    if (offer) router.setParams({ offer: undefined });
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
        <FlatList
          data={items}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.header}>
              <View style={[styles.info, { backgroundColor: colors.surface }]}>
                <Image source={character.image} style={styles.hero} contentFit="contain" />
                <View style={styles.infoBody}>
                  <View style={styles.titleRow}>
                    <Text style={[styles.name, { color: colors.text }]}>{character.name}</Text>
                    <GradeBadge grade={character.grade} />
                  </View>
                  <Text style={[styles.meta, { color: colors.secondary }]}>
                    {collection?.name ?? character.collection}
                    {owned ? ` · 보유 ${owned}마리` : ' · 미보유'}
                    {extra ? ` · 등록 가능 ${extra}마리` : ''}
                  </Text>
                  <Text style={[styles.quote, { color: colors.text }]}>시세 {band.quote.toLocaleString()}코인</Text>
                  <Text style={[styles.meta, { color: colors.secondary }]}>
                    하한 {band.min.toLocaleString()} · 상한 {band.max.toLocaleString()}
                    {volume > 0 ? ` · 지난 ${volume.toLocaleString()}건` : ''}
                  </Text>
                </View>
              </View>
              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setSheetMode('sell')}
                  style={[styles.offer, { backgroundColor: `${AUCTION_SELL_COLOR}18`, borderColor: AUCTION_SELL_COLOR }]}>
                  <Text style={[styles.offerLabel, { color: AUCTION_SELL_COLOR }]}>팔기</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setSheetMode('buy')}
                  style={[styles.offer, { backgroundColor: `${AUCTION_BID_COLOR}18`, borderColor: AUCTION_BID_COLOR }]}>
                  <Text style={[styles.offerLabel, { color: AUCTION_BID_COLOR }]}>구매희망</Text>
                </Pressable>
              </View>
              <Text style={[styles.legend, { color: colors.secondary }]}>
                파란 칸은 사람들이 올린 판매, 노란 칸은 구매희망이에요. 살 때는 싼 것부터, 팔 때는 비싼 것부터 체결돼요.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            if (item.type === 'section') {
              return <Text style={[styles.section, { color: item.tint }]}>{item.label}</Text>;
            }
            if (item.type === 'empty') {
              return <Text style={[styles.emptyRow, { color: colors.secondary }]}>{item.label}</Text>;
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
                onPress={() => (item.row.buyer === user?.uid ? confirmCancelBuy(item.row) : confirmFill(item.row))}
              />
            );
          }}
        />
      )}
      {sheetMode && (
        <AuctionOfferSheet
          key={`${sheetMode}:${character.id}`}
          mode={sheetMode}
          initial={character}
          gradeFilter={character.grade}
          quotes={quotes}
          busy={busy}
          onClose={closeSheet}
          onDone={closeSheet}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: { padding: 20, gap: 10, paddingBottom: 32 },
  header: { gap: 12, paddingBottom: 4 },
  info: { flexDirection: 'row', gap: 14, borderRadius: 22, padding: 14, alignItems: 'center' },
  hero: { width: 88, height: 88 },
  infoBody: { flex: 1, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flexShrink: 1, fontSize: 22, fontWeight: '900' },
  quote: { fontSize: 18, fontWeight: '900' },
  meta: { fontSize: 12, fontWeight: '600', lineHeight: 17 },
  actions: { flexDirection: 'row', gap: 8 },
  offer: { flex: 1, minHeight: 46, borderRadius: 16, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  offerLabel: { fontSize: 15, fontWeight: '800' },
  legend: { fontSize: 12, lineHeight: 17 },
  section: { fontSize: 14, fontWeight: '800', paddingTop: 6 },
  empty: { textAlign: 'center', padding: 28, lineHeight: 22 },
  emptyRow: { textAlign: 'center', paddingVertical: 16, fontSize: 13 },
});
