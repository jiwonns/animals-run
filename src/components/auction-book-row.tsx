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
}) {
  const colors = useColors();
  const tint = kind === 'sell' ? AUCTION_SELL_COLOR : AUCTION_BID_COLOR;
  const inBand = isInBand(characterId, price, quote);
  const tag = inBand ? (next ? '지금 이 가격' : undefined) : '시세 밖';
  const action = mine ? '취소' : kind === 'sell' ? '구매' : '팔기';
  return (
    <View style={[styles.row, { backgroundColor: colors.surface, borderColor: `${tint}55` }]}>
      <View style={[styles.kind, { backgroundColor: `${tint}22` }]}>
        <Text style={[styles.kindLabel, { color: tint }]}>{kind === 'sell' ? '팔아요' : '살게요'}</Text>
      </View>
      <View style={styles.body}>
        <Text style={[styles.who, { color: colors.text }]} numberOfLines={1}>
          {who}
        </Text>
        {tag ? <Text style={[styles.tag, { color: inBand ? tint : colors.danger }]}>{tag}</Text> : null}
      </View>
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={onPress}
        style={[styles.action, { backgroundColor: mine ? colors.background : tint }]}>
        <Text style={[styles.price, { color: mine ? colors.text : '#fff' }]}>{price.toLocaleString()}</Text>
        <Text style={[styles.actionLabel, { color: mine ? colors.secondary : 'rgba(255,255,255,0.88)' }]}>{action}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 18, padding: 12, borderWidth: 1.5 },
  kind: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 6 },
  kindLabel: { fontSize: 11, fontWeight: '800' },
  body: { flex: 1, gap: 2 },
  who: { fontSize: 14, fontWeight: '700' },
  tag: { fontSize: 11, fontWeight: '700' },
  action: { minWidth: 76, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 10, alignItems: 'center' },
  price: { fontSize: 16, fontWeight: '900' },
  actionLabel: { fontSize: 11, fontWeight: '700' },
});
