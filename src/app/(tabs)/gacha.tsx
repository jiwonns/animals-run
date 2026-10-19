import { useState, type ReactNode } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BannerPoster } from '@/components/banner-poster';
import { CoinBadge, CoinToken } from '@/components/coin-badge';
import { DrawShow } from '@/components/gacha/draw-show';
import { OddsButton } from '@/components/odds-info';
import { TICKET_COLOR, TicketBadge, TicketToken } from '@/components/ticket-badge';
import { BANNERS, type Banner, type DrawCount } from '@/constants/banners';
import { charactersIn, COLLECTIONS, GRADES } from '@/constants/characters';
import { useColors } from '@/hooks/use-colors';
import { useConfirmExit } from '@/hooks/use-confirm-exit';
import { acceptsTickets, drawCharacters, DrawError, type DrawResult, type Payment } from '@/lib/gacha';
import type { Reward } from '@/lib/rewards';
import { useSession } from '@/providers/session-provider';

const SIDE_PADDING = 32;
const MAX_POSTER_RATIO = 1.65;

type Show = { key: number; banner: Banner; count: DrawCount; payment: Payment };

export default function GachaScreen() {
  const colors = useColors();
  useConfirmExit();
  const { width } = useWindowDimensions();
  const { user, profile } = useSession();
  const coins = profile?.coins ?? 0;
  const tickets = profile?.tickets ?? 0;

  const [pagerHeight, setPagerHeight] = useState(0);
  const [paymentChoice, setPaymentChoice] = useState<Payment>('coins');
  const [show, setShow] = useState<Show | null>(null);
  const [results, setResults] = useState<DrawResult[] | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);

  const scrollX = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollX.set(e.contentOffset.x);
  });

  const affordable = (b: Banner, p: Payment, count: DrawCount) =>
    p === 'coins' ? coins >= b.cost[count] : tickets >= count;
  const costLabel = (b: Banner, p: Payment, count: DrawCount) =>
    p === 'coins' ? `${b.cost[count]}코인` : `뽑기권 ${count}장`;

  async function draw(b: Banner, count: DrawCount, p: Payment) {
    if (!user) return;
    setResults(null);
    setRewards([]);
    setShow((prev) => ({ key: (prev?.key ?? 0) + 1, banner: b, count, payment: p }));
    try {
      const outcome = await drawCharacters(user.uid, b, count, p);
      setResults(outcome.results);
      setRewards(outcome.rewards);
    } catch (error) {
      setShow(null);
      Alert.alert('뽑기 실패', error instanceof DrawError ? error.message : '잠시 후 다시 시도해주세요.');
    }
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>뽑기</Text>
        <View style={styles.wallet}>
          <TicketBadge tickets={tickets} />
          <CoinBadge coins={coins} />
        </View>
      </View>

      <View style={styles.dots}>
        {BANNERS.map((b, index) => (
          <Dot
            key={b.id}
            index={index}
            interval={width}
            scrollX={scrollX}
            idle={colors.border}
            active={colors.primary}
          />
        ))}
      </View>

      <View style={styles.pager} onLayout={(e) => setPagerHeight(e.nativeEvent.layout.height)}>
        {pagerHeight > 0 && (
          <Animated.ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={onScroll}>
            {BANNERS.map((banner) => {
              const payment: Payment = acceptsTickets(banner) ? paymentChoice : 'coins';
              return (
                <BannerPage key={banner.id} banner={banner} width={width} height={pagerHeight}>
                  {acceptsTickets(banner) && (
                    <View style={[styles.payment, { backgroundColor: colors.surface }]}>
                      {(
                        [
                          ['coins', '코인으로'],
                          ['tickets', `뽑기권 ${tickets}장`],
                        ] as const
                      ).map(([value, label]) => {
                        const selected = payment === value;
                        return (
                          <Pressable
                            key={value}
                            accessibilityRole="button"
                            accessibilityState={{ selected }}
                            onPress={() => setPaymentChoice(value)}
                            style={[
                              styles.paymentOption,
                              selected && [styles.paymentSelected, { backgroundColor: colors.background }],
                            ]}>
                            <CostMark kind={value} />
                            <Text
                              style={[
                                styles.paymentLabel,
                                { color: selected ? (value === 'tickets' ? TICKET_COLOR : colors.text) : colors.secondary },
                              ]}>
                              {label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}

                  <View style={styles.buttons}>
                    <DrawButton
                      label="1회 뽑기"
                      cost={costLabel(banner, payment, 1)}
                      kind={payment}
                      disabled={!!show || !affordable(banner, payment, 1)}
                      onPress={() => draw(banner, 1, payment)}
                    />
                    <DrawButton
                      primary
                      label="10회 뽑기"
                      cost={costLabel(banner, payment, 10)}
                      kind={payment}
                      badge={payment === 'coins' ? discountLabel(banner) : undefined}
                      disabled={!!show || !affordable(banner, payment, 10)}
                      onPress={() => draw(banner, 10, payment)}
                    />
                  </View>
                </BannerPage>
              );
            })}
          </Animated.ScrollView>
        )}
      </View>

      <Modal
        visible={!!show}
        transparent
        statusBarTranslucent
        navigationBarTranslucent
        animationType="fade"
        onRequestClose={() => {
          if (results) setShow(null);
        }}>
        {show && (
          <DrawShow
            key={show.key}
            banner={show.banner}
            results={results}
            rewards={rewards}
            againLabel={costLabel(show.banner, show.payment, show.count)}
            againDisabled={!affordable(show.banner, show.payment, show.count)}
            onAgain={() => draw(show.banner, show.count, show.payment)}
            onClose={() => setShow(null)}
          />
        )}
      </Modal>
    </SafeAreaView>
  );
}

function discountLabel(banner: Banner) {
  const pct = Math.round((1 - banner.cost[10] / (banner.cost[1] * 10)) * 100);
  return pct > 0 ? `${pct}% 할인` : undefined;
}

/** One swipeable page: the poster, its odds and the controls that draw from it. */
function BannerPage({ banner, width, height, children }: {
  banner: Banner;
  width: number;
  height: number;
  children: ReactNode;
}) {
  const [stageHeight, setStageHeight] = useState(0);
  const posterWidth = width - SIDE_PADDING * 2;
  const posterHeight = Math.min(stageHeight - 16, posterWidth * MAX_POSTER_RATIO);

  return (
    <View style={{ width, height }}>
      <View style={styles.stage} onLayout={(e) => setStageHeight(e.nativeEvent.layout.height)}>
        {stageHeight > 0 && <BannerPoster banner={banner} width={posterWidth} height={posterHeight} />}
      </View>
      <View style={styles.odds}>
        <OddsButton
          title={`${banner.title} 확률`}
          rows={banner.rates.map(({ collection, rate }) => {
            const { name, grade } = COLLECTIONS.find((c) => c.id === collection)!;
            return {
              key: collection,
              label: `${name} ${charactersIn(collection).length}종`,
              chance: rate,
              color: GRADES[grade].color,
            };
          })}
          notes={['같은 컬렉션 안의 동물은 모두 같은 확률이에요.']}
        />
      </View>
      {children}
    </View>
  );
}

function Dot({ index, interval, scrollX, idle, active }: {
  index: number;
  interval: number;
  scrollX: SharedValue<number>;
  idle: string;
  active: string;
}) {
  const style = useAnimatedStyle(() => {
    const range = [(index - 1) * interval, index * interval, (index + 1) * interval];
    const t = interpolate(scrollX.get(), range, [0, 1, 0], Extrapolation.CLAMP);
    return { width: 8 + 14 * t, backgroundColor: interpolateColor(t, [0, 1], [idle, active]) };
  });
  return <Animated.View style={[styles.dot, style]} />;
}

function CostMark({ kind, inverse = false }: { kind: Payment; inverse?: boolean }) {
  const colors = useColors();
  return kind === 'tickets' ? <TicketToken size={20} cutoutColor={inverse ? colors.primary : colors.surface} /> : <CoinToken size={18} />;
}

function DrawButton({ label, cost, kind, badge, primary = false, disabled, onPress }: {
  label: string;
  cost: string;
  kind: Payment;
  badge?: string;
  primary?: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const sub = primary ? 'rgba(255,255,255,0.85)' : colors.secondary;

  return (
    <Animated.View style={[styles.buttonWrap, pressStyle, disabled && styles.disabled]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${cost}`}
        disabled={disabled}
        onPress={onPress}
        onPressIn={() => scale.set(withSpring(0.96, { damping: 15 }))}
        onPressOut={() => scale.set(withSpring(1, { damping: 12 }))}
        style={[styles.button, { backgroundColor: primary ? colors.primary : colors.surface }]}>
        <Text style={[styles.buttonLabel, { color: primary ? '#fff' : colors.text }]}>{label}</Text>
        <View style={styles.costRow}>
          <CostMark kind={kind} inverse={primary} />
          <Text style={[styles.buttonCost, { color: sub }]}>{cost}</Text>
          {badge && <Text style={[styles.badgeLabel, { color: primary ? '#fff' : colors.primary }]}>· {badge}</Text>}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
  },
  wallet: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 2,
  },
  pager: {
    flex: 1,
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  odds: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    marginBottom: 10,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  payment: {
    flexDirection: 'row',
    marginHorizontal: 24,
    marginBottom: 14,
    padding: 4,
    borderRadius: 14,
  },
  paymentOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 11,
  },
  paymentSelected: {
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  },
  paymentLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
    paddingHorizontal: 24,
  },
  buttonWrap: {
    flex: 1,
  },
  button: {
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: {
    fontSize: 17,
    fontWeight: '800',
  },
  costRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  buttonCost: {
    fontSize: 13,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.45,
  },
  badgeLabel: {
    fontSize: 13,
    fontWeight: '800',
  },
  coinMark: {
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: '#FFC531',
    borderWidth: 1.5,
    borderColor: '#E8A300',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinMarkLabel: {
    color: '#9A6A00',
    fontSize: 8,
    fontWeight: '900',
  },
  ticketMark: {
    width: 18,
    height: 13,
    borderRadius: 3,
    backgroundColor: TICKET_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markInverse: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  markLabel: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '900',
  },
});
