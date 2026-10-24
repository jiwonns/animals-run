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
import { useAuction, useMyListings } from '@/hooks/use-auction';
import { useColors } from '@/hooks/use-colors';
import {
  AuctionError,
  buyListing,
  cancelListing,
  listOnAuction,
  marketBand,
  type AuctionListing,
  type AuctionQuote,
} from '@/lib/auction';
import { availableCopies } from '@/lib/inventory';
import { useSession } from '@/providers/session-provider';
import { DRAW_GRADES } from '../../../../shared/gacha/draw-pools';

type Tab = 'browse' | 'mine';

const TABS: { id: Tab; label: string }[] = [
  { id: 'browse', label: '거래중' },
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
  const { listings, quotes, failed } = useAuction();
  const mine = useMyListings(user?.uid, listings);
  const { character: characterParam } = useLocalSearchParams<{ character?: string }>();
  const listingSeed = characterParam && CHARACTER_BY_ID[characterParam] ? CHARACTER_BY_ID[characterParam] : null;
  const [tab, setTab] = useState<Tab>('browse');
  const [grade, setGrade] = useState<Grade | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const listingOpen = manualOpen || !!listingSeed;
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);

  function closeSheet() {
    setManualOpen(false);
    if (characterParam) router.setParams({ character: undefined });
  }

  const rows = useMemo(() => {
    const source = tab === 'mine' ? mine : (listings ?? []);
    return source.filter((row) => {
      const character = CHARACTER_BY_ID[row.character];
      return character && (grade === null || character.grade === grade);
    });
  }, [grade, listings, mine, tab]);

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
    if (!character || !user || !profile || busy) return;
    if (row.seller === user.uid) return;
    if (profile.coins < row.price) {
      Alert.alert('코인이 부족해요', `${row.price}코인이 필요해요.`);
      return;
    }
    Alert.alert(`${character.name}을(를) 살까요?`, `${row.sellerName}의 등록 · ${row.price.toLocaleString()}코인`, [
      { text: '취소', style: 'cancel' },
      {
        text: '구매',
        onPress: () =>
          run('구매 완료', () => buyListing(user.uid, row.id), `${character.name}을(를) ${row.price.toLocaleString()}코인에 샀어요.`),
      },
    ]);
  }

  function confirmCancel(row: AuctionListing) {
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
                  {item.id === 'mine' && mine.length ? ` ${mine.length}` : ''}
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
          onPress={() => setManualOpen(true)}
          style={[styles.listButton, { backgroundColor: colors.primary }]}>
          <Text style={styles.listButtonLabel}>등록하기</Text>
        </Pressable>
      </View>
      <Text style={[styles.hint, { color: colors.secondary }]}>
        시세는 최근 거래에 따라 움직여요. 많이 팔리면 하한가 쪽으로, 많이 사면 상한가 쪽으로 붙습니다.
      </Text>

      {failed ? (
        <Text style={[styles.empty, { color: colors.secondary }]}>목록을 불러오지 못했어요. 아래로 당겨 다시 시도해주세요.</Text>
      ) : listings === null ? (
        <RunningLoader label="경매장을 열고 있어요" />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row) => row.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.secondary }]}>
              {tab === 'mine' ? '올린 등록이 없어요.' : '아직 올라온 동물이 없어요.'}
            </Text>
          }
          renderItem={({ item }) => (
            <ListingRow
              row={item}
              quote={quotes[item.character]}
              mine={item.seller === user?.uid}
              busy={busy}
              onBuy={() => confirmBuy(item)}
              onCancel={() => confirmCancel(item)}
            />
          )}
        />
      )}

      {listingOpen && (
        <ListSheet
          key={listingSeed?.id ?? 'pick'}
          initial={listingSeed}
          quotes={quotes}
          busy={busy}
          onClose={closeSheet}
          onListed={closeSheet}
        />
      )}
    </View>
  );
}

function ListingRow({
  row,
  quote,
  mine,
  busy,
  onBuy,
  onCancel,
}: {
  row: AuctionListing;
  quote?: AuctionQuote;
  mine: boolean;
  busy: boolean;
  onBuy: () => void;
  onCancel: () => void;
}) {
  const colors = useColors();
  const character = CHARACTER_BY_ID[row.character];
  if (!character) return null;
  const band = marketBand(character.id, quote);
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
          {mine ? '내가 올림' : row.sellerName} · 시세 {band.quote.toLocaleString()}
        </Text>
        <Text style={[styles.band, { color: colors.secondary }]}>
          하한 {band.min.toLocaleString()} · 상한 {band.max.toLocaleString()}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={mine ? onCancel : onBuy}
        style={[styles.action, { backgroundColor: mine ? colors.background : colors.primary }]}>
        <Text style={[styles.actionPrice, { color: mine ? colors.text : '#fff' }]}>{row.price.toLocaleString()}</Text>
        <Text style={[styles.actionLabel, { color: mine ? colors.secondary : 'rgba(255,255,255,0.85)' }]}>
          {mine ? '취소' : '구매'}
        </Text>
      </Pressable>
    </View>
  );
}

function ListSheet({
  initial,
  quotes,
  busy,
  onClose,
  onListed,
}: {
  initial: Character | null;
  quotes: Partial<Record<CharacterId, AuctionQuote>>;
  busy: boolean;
  onClose: () => void;
  onListed: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, profile } = useSession();
  const sellable = CHARACTERS.filter((c) => availableCopies(profile, c.id) > 0);
  const start = initial && availableCopies(profile, initial.id) > 0 ? initial : sellable[0] ?? null;
  const [picked, setPicked] = useState<Character | null>(start);
  const [price, setPrice] = useState(() => (start ? marketBand(start.id, quotes[start.id]).quote : 0));
  const lock = useRef(false);

  const band = picked ? marketBand(picked.id, quotes[picked.id]) : null;
  const quantity = picked ? availableCopies(profile, picked.id) : 0;

  function nudge(delta: number) {
    if (!band) return;
    setPrice((value) => Math.min(band.max, Math.max(band.min, value + delta)));
  }

  async function submit() {
    if (!user || !picked || !band || lock.current || busy) return;
    if (price < band.min || price > band.max) return;
    lock.current = true;
    try {
      await listOnAuction(user.uid, picked.id, price);
      onListed();
      Alert.alert('등록 완료', `${picked.name}을(를) ${price.toLocaleString()}코인에 올렸어요.`);
    } catch (error) {
      Alert.alert(
        '등록하지 못했어요',
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
              <Text style={[styles.sheetTitle, { color: colors.text }]}>경매 등록</Text>
              <Pressable onPress={onClose} style={{ padding: 10 }}>
                <Text style={{ color: colors.secondary }}>닫기</Text>
              </Pressable>
            </View>
            {sellable.length === 0 ? (
              <Text style={[styles.empty, { color: colors.secondary }]}>
                올릴 수 있는 여분 동물이 없어요. 대표 동물 1마리는 남겨둬요.
              </Text>
            ) : (
              <>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.picks}>
                  {sellable.map((character) => {
                    const selected = picked?.id === character.id;
                    return (
                      <Pressable
                        key={character.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        onPress={() => {
                          setPicked(character);
                          setPrice(marketBand(character.id, quotes[character.id]).quote);
                        }}
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
                    </Text>
                    <Text style={[styles.meta, { color: colors.secondary }]}>
                      하한 {band.min.toLocaleString()} · 상한 {band.max.toLocaleString()} · 가능 {quantity}마리
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
            disabled={!picked || !band || busy || !quantity}
            onPress={submit}
            style={[
              styles.submit,
              { backgroundColor: picked && band && quantity && !busy ? colors.primary : colors.surface },
            ]}>
            <Text style={{ color: picked && band && quantity && !busy ? '#fff' : colors.secondary, fontWeight: '800', fontSize: 16 }}>
              {!picked || !quantity ? '등록할 동물이 없어요' : `${price.toLocaleString()}코인에 올리기`}
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
  tab: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  tabLabel: { fontSize: 14, fontWeight: '800' },
  filters: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingTop: 12 },
  listButton: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 },
  listButtonLabel: { color: '#fff', fontWeight: '800' },
  hint: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 4, fontSize: 12, lineHeight: 17 },
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
