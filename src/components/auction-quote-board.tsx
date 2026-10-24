import { StyleSheet, Text, View } from 'react-native';

import { REWARDS } from '@/constants/gacha.generated';
import { useColors } from '@/hooks/use-colors';
import { nextAuctionSlot, type MarketBand } from '@/lib/auction';

export function AuctionQuoteBoard({
  band,
  volume = 0,
  extra,
}: {
  band: MarketBand;
  volume?: number;
  extra?: string;
}) {
  const colors = useColors();
  const nextHour = new Date(nextAuctionSlot() + 9 * 60 * 60 * 1000).getUTCHours();
  const span = Math.max(1, band.max - band.min);
  const t = Math.min(1, Math.max(0, (band.quote - band.min) / span));
  return (
    <View style={styles.board}>
      <View style={styles.stats}>
        <Stat label="하한가" value={band.min} color={colors.secondary} align="left" />
        <Stat label="시세" value={band.quote} color={colors.text} align="center" strong />
        <Stat label="상한가" value={band.max} color={colors.secondary} align="right" />
      </View>
      <View style={styles.range}>
        <View style={[styles.track, { backgroundColor: colors.border }]} />
        <View
          style={[
            styles.dot,
            {
              backgroundColor: colors.primary,
              borderColor: colors.background,
              left: `${t * 100}%`,
            },
          ]}
        />
      </View>
      <Text style={[styles.hint, { color: colors.secondary }]}>
        시세의 {REWARDS.auction.low}~{REWARDS.auction.high}% 안에서만 올리고 걸 수 있어요
        {` · 다음 ${nextHour}시`}
        {volume > 0 ? ` · 지난 ${volume.toLocaleString()}건` : ''}
        {extra ? ` · ${extra}` : ''}
      </Text>
    </View>
  );
}

function Stat({
  label,
  value,
  color,
  align,
  strong,
}: {
  label: string;
  value: number;
  color: string;
  align: 'left' | 'center' | 'right';
  strong?: boolean;
}) {
  return (
    <View style={[styles.stat, { alignItems: align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center' }]}>
      <Text style={[styles.label, { color }]}>{label}</Text>
      <Text style={[styles.value, { color, fontSize: strong ? 20 : 16 }]}>{value.toLocaleString()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  board: { gap: 8 },
  stats: { flexDirection: 'row', alignItems: 'flex-end' },
  stat: { flex: 1, gap: 2 },
  label: { fontSize: 11, fontWeight: '800' },
  value: { fontWeight: '900', fontVariant: ['tabular-nums'] },
  range: { height: 12, justifyContent: 'center' },
  track: { height: 6, borderRadius: 999 },
  dot: { position: 'absolute', width: 12, height: 12, borderRadius: 6, marginLeft: -6, borderWidth: 2 },
  hint: { fontSize: 11, fontWeight: '600', lineHeight: 16 },
});
