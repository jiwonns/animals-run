import { ScrollView } from '@/components/refreshable';
import { Image } from '@/components/gacha-image';
import { useRef, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Select } from '@/components/select';
import { CHARACTERS, GRADES, type Character, type CharacterId, type Grade } from '@/constants/characters';
import { useColors } from '@/hooks/use-colors';
import { AuctionError, lastWindowVolume, listOnAuction, marketBand, placeBid, type AuctionQuote } from '@/lib/auction';
import { availableCopies } from '@/lib/inventory';
import { useSession } from '@/providers/session-provider';
import { DRAW_GRADES } from '../../shared/gacha/draw-pools';

export type AuctionOfferMode = 'sell' | 'buy';

export function AuctionOfferSheet({
  mode,
  initial,
  gradeFilter,
  quotes,
  busy,
  onClose,
  onDone,
}: {
  mode: AuctionOfferMode;
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
    : initial
      ? [initial]
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
            {!selling && !initial && (
              <Select
                label="등급"
                value={pickGrade}
                options={DRAW_GRADES.map((g) => ({ value: g, label: GRADES[g].label, color: GRADES[g].color }))}
                onChange={(g) => {
                  setPickGrade(g);
                  const next = CHARACTERS.find((c) => c.grade === g);
                  if (next) choose(next);
                }}
              />
            )}
            {pool.length === 0 ? (
              <Text style={[styles.empty, { color: colors.secondary }]}>
                {selling ? '올릴 수 있는 여분 동물이 없어요. 대표 동물 1마리는 남겨둬요.' : '이 등급의 동물이 없어요.'}
              </Text>
            ) : (
              <>
                {!initial && (
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
                )}
                {picked && band && (
                  <>
                    <Text style={[styles.band, { color: colors.text }]}>
                      {picked.name} · 시세 {band.quote.toLocaleString()}코인
                      {lastWindowVolume(quotes[picked.id]) > 0
                        ? ` · 지난 ${lastWindowVolume(quotes[picked.id]).toLocaleString()}건`
                        : ''}
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
  sheetRoot: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#0006' },
  sheet: { borderTopLeftRadius: 30, borderTopRightRadius: 30, maxHeight: '85%' },
  sheetBody: { padding: 24, gap: 14 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetTitle: { fontSize: 22, fontWeight: '900' },
  empty: { textAlign: 'center', padding: 28, lineHeight: 22 },
  picks: { gap: 8 },
  pick: { width: 76, alignItems: 'center', gap: 4, borderRadius: 16, padding: 8, borderWidth: 2 },
  pickName: { fontSize: 11, fontWeight: '700' },
  band: { fontSize: 13, fontWeight: '700' },
  meta: { fontSize: 12, fontWeight: '600' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  step: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  stepLabel: { fontSize: 25 },
  price: { flex: 1, textAlign: 'center', fontSize: 22, fontWeight: '900' },
  chip: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 10 },
  chipLabel: { fontWeight: '800' },
  submit: { marginHorizontal: 24, minHeight: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
