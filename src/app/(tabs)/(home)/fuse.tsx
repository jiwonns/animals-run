import { useCatalog } from '@/providers/catalog-provider';
import { ScrollView } from '@/components/refreshable';
import { Image } from '@/components/gacha-image';
import { useRef, useState } from "react";
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { CraftShow, type CraftResult } from "@/components/home/craft-show";
import { Outcomes } from "@/components/home/outcomes";
import { PICK_PADDING, PickGrid } from "@/components/home/pick-grid";
import { Icon, ICONS } from "@/components/icon";
import { OddsButton, rowsByCollection } from "@/components/odds-info";
import {
  CHARACTER_BY_ID,
  CHARACTERS,
  GRADE_ORDER,
  GRADES,
  type Character,
  type CharacterId,
} from "@/constants/characters";
import { REWARDS } from "@/constants/gacha.generated";
import { useColors } from "@/hooks/use-colors";
import { fuse, fusionOdds, fusionOf } from "@/lib/craft";
import { HomeError } from "@/lib/home";
import { availableCopies, availablePicks } from "@/lib/inventory";
import { useSession } from "@/providers/session-provider";

type Show = {
  key: number;
  inputs: [CharacterId, CharacterId];
  result: CraftResult | null;
};

const fusionNotes = [
  ...GRADE_ORDER.flatMap((g) => {
    const settings = REWARDS.fusion[g];
    return settings
      ? [
          `${GRADES[g].label} 합성: 성공 ${Math.round(settings.success * 100)}% · ${settings.coins}코인`,
        ]
      : [];
  }),
  "성공하면 한 등급 위의 동물 중 1마리가 나오고, 같은 컬렉션 안의 동물은 모두 같은 확률이에요.",
  "실패하면 넣은 동물과 코인이 사라져요.",
];

export default function FuseScreen() {
  useCatalog();
  const colors = useColors();
  const { user, profile } = useSession();
  const [selection, setPicks] = useState<CharacterId[]>([]);
  const picks = availablePicks(selection, profile);
  const submitting = useRef(false);
  const [show, setShow] = useState<Show | null>(null);
  const showKey = useRef(0);

  const characters = profile?.characters ?? {};
  const counts: Partial<Record<CharacterId, number>> = {};
  for (const id of picks) counts[id] = (counts[id] ?? 0) + 1;
  /** The avatar keeps one copy. */
  const usable = (id: CharacterId) => availableCopies(profile, id);
  const grade = picks[0] ? CHARACTER_BY_ID[picks[0]].grade : null;
  const owned = CHARACTERS.filter((c) => (characters[c.id] ?? 0) > 0).sort(
    (a, b) =>
      Number(!!blockedReason(a)) - Number(!!blockedReason(b)) ||
      GRADE_ORDER.indexOf(a.grade) - GRADE_ORDER.indexOf(b.grade),
  );
  const settings = picks[0] ? fusionOf(picks[0]) : undefined;
  const odds = picks[0] ? fusionOdds(picks[0]) : [];
  const targetGrade = odds[0] ? GRADES[odds[0].character.grade] : null;
  const full = picks.length === 2;

  function blockedReason(c: Character) {
    if (!fusionOf(c.id)) return "합성 불가";
    if (usable(c.id) <= 0) return "대표 동물";
    if (grade && c.grade !== grade && !counts[c.id]) return "등급 다름";
    return null;
  }

  function add(id: CharacterId) {
    if (submitting.current) return;
    setPicks((previous) => {
      const current = availablePicks(previous, profile);
      if (
        !fusionOf(id) ||
        (current[0] &&
          CHARACTER_BY_ID[current[0]].grade !== CHARACTER_BY_ID[id].grade)
      )
        return current;
      if (
        current.length < 2 &&
        current.filter((p) => p === id).length < usable(id)
      )
        return [...current, id];
      return current.filter((p) => p !== id);
    });
  }

  async function start() {
    if (!user || !profile || !full || !settings || show || submitting.current)
      return;
    if (profile.coins < settings.coins) {
      Alert.alert(
        "코인이 부족해요",
        `합성하려면 ${settings.coins}코인이 필요해요.`,
      );
      return;
    }
    const key = ++showKey.current;
    submitting.current = true;
    const inputs: [CharacterId, CharacterId] = [picks[0], picks[1]];
    setShow({ key, inputs, result: null });
    try {
      const result = await fuse(user.uid, inputs);
      setShow((s) => (s?.key === key ? { ...s, result } : s));
      setPicks([]);
    } catch (error) {
      setShow(null);
      Alert.alert(
        "합성하지 못했어요",
        error instanceof HomeError
          ? error.message
          : "잠시 후 다시 시도해주세요.",
      );
      setPicks([]);
    } finally {
      submitting.current = false;
    }
  }

  const affordable = !!settings && (profile?.coins ?? 0) >= settings.coins;
  const disabled = !user || !full || !settings || !affordable || !!show;
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
      >
        <View style={[styles.machine, { backgroundColor: colors.surface }]}>
          {[0, 1].map((i) => {
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
                  styles.slot,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                  },
                ]}
              >
                {id ? (
                  <Image
                    source={CHARACTER_BY_ID[id].thumb}
                    style={styles.slotImage}
                    contentFit="contain"
                  />
                ) : (
                  <Icon name={ICONS.plus} size={22} color={colors.secondary} />
                )}
              </Pressable>
            );
          })}
          <Text style={[styles.arrow, { color: colors.secondary }]}>→</Text>
          <View
            style={[
              styles.slot,
              styles.result,
              {
                borderColor: targetGrade?.color ?? colors.border,
                backgroundColor: colors.background,
              },
            ]}
          >
            <Text
              style={[
                styles.question,
                { color: targetGrade?.color ?? colors.secondary },
              ]}
            >
              ?
            </Text>
          </View>
        </View>

        <View style={[styles.info, { borderColor: colors.border }]}>
          <View style={styles.infoHeader}>
            <Text style={[styles.infoTitle, { color: colors.text }]}>
              {settings && targetGrade ? (
                <>
                  <Text style={{ color: targetGrade.color }}>
                    {targetGrade.label}
                  </Text>{" "}
                  동물 중 1마리
                </>
              ) : (
                "나올 수 있는 동물"
              )}
            </Text>
            <OddsButton
              title="합성 확률"
              rows={[
                ...rowsByCollection(odds),
                ...(settings && settings.success < 1
                  ? [
                      {
                        key: "fail",
                        label: "실패",
                        chance: 1 - settings.success,
                      },
                    ]
                  : []),
              ]}
              notes={fusionNotes}
            />
          </View>
          {settings ? (
            <>
              <Outcomes
                characters={odds.map((o) => o.character)}
                owned={characters}
              />
              <Text style={[styles.infoText, { color: colors.secondary }]}>
                {settings.coins}코인
                {settings.success < 1
                  ? " · 실패하면 넣은 동물과 코인이 사라져요"
                  : ""}
              </Text>
            </>
          ) : (
            <Text style={[styles.infoText, { color: colors.secondary }]}>
              같은 등급의 동물 2마리를 넣으면 한 등급 위의 동물 1마리가 랜덤으로
              나와요. 다른 동물끼리도 되고, 넣은 동물은 사라져요.
            </Text>
          )}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          내 동물
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
          disabled={disabled}
          onPress={start}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: disabled ? colors.border : colors.primary },
            pressed && styles.pressed,
          ]}
        >
          <Text
            style={[
              styles.buttonLabel,
              disabled && { color: colors.secondary },
            ]}
          >
            {full && settings
              ? affordable
                ? `합성하기 · ${settings.coins}코인`
                : `${settings.coins - (profile?.coins ?? 0)}코인 부족해요`
              : `동물 ${2 - picks.length}마리를 골라주세요`}
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
            kind="fuse"
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
    gap: 16,
  },
  machine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    padding: 16,
    gap: 10,
  },
  slot: {
    width: 76,
    height: 88,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  slotImage: {
    width: 62,
    height: 62,
  },
  arrow: {
    fontSize: 22,
    fontWeight: "800",
  },
  result: {
    borderWidth: 2,
  },
  question: {
    fontSize: 32,
    fontWeight: "900",
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
    opacity: 0.7,
  },
});
