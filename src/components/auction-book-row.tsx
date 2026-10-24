import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useColors } from '@/hooks/use-colors';
import { isInBand, type AuctionBid, type AuctionListing, type AuctionQuote } from '@/lib/auction';
import { AUCTION_BID_COLOR, AUCTION_SELL_COLOR } from '@/lib/auction-ui';

export function AuctionBookRow({
  kind,
  who,
  price,
  characterId,
  quote,
  next,
  mine,
  busy,
  onPress,
  onEdit,
}: {
  kind: 'sell' | 'buy';
  who: string;
  price: number;
  characterId: AuctionListing['character'] | AuctionBid['character'];
  quote?: AuctionQuote;
  next: boolean;
  mine: boolean;
  busy: boolean;
  onPress: () => void;
  onEdit?: () => void;
}) {
  const colors = useColors();
  const tint = kind === 'sell' ? AUCTION_SELL_COLOR : AUCTION_BID_COLOR;
  const inBand = isInBand(characterId, price, quote);
  const tag = inBand ? (next ? '지금 이 가격' : undefined) : '시세 밖';
  return (
    <View
      style={[
        styles.row,
        { backgroundColor: colors.surface, borderColor: next && inBand ? tint : colors.border },
        next && inBand && { backgroundColor: `${tint}12` },
      ]}>
      <View style={styles.body}>
        <Text style={[styles.who, { color: mine ? tint : colors.text }]} numberOfLines={1}>
          {who}
        </Text>
        {tag ? <Text style={[styles.tag, { color: inBand ? tint : colors.danger }]}>{tag}</Text> : null}
      </View>
      <Text style={[styles.amount, { color: colors.text }]}>{price.toLocaleString()}</Text>
      {mine && onEdit ? (
        <View style={styles.mine}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="가격 수정"
            disabled={busy}
            onPress={onEdit}
            style={[styles.mineBtn, { backgroundColor: colors.background }]}>
            <Text style={[styles.mineLabel, { color: colors.text }]}>수정</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="등록 취소"
            disabled={busy}
            onPress={onPress}
            style={[styles.mineBtn, { backgroundColor: colors.background }]}>
            <Text style={[styles.mineLabel, { color: colors.danger }]}>취소</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          disabled={busy || mine}
          onPress={onPress}
          style={[styles.action, { backgroundColor: mine ? colors.background : tint, opacity: mine ? 0.45 : 1 }]}>
          <Text style={[styles.actionLabel, { color: mine ? colors.secondary : '#fff' }]}>
            {kind === 'sell' ? '구매' : '팔기'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 18, padding: 14, borderWidth: 1.5 },
  body: { flex: 1, gap: 2 },
  who: { fontSize: 14, fontWeight: '700' },
  amount: { fontSize: 18, fontWeight: '900', fontVariant: ['tabular-nums'] },
  tag: { fontSize: 11, fontWeight: '700' },
  mine: { flexDirection: 'row', gap: 6 },
  mineBtn: { minWidth: 52, minHeight: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  mineLabel: { fontSize: 13, fontWeight: '800' },
  action: { minWidth: 64, minHeight: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  actionLabel: { fontSize: 14, fontWeight: '800' },
});
