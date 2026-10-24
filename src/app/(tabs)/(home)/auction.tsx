import { useCatalog } from '@/providers/catalog-provider';
import { FlatList, ScrollView } from '@/components/refreshable';
import { Image } from '@/components/gacha-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CoinBadge } from '@/components/coin-badge';
import { GradeBadge } from '@/components/grade-badge';
import { RunningLoader } from '@/components/running-loader';
import { Select, type SelectOption } from '@/components/select';
import { CHARACTER_BY_ID, CHARACTERS, GRADES, type Character, type CharacterId, type Grade } from '@/constants/characters';
import { useAuction, useAuctionBandSweep, useAuctionQuoteSettle, useMyBids, useMyListings } from '@/hooks/use-auction';
import { useColors } from '@/hooks/use-colors';
import {
  AuctionError,
  buyListing,
  cancelBid,
  cancelListing,
  cheapestAsk,
  fillBid,
  highestBid,
  isInBand,
  lastWindowBoard,
  lastWindowVolume,
  listOnAuction,
  marketBand,
  nextAuctionSlot,
  placeBid,
  type AuctionBid,
  type AuctionListing,
  type AuctionQuote,
} from '@/lib/auction';
import { availableCopies } from '@/lib/inventory';
import { useSession } from '@/providers/session-provider';
import { DRAW_GRADES } from '../../../../shared/gacha/draw-pools';

type Tab = 'sell' | 'buy' | 'mine';
type SheetMode = 'sell' | 'buy';

const TABS: { id: Tab; label: string }[] = [
  { id: 'sell', label: '팔아요' },
  { id: 'buy', label: '살게요' },
  { id: 'mine', label: '내 등록' },
];

const GRADE_FILTERS: SelectOption<Grade | null>[] = [
  { value: null, label: '전체' },
  ...DRAW_GRADES.map((g) => ({ value: g, label: GRADES[g].label, color: GRADES[g].color })),
];

export default function AuctionScreen() {
  useCatalog();
  const colors = useColors();
  const { user, profile } = useSession();
  const { listings, bids, quotes, failed } = useAuction();
  const mineSell = useMyListings(user?.uid, listings);
  const mineBuy = useMyBids(user?.uid, bids);
  useAuctionBandSweep(user?.uid, listings, bids, quotes);
  useAuctionQuoteSettle(quotes);
  const { character: characterParam } = useLocalSearchParams<{ character?: string }>();
  const listingSeed = characterParam && CHARACTER_BY_ID[characterParam] ? CHARACTER_BY_ID[characterParam] : null;
  const [tab, setTab] = useState<Tab>('sell');
  const [grade, setGrade] = useState<Grade | null>(null);
  const [sheetMode, setSheetMode] = useState<SheetMode | null>(listingSeed ? 'sell' : null);
  const listingOpen = sheetMode !== null || !!listingSeed;
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);

  function closeSheet() {
    setSheetMode(null);
    if (characterParam) router.setParams({ character: undefined });
  }

  const rows = useMemo(() => {
    const match = (id: CharacterId) => {
      const character = CHARACTER_BY_ID[id];
      return character && (grade === null || character.grade === grade);
    };
    if (tab === 'mine') {
      return [
        ...mineSell.filter((row) => match(row.character)).map((row) => ({ kind: 'sell' as const, row })),
        ...mineBuy.filter((row) => match(row.character)).map((row) => ({ kind: 'buy' as const, row })),
      ];
    }
    if (tab === 'buy') {
      return (bids ?? []).filter((row) => match(row.character)).map((row) => ({ kind: 'buy' as const, row }));
    }
    return (listings ?? []).filter((row) => match(row.character)).map((row) => ({ kind: 'sell' as const, row }));
  }, [bids, grade, listings, mineBuy, mineSell, tab]);

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

  function confirmBuy(row: AuctionListing) {
    const character = CHARACTER_BY_ID[row.character];
    const best = cheapestAsk(listings ?? [], row.character, user?.uid, quotes[row.character]);
    if (!character || !user || !profile || busy) return;
    if (row.seller === user.uid) return;
    if (!best) {
      Alert.alert('지금은 살 수 없어요', '시세 안의 가장 싼 등록이 없어요. 시세 밖 등록은 주인이 취소하면 사라져요.');
      return;
    }
    if (profile.coins < best.price) {
      Alert.alert('코인이 부족해요', `${best.price}코인이 필요해요.`);
      return;
    }
    Alert.alert(
      `${character.name}을(를) 살까요?`,
      `같은 동물은 싼 것부터 사져요. ${best.price.toLocaleString()}코인에 구매해요.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '구매',
          onPress: () =>
            run(
              '구매 완료',
              () => buyListing(user.uid, best.id),
              `${character.name}을(를) ${best.price.toLocaleString()}코인에 샀어요.`,
            ),
        },
      ],
    );
  }

  function confirmFill(row: AuctionBid) {
    const character = CHARACTER_BY_ID[row.character];
    const best = highestBid(bids ?? [], row.character, user?.uid, quotes[row.character]);
    if (!character || !user || !profile || busy) return;
    if (row.buyer === user.uid) return;
    if (availableCopies(profile, row.character) < 1) {
      Alert.alert('여분이 없어요', '대표 동물 1마리는 남겨두고 팔 수 있어요.');
      return;
    }
    if (!best) {
      Alert.alert('지금은 팔 수 없어요', '시세 안의 가장 비싼 구매희망이 없어요.');
      return;
    }
    Alert.alert(
      `${character.name}을(를) 팔까요?`,
      `같은 동물은 비싸게 걸어 둔 것부터 팔려요. ${best.price.toLocaleString()}코인을 받아요.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '팔기',
          onPress: () =>
            run(
              '판매 완료',
              () => fillBid(user.uid, best.id),
              `${character.name}을(를) ${best.price.toLocaleString()}코인에 팔았어요.`,
            ),
        },
      ],
    );
  }

  function confirmCancelSell(row: AuctionListing) {
    const character = CHARACTER_BY_ID[row.character];
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

  function confirmCancelBuy(row: AuctionBid) {
    const character = CHARACTER_BY_ID[row.character];
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

  const mineCount = mineSell.length + mineBuy.length;
  const ready = listings !== null && bids !== null;
  const lastWindow = useMemo(() => lastWindowBoard(quotes), [quotes]);
  const nextHour = new Date(nextAuctionSlot() + 9 * 60 * 60 * 1000).getUTCHours();

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.toolbar}>
        <View style={styles.tabs}>
          {TABS.map((item) => {
            const selected = tab === item.id;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => setTab(item.id)}
                style={[styles.tab, { backgroundColor: selected ? colors.primary : colors.surface }]}>
                <Text style={[styles.tabLabel, { color: selected ? '#fff' : colors.text }]}>
                  {item.label}
                  {item.id === 'mine' && mineCount ? ` ${mineCount}` : ''}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <CoinBadge coins={profile?.coins ?? 0} />
      </View>

      <View style={styles.filters}>
        <Select label="등급" value={grade} options={GRADE_FILTERS} onChange={setGrade} />
        <Pressable
          accessibilityRole="button"
          onPress={() => setSheetMode('sell')}
          style={[styles.listButton, { backgroundColor: colors.surface }]}>
          <Text style={[styles.listButtonLabel, { color: colors.text }]}>팔기</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => setSheetMode('buy')}
          style={[styles.listButton, { backgroundColor: colors.primary }]}>
          <Text style={styles.listButtonLabel}>구매희망</Text>
        </Pressable>
      </View>
      <Text style={[styles.hint, { color: colors.secondary }]}>
        {`살 때는 싼 등록부터, 팔 때는 비싼 구매희망부터 체결돼요. 시세는 한국 시간 2시간마다 그 사이 평균으로 바뀌고, 지난 거래 수는 갱신된 뒤에 보여요. 다음 갱신은 ${nextHour}시예요.`}
      </Text>
      {lastWindow.length > 0 ? (
        <View>
          <Text style={[styles.volumeTitle, { color: colors.text }]}>지난 2시간</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.volumeRow}>
            {lastWindow.map((row) => {
              const character = CHARACTER_BY_ID[row.id];
              if (!character) return null;
              return (
                <View key={row.id} style={[styles.volumeCard, { backgroundColor: colors.surface }]}>
                  <Image source={character.thumb} style={styles.volumeThumb} contentFit="contain" />
                  <Text style={[styles.volumeName, { color: colors.text }]} numberOfLines={1}>
                    {character.name}
                  </Text>
                  <Text style={[styles.volumeMeta, { color: colors.secondary }]}>
                    {row.quote.toLocaleString()} · {row.count.toLocaleString()}건
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {failed ? (
        <Text style={[styles.empty, { color: colors.secondary }]}>목록을 불러오지 못했어요. 아래로 당겨 다시 시도해주세요.</Text>
      ) : !ready ? (
        <RunningLoader label="경매장을 열고 있어요" />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => `${item.kind}-${item.row.id}`}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.secondary }]}>
              {tab === 'mine' ? '올린 등록이 없어요.' : tab === 'buy' ? '아직 걸어 둔 구매희망이 없어요.' : '아직 올라온 동물이 없어요.'}
            </Text>
          }
          renderItem={({ item }) =>
            item.kind === 'sell' ? (
              <ListingRow
                row={item.row}
                quote={quotes[item.row.character]}
                next={cheapestAsk(listings ?? [], item.row.character, user?.uid, quotes[item.row.character])?.id === item.row.id}
                mine={item.row.seller === user?.uid}
                busy={busy}
                onBuy={() => confirmBuy(item.row)}
                onCancel={() => confirmCancelSell(item.row)}
              />
            ) : (
              <BidRow
                row={item.row}
                quote={quotes[item.row.character]}
                next={highestBid(bids ?? [], item.row.character, user?.uid, quotes[item.row.character])?.id === item.row.id}
                mine={item.row.buyer === user?.uid}
                busy={busy}
                onFill={() => confirmFill(item.row)}
                onCancel={() => confirmCancelBuy(item.row)}
              />
            )
          }
        />
      )}

      {listingOpen && (
        <OfferSheet
          key={`${listingSeed ? 'sell' : sheetMode}:${listingSeed?.id ?? 'pick'}`}
          mode={listingSeed ? 'sell' : (sheetMode ?? 'sell')}
          initial={listingSeed}
          gradeFilter={grade}
          quotes={quotes}
          busy={busy}
          onClose={closeSheet}
          onDone={closeSheet}
        />
      )}
    </View>
  );
}

function ListingRow({
  row,
  quote,
  next,
  mine,
  busy,
  onBuy,
  onCancel,
}: {
  row: AuctionListing;
  quote?: AuctionQuote;
  next: boolean;
  mine: boolean;
  busy: boolean;
  onBuy: () => void;
  onCancel: () => void;
}) {
  return (
    <BookCard
      characterId={row.character}
      quote={quote}
      who={mine ? '내가 올림' : row.sellerName}
      price={row.price}
      tag={isInBand(row.character, row.price, quote) ? (next ? '지금 이 가격' : undefined) : '시세 밖'}
      action={mine ? '취소' : '구매'}
      mine={mine}
      busy={busy}
      onPress={mine ? onCancel : onBuy}
    />
  );
}

function BidRow({
  row,
  quote,
  next,
  mine,
  busy,
  onFill,
  onCancel,
}: {
  row: AuctionBid;
  quote?: AuctionQuote;
  next: boolean;
  mine: boolean;
  busy: boolean;
  onFill: () => void;
  onCancel: () => void;
}) {
  return (
    <BookCard
      characterId={row.character}
      quote={quote}
      who={mine ? '내가 건 구매희망' : `${row.buyerName} · 구매희망`}
      price={row.price}
      tag={isInBand(row.character, row.price, quote) ? (next ? '지금 이 가격' : undefined) : '시세 밖'}
      action={mine ? '취소' : '팔기'}
      mine={mine}
      busy={busy}
      onPress={mine ? onCancel : onFill}
    />
  );
}

function BookCard({
  characterId,
  quote,
  who,
  price,
  tag,
  action,
  mine,
  busy,
  onPress,
}: {
  characterId: CharacterId;
  quote?: AuctionQuote;
  who: string;
  price: number;
  tag?: string;
  action: string;
  mine: boolean;
  busy: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  const character = CHARACTER_BY_ID[characterId];
  if (!character) return null;
  const band = marketBand(character.id, quote);
  const volume = lastWindowVolume(quote);
  return (
    <View style={[styles.row, { backgroundColor: colors.surface }]}>
      <Image source={character.thumb} style={styles.thumb} contentFit="contain" />
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {character.name}
          </Text>
          <GradeBadge grade={character.grade} />
        </View>
        <Text style={[styles.meta, { color: colors.secondary }]} numberOfLines={1}>
          {who} · 시세 {band.quote.toLocaleString()}
          {volume > 0 ? ` · 지난 ${volume.toLocaleString()}건` : ''}
          {tag ? ` · ${tag}` : ''}
        </Text>
        <Text style={[styles.band, { color: colors.secondary }]}>
          하한 {band.min.toLocaleString()} · 상한 {band.max.toLocaleString()}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={onPress}
        style={[styles.action, { backgroundColor: mine ? colors.background : colors.primary }]}>
        <Text style={[styles.actionPrice, { color: mine ? colors.text : '#fff' }]}>{price.toLocaleString()}</Text>
        <Text style={[styles.actionLabel, { color: mine ? colors.secondary : 'rgba(255,255,255,0.85)' }]}>{action}</Text>
      </Pressable>
    </View>
  );
}

function OfferSheet({
  mode,
  initial,
  gradeFilter,
  quotes,
  busy,
  onClose,
  onDone,
}: {
  mode: SheetMode;
  initial: Character | null;
  gradeFilter: Grade | null;
  quotes: Partial<Record<CharacterId, AuctionQuote>>;
  busy: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, profile } = useSession();
  const selling = mode === 'sell';
  const [pickGrade, setPickGrade] = useState<Grade>(initial?.grade ?? gradeFilter ?? DRAW_GRADES[0]);
  const pool = selling
    ? CHARACTERS.filter((c) => availableCopies(profile, c.id) > 0)
    : CHARACTERS.filter((c) => c.grade === pickGrade);
  const start = initial && (!selling || availableCopies(profile, initial.id) > 0) ? initial : pool[0] ?? null;
  const [picked, setPicked] = useState<Character | null>(start);
  const [price, setPrice] = useState(() => (start ? marketBand(start.id, quotes[start.id]).quote : 0));
  const lock = useRef(false);
  const band = picked ? marketBand(picked.id, quotes[picked.id]) : null;
  const quantity = picked ? availableCopies(profile, picked.id) : 0;
  const canSubmit = selling ? !!picked && !!quantity : !!picked && (profile?.coins ?? 0) >= price;

  function choose(character: Character) {
    setPicked(character);
    setPrice(marketBand(character.id, quotes[character.id]).quote);
  }

  function nudge(delta: number) {
    if (!band) return;
    setPrice((value) => Math.min(band.max, Math.max(band.min, value + delta)));
  }

  async function submit() {
    if (!user || !picked || !band || lock.current || busy) return;
    if (price < band.min || price > band.max) return;
    lock.current = true;
    try {
      if (selling) await listOnAuction(user.uid, picked.id, price);
      else await placeBid(user.uid, picked.id, price);
      onDone();
      Alert.alert(
        selling ? '등록 완료' : '구매희망 등록',
        selling
          ? `${picked.name}을(를) ${price.toLocaleString()}코인에 올렸어요.`
          : `${picked.name}을(를) ${price.toLocaleString()}코인에 사겠다고 걸어 두었어요.`,
      );
    } catch (error) {
      Alert.alert(
        selling ? '등록하지 못했어요' : '걸어 두지 못했어요',
        error instanceof AuctionError ? error.message : '연결 상태를 확인하고 다시 시도해주세요.',
      );
    } finally {
      lock.current = false;
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetRoot}>
        <Pressable accessibilityRole="button" accessibilityLabel="등록 창 닫기" onPress={onClose} style={{ flex: 1 }} />
        <View style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: Math.max(20, insets.bottom) }]}>
          <ScrollView contentContainerStyle={styles.sheetBody}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>{selling ? '팔기 등록' : '구매희망'}</Text>
              <Pressable onPress={onClose} style={{ padding: 10 }}>
                <Text style={{ color: colors.secondary }}>닫기</Text>
              </Pressable>
            </View>
            {!selling && (
              <Select label="등급" value={pickGrade} options={DRAW_GRADES.map((g) => ({ value: g, label: GRADES[g].label, color: GRADES[g].color }))} onChange={(g) => {
                setPickGrade(g);
                const next = CHARACTERS.find((c) => c.grade === g);
                if (next) choose(next);
              }} />
            )}
            {pool.length === 0 ? (
              <Text style={[styles.empty, { color: colors.secondary }]}>
                {selling ? '올릴 수 있는 여분 동물이 없어요. 대표 동물 1마리는 남겨둬요.' : '이 등급의 동물이 없어요.'}
              </Text>
            ) : (
              <>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.picks}>
                  {pool.map((character) => {
                    const selected = picked?.id === character.id;
                    return (
                      <Pressable
                        key={character.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        onPress={() => choose(character)}
                        style={[
                          styles.pick,
                          { backgroundColor: colors.surface, borderColor: selected ? colors.primary : 'transparent' },
                        ]}>
                        <Image source={character.thumb} style={{ width: 52, height: 52 }} contentFit="contain" />
                        <Text style={[styles.pickName, { color: colors.text }]} numberOfLines={1}>
                          {character.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
                {picked && band && (
                  <>
                    <Text style={[styles.band, { color: colors.text }]}>
                      {picked.name} · 시세 {band.quote.toLocaleString()}코인
                      {lastWindowVolume(quotes[picked.id]) > 0 ? ` · 지난 ${lastWindowVolume(quotes[picked.id]).toLocaleString()}건` : ''}
                    </Text>
                    <Text style={[styles.meta, { color: colors.secondary }]}>
                      하한 {band.min.toLocaleString()} · 상한 {band.max.toLocaleString()}
                      {selling ? ` · 가능 ${quantity}마리` : ` · 보유 ${(profile?.coins ?? 0).toLocaleString()}코인`}
                    </Text>
                    <View style={styles.priceRow}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="가격 내리기"
                        disabled={price <= band.min}
                        onPress={() => nudge(-1)}
                        style={[styles.step, { backgroundColor: colors.surface, opacity: price <= band.min ? 0.4 : 1 }]}>
                        <Text style={[styles.stepLabel, { color: colors.text }]}>−</Text>
                      </Pressable>
                      <Text style={[styles.price, { color: colors.text }]}>{price.toLocaleString()}코인</Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="가격 올리기"
                        disabled={price >= band.max}
                        onPress={() => nudge(1)}
                        style={[styles.step, { backgroundColor: colors.surface, opacity: price >= band.max ? 0.4 : 1 }]}>
                        <Text style={[styles.stepLabel, { color: colors.text }]}>+</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => setPrice(band.min)}
                        style={[styles.chip, { backgroundColor: colors.surface }]}>
                        <Text style={[styles.chipLabel, { color: colors.secondary }]}>하한</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => setPrice(band.max)}
                        style={[styles.chip, { backgroundColor: colors.surface }]}>
                        <Text style={[styles.chipLabel, { color: colors.primary }]}>상한</Text>
                      </Pressable>
                    </View>
                  </>
                )}
              </>
            )}
          </ScrollView>
          <Pressable
            accessibilityRole="button"
            disabled={!canSubmit || busy || !band}
            onPress={submit}
            style={[styles.submit, { backgroundColor: canSubmit && !busy ? colors.primary : colors.surface }]}>
            <Text style={{ color: canSubmit && !busy ? '#fff' : colors.secondary, fontWeight: '800', fontSize: 16 }}>
              {!picked
                ? selling
                  ? '등록할 동물이 없어요'
                  : '동물을 골라주세요'
                : selling
                  ? `${price.toLocaleString()}코인에 올리기`
                  : `${price.toLocaleString()}코인 걸어 두기`}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 12 },
  tabs: { flex: 1, flexDirection: 'row', gap: 8 },
  tab: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  tabLabel: { fontSize: 13, fontWeight: '800' },
  filters: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingTop: 12 },
  listButton: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  listButtonLabel: { color: '#fff', fontWeight: '800' },
  hint: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 4, fontSize: 12, lineHeight: 17 },
  volumeTitle: { paddingHorizontal: 20, paddingTop: 8, fontSize: 13, fontWeight: '800' },
  volumeRow: { paddingHorizontal: 20, paddingTop: 8, gap: 8 },
  volumeCard: { width: 92, alignItems: 'center', gap: 2, borderRadius: 16, padding: 8 },
  volumeThumb: { width: 44, height: 44 },
  volumeName: { fontSize: 11, fontWeight: '800' },
  volumeMeta: { fontSize: 11, fontWeight: '700' },
  list: { padding: 20, gap: 10, paddingBottom: 32 },
  empty: { textAlign: 'center', padding: 28, lineHeight: 22 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, padding: 12 },
  thumb: { width: 56, height: 56 },
  rowBody: { flex: 1, gap: 2 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flexShrink: 1, fontSize: 16, fontWeight: '800' },
  meta: { fontSize: 12, fontWeight: '600' },
  band: { fontSize: 13, fontWeight: '700' },
  action: { minWidth: 76, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 10, alignItems: 'center' },
  actionPrice: { fontSize: 16, fontWeight: '900' },
  actionLabel: { fontSize: 11, fontWeight: '700' },
  sheetRoot: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#0006' },
  sheet: { borderTopLeftRadius: 30, borderTopRightRadius: 30, maxHeight: '85%' },
  sheetBody: { padding: 24, gap: 14 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetTitle: { fontSize: 22, fontWeight: '900' },
  picks: { gap: 8 },
  pick: { width: 76, alignItems: 'center', gap: 4, borderRadius: 16, padding: 8, borderWidth: 2 },
  pickName: { fontSize: 11, fontWeight: '700' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  step: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  stepLabel: { fontSize: 25 },
  price: { flex: 1, textAlign: 'center', fontSize: 22, fontWeight: '900' },
  chip: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 10 },
  chipLabel: { fontWeight: '800' },
  submit: { marginHorizontal: 24, minHeight: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
