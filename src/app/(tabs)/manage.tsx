import { useCatalog } from '@/providers/catalog-provider';
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { CoinBadge } from "@/components/coin-badge";
import { Icon, ICONS } from "@/components/icon";
import { WalkMap, type MapPlayer } from "@/components/walk-map";
import { REWARDS } from "@/constants/gacha.generated";
import { useActivePlayers } from "@/hooks/use-active-players";
import { useColors } from "@/hooks/use-colors";
import { useConfirmExit } from "@/hooks/use-confirm-exit";
import { displayName } from "@/lib/profile";
import { mapProfileRoute } from '@/lib/map-profile-route';
import { AvatarFace } from '@/components/avatar-face';
import { useSession } from "@/providers/session-provider";
import { useWalk } from "@/providers/walk-provider";

const WALK_COLOR = "#10B981";

export default function MapScreen() {
  useCatalog();
  const colors = useColors();
  useConfirmExit();
  const { user, profile } = useSession();
  const walk = useWalk();
  const { players: others } = useActivePlayers(user?.uid);
  const [focusKey, setFocusKey] = useState(0);
  const insets = useSafeAreaInsets();
  const { location, requestLocation } = walk;
  const asked = useRef(false);

  // Asks once on the first visit; after that only the button asks.
  useEffect(() => {
    if (location !== "denied" || asked.current) return;
    asked.current = true;
    requestLocation();
  }, [location, requestLocation]);

  const players: MapPlayer[] = others.map((p) => ({
    id: p.id,
    name: displayName(p),
    avatar: p.avatar,
    lat: p.lat,
    lng: p.lng,
    me: false,
  }));
  if (walk.position && profile) {
    players.push({
      id: user?.uid ?? "me",
      name: displayName(profile),
      avatar: profile.avatar ?? null,
      ...walk.position,
      me: true,
    });
  }

  const stepNote =
    Platform.OS === "web"
      ? "걸음은 앱에서만 셀 수 있어요"
      : walk.pedometer === "unavailable"
        ? "걸음 센서가 없는 기기예요"
        : walk.pedometer === "denied"
          ? "신체 활동을 허용하면 걸음이 코인이 돼요"
          : `${REWARDS.stepsPerCoin}걸음마다 1코인 · 오늘 +${Math.floor(walk.todaySteps / REWARDS.stepsPerCoin).toLocaleString()}코인`;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {walk.location === "denied" ? (
        <Message
          title="위치 권한이 필요해요"
          body={
            Platform.OS === "web"
              ? "내 위치와 주변 친구들을 지도에 보여주려면 위치를 허용해주세요. 허용 창이 안 뜨면 브라우저 설정에서 이 사이트의 위치를 허용해주세요."
              : "내 위치와 주변 친구들을 지도에 보여주려면 위치를 허용해주세요."
          }
          action={{
            label: "위치 허용하기",
            onPress: () => walk.requestLocation(),
          }}
          secondary={
            Platform.OS === "web"
              ? undefined
              : { label: "설정 열기", onPress: () => Linking.openSettings() }
          }
          colors={colors}
        />
      ) : (
        <WalkMap
          players={players}
          focusKey={focusKey}
          color={colors.primary}
          onPlayerPress={(uid) =>
            router.navigate(mapProfileRoute(uid, user?.uid))
          }
        />
      )}

      <SafeAreaView edges={["top"]} style={styles.top} pointerEvents="box-none">
        <View
          style={[
            styles.card,
            { backgroundColor: colors.background, borderColor: colors.border },
          ]}
        >
          <View style={[styles.well, { backgroundColor: `${WALK_COLOR}22` }]}>
            <Icon name={ICONS.walk} size={24} color={WALK_COLOR} />
          </View>
          <View style={styles.cardBody}>
            <Text style={[styles.cardLabel, { color: colors.secondary }]}>
              오늘 걸음
            </Text>
            <Text style={[styles.steps, { color: colors.text }]}>
              {walk.todaySteps.toLocaleString()}
              <Text style={[styles.stepsUnit, { color: colors.secondary }]}>
                {" "}
                걸음
              </Text>
            </Text>
            <Text
              style={[styles.cardNote, { color: colors.secondary }]}
              numberOfLines={1}
            >
              {stepNote}
            </Text>
          </View>
          <CoinBadge coins={profile?.coins ?? 0} />
        </View>
        {walk.location === "ready" && (
          <View style={styles.chips} pointerEvents="box-none">
            <View
              style={[
                styles.chip,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                },
              ]}
            >
              <Icon name={ICONS.people} size={15} color={colors.text} />
              <Text style={[styles.chipLabel, { color: colors.text }]}>
                지금 {others.length}명
              </Text>
            </View>
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: walk.sharing }}
              disabled={walk.sharingBusy}
              onPress={() => walk.setSharing(!walk.sharing)}
              hitSlop={6}
              style={({ pressed }) => [
                styles.chip,
                walk.sharing
                  ? { backgroundColor: WALK_COLOR, borderColor: WALK_COLOR }
                  : {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                    },
                pressed && styles.pressed,
              ]}
            >
              <Icon
                name={walk.sharing ? ICONS.visible : ICONS.hidden}
                size={15}
                color={walk.sharing ? "#fff" : colors.secondary}
              />
              <Text
                style={[
                  styles.chipLabel,
                  { color: walk.sharing ? "#fff" : colors.secondary },
                ]}
              >
                {walk.sharing ? "내 위치 공유 중" : "내 위치 숨김"}
              </Text>
            </Pressable>
            <View pointerEvents="box-none" style={{ width: '100%', alignItems: 'flex-end' }}>
            <Pressable accessibilityRole="switch" accessibilityLabel="친구에게만 내 위치 공유" accessibilityState={{ checked: walk.friendsOnly, disabled: walk.sharingBusy }} disabled={walk.sharingBusy}
              onPress={() => walk.setFriendsOnly(!walk.friendsOnly)} style={({ pressed }) => [styles.chip, { backgroundColor: walk.friendsOnly ? WALK_COLOR : colors.background, borderColor: walk.friendsOnly ? WALK_COLOR : colors.border, minHeight: 44, opacity: pressed || walk.sharingBusy ? 0.6 : 1 }]}>
              <Icon name={ICONS.people} size={15} color={walk.friendsOnly ? '#fff' : colors.secondary} />
              <Text style={[styles.chipLabel, { color: walk.friendsOnly ? '#fff' : colors.secondary }]}>친구에게만 위치 공유{walk.friendsOnly ? ' · 켜짐' : ''}</Text>
            </Pressable>
            {walk.friendsOnly && !walk.sharing && <Text style={{ color: colors.secondary, fontSize: 12, marginTop: 6 }}>공유를 켜면 친구에게만 보여요.</Text>}
            </View>
            {walk.sharingError && <Text style={{ color: colors.secondary }}>위치 공유 설정을 확인하지 못했어요.</Text>}
          </View>
        )}
      </SafeAreaView>

      {walk.location === "ready" && (
        <View
          style={[styles.bottom, { bottom: insets.bottom + 16 }]}
          pointerEvents="box-none"
        >
          <View style={styles.row} pointerEvents="box-none">
            {profile && <Pressable accessibilityRole="button" accessibilityLabel="내 프로필 열기" onPress={() => router.navigate('/mypage')}
              style={({ pressed }) => [styles.pill, { backgroundColor: colors.background, borderColor: colors.border, gap: 8 }, pressed && styles.pressed]}>
              <AvatarFace avatar={profile.avatar} size={28} fallback={displayName(profile)} />
              <Text style={[styles.pillLabel, { color: colors.text }]}>내 프로필</Text>
            </Pressable>}
            {!profile?.avatar && (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.navigate("/mypage/avatar")}
                style={({ pressed }) => [
                  styles.pill,
                  { backgroundColor: colors.primary },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.pillLabel, { color: "#fff" }]}>
                  지도에 표시할 동물 고르기
                </Text>
              </Pressable>
            )}
            <View style={styles.spacer} pointerEvents="none" />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="내 위치로 이동"
              onPress={() => setFocusKey((k) => k + 1)}
              style={({ pressed }) => [
                styles.locate,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                },
                pressed && styles.pressed,
              ]}
            >
              <Icon name={ICONS.locate} size={22} color={colors.primary} />
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

type MessageProps = {
  title: string;
  body?: string;
  action?: { label: string; onPress: () => void };
  secondary?: { label: string; onPress: () => void };
  colors: ReturnType<typeof useColors>;
};

function Message({ title, body, action, secondary, colors }: MessageProps) {
  return (
    <View style={styles.message}>
      <View style={[styles.messageIcon, { backgroundColor: colors.surface }]}>
        <Icon name={ICONS.location} size={36} color={colors.primary} />
      </View>
      <Text style={[styles.messageTitle, { color: colors.text }]}>{title}</Text>
      {body && (
        <Text style={[styles.messageBody, { color: colors.secondary }]}>
          {body}
        </Text>
      )}
      {action && (
        <Pressable
          accessibilityRole="button"
          onPress={action.onPress}
          style={({ pressed }) => [
            styles.messageButton,
            { backgroundColor: colors.primary },
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.messageButtonLabel}>{action.label}</Text>
        </Pressable>
      )}
      {secondary && (
        <Pressable
          accessibilityRole="button"
          onPress={secondary.onPress}
          hitSlop={8}
        >
          <Text style={[styles.messageLink, { color: colors.secondary }]}>
            {secondary.label}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  top: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    boxShadow: "0 4px 14px rgba(0, 0, 0, 0.12)",
  },
  well: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: {
    flex: 1,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  steps: {
    fontSize: 26,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  stepsUnit: {
    fontSize: 14,
    fontWeight: "700",
  },
  cardNote: {
    fontSize: 12,
    marginTop: 1,
  },
  chips: {
    flexDirection: "row",
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.12)",
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  bottom: {
    position: "absolute",
    left: 16,
    right: 16,
    gap: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  spacer: {
    flex: 1,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "transparent",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.12)",
  },
  pillLabel: {
    fontSize: 14,
    fontWeight: "700",
  },
  locate: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
  },
  pressed: {
    opacity: 0.7,
  },
  message: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  messageIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  messageTitle: {
    fontSize: 20,
    fontWeight: "800",
  },
  messageBody: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  messageButton: {
    marginTop: 8,
    borderRadius: 24,
    paddingHorizontal: 28,
    paddingVertical: 13,
  },
  messageButtonLabel: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  messageLink: {
    fontSize: 14,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
});
