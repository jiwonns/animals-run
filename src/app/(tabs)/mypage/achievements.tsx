import { router } from "expo-router";
import { Fragment, useRef, useState, type ReactNode } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GradeBadge } from "@/components/grade-badge";
import { Icon, ICONS } from "@/components/icon";
import { RunningLoader } from "@/components/running-loader";
import { TICKET_COLOR } from "@/components/ticket-badge";
import {
  CHARACTERS,
  COLLECTIONS,
  GRADE_ORDER,
  GRADES,
  type CharacterId,
} from "@/constants/characters";
import { REWARDS } from "@/constants/gacha.generated";
import { useAchievements } from "@/hooks/use-achievements";
import { useColors } from "@/hooks/use-colors";
import {
  characterReward,
  claimRewards,
  earnedRewards,
  gradeReward,
  nextMilestone,
  totalTickets,
  type Reward,
} from "@/lib/rewards";
import { useSession } from "@/providers/session-provider";

const CHARACTER_LEVELS = [
  1,
  ...REWARDS.character.milestones,
  REWARDS.character.every,
];
const DONE_COLOR = "#22C55E";
/** 12% alpha, for tinted icon wells and pills. */
const tint = (hex: string) => `${hex}1F`;

const CATEGORY: Record<
  string,
  { icon: keyof typeof ICONS; label: string; color: string }
> = {
  grade_first: { icon: "grade", label: "등급", color: "#F59E0B" },
  grade_count: { icon: "grade", label: "등급", color: "#F59E0B" },
  char_first: { icon: "character", label: "캐릭터", color: "#EC4899" },
  char_count: { icon: "character", label: "캐릭터", color: "#EC4899" },
  collection_complete: {
    icon: "collection",
    label: "컬렉션",
    color: "#0EA5E9",
  },
  draws: { icon: "draws", label: "누적 뽑기", color: "#10B981" },
};
const categoryOf = (reward: Reward) =>
  CATEGORY[reward.id.split(":")[0]] ?? CATEGORY.draws;

export default function AchievementsScreen() {
  const colors = useColors();
  const { user, profile, claimed, claimsFailed } = useSession();
  const { state, claimable, ready } = useAchievements();
  const [claiming, setClaiming] = useState(false);
  const claimLock = useRef(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const insets = useSafeAreaInsets();

  if (claimsFailed) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.failed, { color: colors.secondary }]}>
          업적 정보를 불러오지 못했어요.{"\n"}Firebase 콘솔에 최신
          firestore.rules가 게시됐는지 확인해주세요.
        </Text>
      </View>
    );
  }

  if (!ready || !claimed) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <RunningLoader label="업적을 확인하는 중" />
      </View>
    );
  }

  async function claim(rewards: Reward[]) {
    if (!user || claimLock.current || !rewards.length) return;
    claimLock.current = true;
    setProgress({ done: 0, total: rewards.length });
    setClaiming(true);
    try {
      const paid = await claimRewards(user.uid, rewards, (done, total) =>
        setProgress({ done, total }),
      );
      if (paid.length < rewards.length)
        Alert.alert(
          "일부 보상을 받지 못했어요",
          `지급된 보상은 저장됐어요. 남은 ${rewards.length - paid.length}개는 다시 받을 수 있어요.`,
        );
    } finally {
      claimLock.current = false;
      setClaiming(false);
    }
  }

  const owned = (id: CharacterId) => (state.characters[id] ?? 0) > 0;
  const ownedGrades = new Set(
    CHARACTERS.filter((c) => owned(c.id)).map((c) => c.grade),
  );
  const presentGrades = GRADE_ORDER.filter((g) =>
    CHARACTERS.some((c) => c.grade === g),
  );
  const earnedCount = earnedRewards(state).length;
  const {
    milestones: drawMilestones,
    every: drawEvery,
    reward: drawReward,
  } = REWARDS.drawCount;
  const nextDraw = nextMilestone(state.drawCount, drawMilestones, drawEvery);
  const hidden = characterReward("H");
  const pendingIds = new Set(claimable.map((r) => r.id));

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.content,
          { paddingBottom: claimable.length || claiming ? 35 : 20 },
        ]}
      >
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroCaption}>보유 뽑기권</Text>
              <Text style={styles.heroAmount}>
                {(profile?.tickets ?? 0).toLocaleString()}
                <Text style={styles.heroUnit}> 장</Text>
              </Text>
            </View>
            <View style={styles.heroIcon}>
              <Icon name={ICONS.trophy} size={34} color="#fff" />
            </View>
          </View>
          <View style={styles.heroStats}>
            <HeroStat label="달성한 업적" value={earnedCount} />
            <View style={styles.heroDivider} />
            <HeroStat label="받은 보상" value={claimed.size} />
            <View style={styles.heroDivider} />
            <HeroStat
              label="받을 보상"
              value={claimable.length}
              highlight={claimable.length > 0}
            />
          </View>
          <Text style={styles.heroHint}>
            뽑기권 1장 = 1회 가격 {REWARDS.ticketMaxCost}코인 이하 뽑기 1번
          </Text>
        </View>

        <Section
          icon="gift"
          color={TICKET_COLOR}
          title="받을 수 있는 보상"
          badge={claimable.length > 0 ? `${claimable.length}개` : undefined}
          subtitle={
            claimable.length > 0
              ? `모두 받으면 뽑기권 +${totalTickets(claimable)}장`
              : "업적을 달성하면 여기에 쌓여요"
          }
        >
          {claimable.length === 0 ? (
            <View style={styles.empty}>
              <Icon name={ICONS.check} size={28} color={colors.border} />
              <Text style={[styles.emptyText, { color: colors.secondary }]}>
                지금은 받을 보상이 없어요
              </Text>
            </View>
          ) : (
            <>
              <Divided>
                {claimable.map((reward) => {
                  const category = categoryOf(reward);
                  return (
                    <View key={reward.id} style={styles.row}>
                      <IconWell icon={category.icon} color={category.color} />
                      <View style={styles.rowBody}>
                        <Text
                          style={[styles.rowTitle, { color: colors.text }]}
                          numberOfLines={1}
                        >
                          {reward.label}
                        </Text>
                        <Text
                          style={[
                            styles.rowCaption,
                            { color: colors.secondary },
                          ]}
                        >
                          {category.label} 업적
                        </Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${reward.label} 보상 뽑기권 ${reward.tickets}장 받기`}
                        disabled={claiming}
                        onPress={() => claim([reward])}
                        style={({ pressed }) => [
                          styles.claimChip,
                          {
                            backgroundColor: TICKET_COLOR,
                            opacity: claiming ? 0.5 : pressed ? 0.8 : 1,
                          },
                        ]}
                      >
                        <Icon name={ICONS.ticket} size={14} color="#fff" />
                        <Text style={styles.claimChipLabel}>
                          +{reward.tickets} 받기
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
              </Divided>
            </>
          )}
        </Section>

        <Section
          icon="grade"
          color={CATEGORY.grade_first.color}
          title="등급"
          subtitle="등급별 첫 획득과 누적 마릿수"
        >
          <Divided>
            {presentGrades.map((grade) => {
              const amounts = gradeReward(grade);
              const count = state.gradeCounts[grade] ?? 0;
              const next = nextMilestone(count, [], REWARDS.grade.every);
              return (
                <View key={grade} style={styles.gradeBlock}>
                  <View style={styles.gradeHeader}>
                    <GradeBadge grade={grade} showLabel />
                    <Text
                      style={[styles.rowCaption, { color: colors.secondary }]}
                    >
                      누적 {count}마리
                    </Text>
                  </View>
                  <AchievementRow
                    title={`첫 ${GRADES[grade].label} 등급 획득`}
                    done={ownedGrades.has(grade)}
                    pending={pendingIds.has(`grade_first:${grade}`)}
                    reward={amounts.first}
                  />
                  <AchievementRow
                    title={`${next}마리 뽑기`}
                    caption={`${REWARDS.grade.every}마리마다 반복`}
                    progress={[count, next]}
                    reward={amounts.every}
                  />
                </View>
              );
            })}
          </Divided>
        </Section>

        <Section
          icon="character"
          color={CATEGORY.char_first.color}
          title="캐릭터"
          subtitle={`종류마다 첫 획득 · ${REWARDS.character.milestones.join("·")}마리 · 이후 ${REWARDS.character.every}마리마다`}
        >
          <Divided>
            {CHARACTER_LEVELS.map((level) => {
              const done = CHARACTERS.filter(
                (c) => (state.characters[c.id] ?? 0) >= level,
              ).length;
              const amounts = REWARDS.character.default;
              const isFirst = level === 1;
              const isMilestone = REWARDS.character.milestones.includes(level);
              const amount = isFirst
                ? amounts.first
                : isMilestone
                  ? amounts.milestone
                  : amounts.every;
              const hiddenAmount = isFirst
                ? hidden.first
                : isMilestone
                  ? hidden.milestone
                  : hidden.every;
              return (
                <AchievementRow
                  key={level}
                  title={
                    isFirst ? "종류별 첫 획득" : `같은 캐릭터 ${level}마리`
                  }
                  caption={`${done}종 달성`}
                  progress={[done, CHARACTERS.length]}
                  reward={amount}
                  rewardNote={
                    hiddenAmount !== amount
                      ? `히든 +${hiddenAmount}`
                      : undefined
                  }
                />
              );
            })}
          </Divided>
        </Section>

        <Section
          icon="collection"
          color={CATEGORY.collection_complete.color}
          title="컬렉션 완성"
          subtitle="컬렉션의 모든 캐릭터 모으기"
        >
          <Divided>
            {COLLECTIONS.map((collection) => {
              const members = CHARACTERS.filter(
                (c) => c.collection === collection.id,
              );
              const have = members.filter((c) => owned(c.id)).length;
              return (
                <AchievementRow
                  key={collection.id}
                  left={<GradeBadge grade={collection.grade} />}
                  title={collection.name}
                  progress={[have, members.length]}
                  pending={pendingIds.has(
                    `collection_complete:${collection.id}`,
                  )}
                  reward={REWARDS.collectionComplete}
                />
              );
            })}
          </Divided>
        </Section>

        <Section
          icon="draws"
          color={CATEGORY.draws.color}
          title="누적 뽑기"
          subtitle={`지금까지 ${state.drawCount.toLocaleString()}회 뽑았어요`}
        >
          <AchievementRow
            title={`${nextDraw.toLocaleString()}회 뽑기`}
            caption={`${drawMilestones.join("·")}회, 이후 ${drawEvery.toLocaleString()}회마다`}
            progress={[state.drawCount, nextDraw]}
            reward={drawReward}
          />
        </Section>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/mypage/history")}
          style={({ pressed }) => [
            styles.card,
            styles.link,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && { opacity: 0.6 },
          ]}
        >
          <IconWell icon="history" color={colors.secondary} />
          <Text
            style={[styles.rowTitle, styles.rowBody, { color: colors.text }]}
          >
            뽑기 기록 보기
          </Text>
          <Icon name={ICONS.chevron} size={16} color={colors.secondary} />
        </Pressable>
      </ScrollView>
      {(claimable.length > 0 || claiming) && (
        <View
          style={{
            padding: 16,
            paddingBottom: Math.max(insets.bottom, 16),
            borderTopWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
            backgroundColor: colors.background,
            gap: 9,
          }}
        >
          <Text
            accessibilityLiveRegion="polite"
            style={{
              color: colors.secondary,
              fontSize: 12,
              textAlign: "center",
            }}
          >
            {claiming
              ? `${progress.done} / ${progress.total}개 지급 완료`
              : `받을 수 있는 보상 ${claimable.length}개 · 스크롤 없이 한 번에 받기`}
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={claiming}
            onPress={() => claim([...claimable])}
            style={({ pressed }) => [
              styles.claimAll,
              {
                backgroundColor: TICKET_COLOR,
                opacity: claiming ? 0.6 : pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text style={styles.claimAllLabel}>
              {claiming
                ? "보상을 받고 있어요…"
                : `모두 받기 · 뽑기권 +${totalTickets(claimable)}장`}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function HeroStat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <View style={styles.heroStat}>
      <Text
        style={[styles.heroStatValue, highlight && styles.heroStatHighlight]}
      >
        {value.toLocaleString()}
      </Text>
      <Text style={styles.heroStatLabel}>{label}</Text>
    </View>
  );
}

function IconWell({
  icon,
  color,
}: {
  icon: keyof typeof ICONS;
  color: string;
}) {
  return (
    <View style={[styles.iconWell, { backgroundColor: tint(color) }]}>
      <Icon name={ICONS[icon]} size={18} color={color} />
    </View>
  );
}

function Section({
  icon,
  color,
  title,
  subtitle,
  badge,
  children,
}: {
  icon: keyof typeof ICONS;
  color: string;
  title: string;
  subtitle?: string;
  badge?: string;
  children: ReactNode;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={[styles.sectionHeader, { borderColor: colors.border }]}>
        <IconWell icon={icon} color={color} />
        <View style={styles.rowBody}>
          <View style={styles.sectionTitleLine}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {title}
            </Text>
            {badge && (
              <View style={[styles.sectionBadge, { backgroundColor: color }]}>
                <Text style={styles.sectionBadgeLabel}>{badge}</Text>
              </View>
            )}
          </View>
          {subtitle && (
            <Text style={[styles.rowCaption, { color: colors.secondary }]}>
              {subtitle}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

/** Stacks children with a hairline between each. */
function Divided({ children }: { children: ReactNode[] }) {
  const colors = useColors();
  return children.map((child, index) => (
    <Fragment key={index}>
      {index > 0 && (
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
      )}
      {child}
    </Fragment>
  ));
}

function AchievementRow({
  title,
  caption,
  left,
  done,
  pending,
  progress,
  reward,
  rewardNote,
}: {
  title: string;
  caption?: string;
  left?: ReactNode;
  done?: boolean;
  pending?: boolean;
  progress?: [number, number];
  reward: number;
  rewardNote?: string;
}) {
  const colors = useColors();
  const complete = done ?? (progress ? progress[0] >= progress[1] : false);
  const ratio = progress ? Math.min(1, progress[0] / progress[1]) : 0;
  const barColor = complete ? DONE_COLOR : TICKET_COLOR;
  return (
    <View style={styles.achievement}>
      <View style={styles.row}>
        {left}
        <View style={styles.rowBody}>
          <View style={styles.titleLine}>
            {complete && (
              <Icon name={ICONS.check} size={16} color={DONE_COLOR} />
            )}
            <Text
              style={[styles.rowTitle, { color: colors.text }]}
              numberOfLines={1}
            >
              {title}
            </Text>
          </View>
          {caption && (
            <Text style={[styles.rowCaption, { color: colors.secondary }]}>
              {caption}
            </Text>
          )}
        </View>
        {pending ? (
          <View style={[styles.statusPill, { backgroundColor: TICKET_COLOR }]}>
            <Text style={styles.statusPillLabel}>받기 대기</Text>
          </View>
        ) : (
          <View style={styles.rewardColumn}>
            <View
              style={[
                styles.rewardPill,
                {
                  borderColor: complete ? colors.border : TICKET_COLOR,
                  backgroundColor: complete
                    ? "transparent"
                    : tint(TICKET_COLOR),
                },
              ]}
            >
              <Icon
                name={ICONS.ticket}
                size={12}
                color={complete ? colors.secondary : TICKET_COLOR}
              />
              <Text
                style={[
                  styles.rewardPillLabel,
                  { color: complete ? colors.secondary : TICKET_COLOR },
                ]}
              >
                +{reward}
              </Text>
            </View>
            {rewardNote && (
              <Text style={[styles.rewardNote, { color: colors.secondary }]}>
                {rewardNote}
              </Text>
            )}
          </View>
        )}
      </View>
      {progress && (
        <View style={styles.progressLine}>
          <View style={[styles.track, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.fill,
                { backgroundColor: barColor, width: `${ratio * 100}%` },
              ]}
            />
          </View>
          <Text style={[styles.progressText, { color: colors.secondary }]}>
            {progress[0].toLocaleString()} / {progress[1].toLocaleString()}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  failed: {
    textAlign: "center",
    fontSize: 13,
    lineHeight: 20,
    paddingHorizontal: 32,
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  hero: {
    borderRadius: 24,
    padding: 20,
    gap: 16,
    backgroundColor: TICKET_COLOR,
    borderCurve: "continuous",
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  heroCaption: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    fontWeight: "600",
  },
  heroAmount: {
    color: "#fff",
    fontSize: 40,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  heroUnit: {
    fontSize: 18,
    fontWeight: "700",
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroStats: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    paddingVertical: 12,
    backgroundColor: "rgba(0,0,0,0.14)",
  },
  heroStat: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  heroStatValue: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  heroStatHighlight: {
    color: "#FDE047",
  },
  heroStatLabel: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    fontWeight: "600",
  },
  heroDivider: {
    width: StyleSheet.hairlineWidth * 2,
    alignSelf: "stretch",
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  heroHint: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    borderCurve: "continuous",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
  },
  sectionTitleLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  sectionBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  sectionBadgeLabel: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
  },
  sectionBody: {
    padding: 16,
    gap: 14,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  iconWell: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
  },
  emptyText: {
    fontSize: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  titleLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  rowTitle: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: "700",
  },
  rowCaption: {
    fontSize: 12,
  },
  claimChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  claimChipLabel: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
  claimAll: {
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  claimAllLabel: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },
  gradeBlock: {
    gap: 12,
  },
  gradeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  achievement: {
    gap: 8,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusPillLabel: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
  },
  rewardColumn: {
    alignItems: "flex-end",
    gap: 2,
  },
  rewardPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  rewardPillLabel: {
    fontSize: 13,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  rewardNote: {
    fontSize: 11,
  },
  progressLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  track: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 4,
  },
  progressText: {
    minWidth: 56,
    textAlign: "right",
    fontSize: 12,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  link: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
  },
});
