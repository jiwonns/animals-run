import { useCatalog } from '@/providers/catalog-provider';
import { ScrollView } from '@/components/refreshable';
import { Image } from '@/components/gacha-image';
import { useRef, useState } from "react";
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { CraftShow, type CraftResult } from "@/components/home/craft-show";
import { Outcomes } from "@/components/home/outcomes";
import { PICK_PADDING, PickGrid } from "@/components/home/pick-grid";
import {
  formatChance,
  OddsButton,
  rowsByCollection,
} from "@/components/odds-info";
import {
  CHARACTER_BY_ID,
  CHARACTERS,
  type Character,
  type CharacterId,
} from "@/constants/characters";
import { REWARDS } from "@/constants/gacha.generated";
import { useColors } from "@/hooks/use-colors";
import { useGridCellWidth } from "@/hooks/use-grid-cell-width";
import {
  RECYCLE_COUNT,
  recycleCharacters,
  recycleOdds,
  tierOf,
} from "@/lib/craft";
import { HomeError } from "@/lib/home";
import { availableCopies, availablePicks } from "@/lib/inventory";
import { useSession } from "@/providers/session-provider";

type Show = { key: number; inputs: CharacterId[]; result: CraftResult | null };

const { base, perHigher, decay } = REWARDS.recycle.upgrade;
const recycleNotes = (picked: boolean) => [
  ...(picked ? [] : ["동물을 넣으면 그 조합의 확률을 보여드려요."]),
  `넣은 동물 중 가장 낮은 등급을 기준으로, 기본 ${formatChance(base)} 확률로 한 등급 위의 동물이 나와요.`,
  `기준보다 높은 등급의 동물을 1마리 넣을 때마다 그 확률이 ${formatChance(perHigher)}씩 올라가요.`,
  `그보다 더 높은 등급은 한 등급 올라갈 때마다 확률이 ${formatChance(decay)}배가 돼요.`,
  "같은 컬렉션 안의 동물은 모두 같은 확률이에요.",
];
const TRAY_COLUMNS = 5;
const TRAY_PADDING = 12;
const TRAY_GAP = 8;

export default function RecycleScreen() {
  useCatalog();
  const colors = useColors();
  const { user, profile } = useSession();
  const [selection, setPicks] = useState<CharacterId[]>([]);
  const picks = availablePicks(selection, profile);
  const submitting = useRef(false);
  const [show, setShow] = useState<Show | null>(null);
  const showKey = useRef(0);
  const slotSize = useGridCellWidth(
    TRAY_COLUMNS,
    PICK_PADDING + TRAY_PADDING,
    TRAY_GAP,
  );

  const characters = profile?.characters ?? {};
  const owned = CHARACTERS.filter((c) => (characters[c.id] ?? 0) > 0).sort(
    (a, b) =>
      Number(tierOf(b.id) > 0) - Number(tierOf(a.id) > 0) ||
      tierOf(a.id) - tierOf(b.id),
  );
  const counts: Partial<Record<CharacterId, number>> = {};
  for (const id of picks) counts[id] = (counts[id] ?? 0) + 1;
  /** The avatar keeps one copy. */
  const usable = (id: CharacterId) => availableCopies(profile, id);
  const odds = picks.length ? recycleOdds(picks) : null;
  const full = picks.length === RECYCLE_COUNT;

  function blockedReason(c: Character) {
    if (tierOf(c.id) === 0) return "재활용 불가";
    if (usable(c.id) <= 0) return "대표 동물";
    return null;
  }

  function add(id: CharacterId) {
    if (submitting.current) return;
    setPicks((previous) => {
      const current = availablePicks(previous, profile);
      if (current.filter((p) => p === id).length >= usable(id))
        return current.filter((p) => p !== id);
      return current.length < RECYCLE_COUNT ? [...current, id] : current;
    });
  }

  /** Fills the empty slots with spare copies (beyond one of each), lowest tier first. */
  function autoFill() {
    const next = [...picks];
    const used = { ...counts };
    for (const c of owned) {
      if (tierOf(c.id) === 0) continue;
      while (
        next.length < RECYCLE_COUNT &&
        (characters[c.id] ?? 0) - (used[c.id] ?? 0) > 1 &&
        (used[c.id] ?? 0) < usable(c.id)
      ) {
        next.push(c.id);
        used[c.id] = (used[c.id] ?? 0) + 1;
      }
    }
    if (next.length === picks.length)
      Alert.alert(
        "채울 동물이 없어요",
        "2마리 이상 가진 동물만 자동으로 넣어요.",
      );
    setPicks(next);
  }

  async function start() {
    if (!user || !full || show || submitting.current) return;
    submitting.current = true;
    const key = ++showKey.current;
    const inputs = [...picks];
    setShow({ key, inputs, result: null });
    try {
      const result = await recycleCharacters(user.uid, inputs);
      setShow((s) => (s?.key === key ? { ...s, result } : s));
      setPicks([]);
    } catch (error) {
      setShow(null);
      Alert.alert(
        "재활용하지 못했어요",
        error instanceof HomeError
          ? error.message
          : "잠시 후 다시 시도해주세요.",
      );
      setPicks([]);
    } finally {
      submitting.current = false;
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
      >
        <View style={[styles.tray, { backgroundColor: colors.surface }]}>
          {Array.from({ length: RECYCLE_COUNT }, (_, i) => {
            const id = picks[i];
            return (
              <Pressable
                key={i}
                accessibilityRole="button"
                accessibilityLabel={
                  id ? `${CHARACTER_BY_ID[id].name} 빼기` : "빈 자리"
                }
                disabled={!id}
                onPress={() => setPicks(picks.filter((_, j) => j !== i))}
                style={[
                  styles.traySlot,
                  {
                    width: slotSize,
                    height: slotSize,
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                  },
                ]}
              >
                {id && (
                  <Image
                    source={CHARACTER_BY_ID[id].thumb}
                    style={styles.trayImage}
                    contentFit="contain"
                  />
                )}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.actions}>
          <Text style={[styles.counter, { color: colors.text }]}>
            {picks.length}/{RECYCLE_COUNT}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={autoFill}
            disabled={full}
            style={({ pressed }) => [
              styles.chip,
              { backgroundColor: colors.surface },
              (pressed || full) && styles.pressed,
            ]}
          >
            <Text style={[styles.chipLabel, { color: colors.text }]}>
              중복 자동 채우기
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setPicks([])}
            disabled={!picks.length}
            style={({ pressed }) => [
              styles.chip,
              { backgroundColor: colors.surface },
              (pressed || !picks.length) && styles.pressed,
            ]}
          >
            <Text style={[styles.chipLabel, { color: colors.text }]}>
              비우기
            </Text>
          </Pressable>
        </View>

        <View style={[styles.info, { borderColor: colors.border }]}>
          <View style={styles.infoHeader}>
            <Text style={[styles.infoTitle, { color: colors.text }]}>
              나올 수 있는 동물
            </Text>
            <OddsButton
              title="재활용 확률"
              rows={odds ? rowsByCollection(odds) : []}
              notes={recycleNotes(!!odds)}
            />
          </View>
          {odds ? (
            <Outcomes
              characters={odds.map((o) => o.character)}
              owned={characters}
            />
          ) : (
            <Text style={[styles.infoText, { color: colors.secondary }]}>
              동물 {RECYCLE_COUNT}마리를 넣으면 1마리가 나와요. 가끔 한 등급
              위의 동물이 나오고, 높은 등급을 섞을수록 그 확률이 올라가요. 넣은
              동물은 사라져요.
            </Text>
          )}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          내 동물
        </Text>
        <Text style={[styles.infoText, { color: colors.secondary }]}>
          같은 동물도 여러 마리 넣을 수 있어요. 대표 동물 1마리는 남겨두며,
          보유량이 바뀌면 선택 수량도 자동으로 맞춰요.
        </Text>
        {owned.length === 0 ? (
          <Text style={[styles.infoText, { color: colors.secondary }]}>
            아직 가진 동물이 없어요.
          </Text>
        ) : (
          <PickGrid
            items={owned}
            owned={Object.fromEntries(owned.map((c) => [c.id, usable(c.id)]))}
            picked={counts}
            blockedReason={blockedReason}
            onPress={add}
          />
        )}
      </ScrollView>

      <View
        style={[
          styles.footer,
          { borderColor: colors.border, backgroundColor: colors.background },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          disabled={!full || !!show}
          onPress={start}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: full ? colors.primary : colors.border },
            pressed && styles.pressed,
          ]}
        >
          <Text
            style={[styles.buttonLabel, !full && { color: colors.secondary }]}
          >
            {full
              ? "재활용하기"
              : `${RECYCLE_COUNT - picks.length}마리 더 골라주세요`}
          </Text>
        </Pressable>
      </View>

      <Modal
        visible={!!show}
        transparent
        statusBarTranslucent
        navigationBarTranslucent
        animationType="fade"
        onRequestClose={() => {
          if (show?.result) setShow(null);
        }}
      >
        {show && (
          <CraftShow
            key={show.key}
            kind="recycle"
            inputs={show.inputs}
            result={show.result}
            onClose={() => setShow(null)}
          />
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    padding: PICK_PADDING,
    gap: 14,
  },
  tray: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderRadius: 20,
    padding: TRAY_PADDING,
    gap: TRAY_GAP,
  },
  traySlot: {
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  trayImage: {
    width: "85%",
    height: "85%",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  counter: {
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  info: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 8,
  },
  infoHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  infoText: {
    fontSize: 13,
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  footer: {
    paddingHorizontal: PICK_PADDING,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  button: {
    height: 54,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonLabel: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
  pressed: {
    opacity: 0.6,
  },
});
