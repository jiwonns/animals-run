import { Image } from "expo-image";
import { memo, useCallback, useLayoutEffect, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { GradeBadge } from "@/components/grade-badge";
import type { Character, CharacterId } from "@/constants/characters";
import { useColors } from "@/hooks/use-colors";
import { useGridCellWidth } from "@/hooks/use-grid-cell-width";

export const PICK_PADDING = 20;
const COLUMNS = 4;
const GAP = 10;

/**
 * Owned characters to pick from. A cell shows how many copies are picked (or owned), or why it can't be
 * picked; blocked cells are greyed out and ignore taps.
 */
export function PickGrid({
  items,
  owned,
  picked,
  blockedReason,
  onPress,
}: {
  items: Character[];
  owned: Partial<Record<CharacterId, number>>;
  picked: Partial<Record<CharacterId, number>>;
  blockedReason: (character: Character) => string | null;
  onPress: (id: CharacterId) => void;
}) {
  const cellWidth = useGridCellWidth(COLUMNS, PICK_PADDING, GAP);
  const latest = useRef(onPress);
  useLayoutEffect(() => {
    latest.current = onPress;
  });
  // Stable across renders so cells whose own props didn't change skip re-rendering.
  const press = useCallback((id: CharacterId) => latest.current(id), []);

  return (
    <View style={styles.grid}>
      {items.map((character) => (
        <PickCell
          key={character.id}
          character={character}
          width={cellWidth}
          count={picked[character.id] ?? 0}
          have={owned[character.id] ?? 0}
          blocked={blockedReason(character)}
          onPress={press}
        />
      ))}
    </View>
  );
}

const PickCell = memo(function PickCell({
  character,
  width,
  count,
  have,
  blocked,
  onPress,
}: {
  character: Character;
  width: number;
  count: number;
  have: number;
  blocked: string | null;
  onPress: (id: CharacterId) => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        blocked ? `${character.name}, ${blocked}` : character.name
      }
      accessibilityState={{ selected: count > 0, disabled: !!blocked }}
      disabled={!!blocked}
      onPress={() => onPress(character.id)}
      style={({ pressed }) => [
        styles.cell,
        {
          width,
          height: width / 0.8,
          backgroundColor: colors.surface,
          borderColor: count > 0 ? colors.primary : "transparent",
        },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.body, blocked && styles.blocked]}>
        <Image
          source={character.thumb}
          style={styles.image}
          contentFit="contain"
        />
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
          {character.name}
        </Text>
        <View style={styles.badge}>
          <GradeBadge grade={character.grade} />
        </View>
      </View>
      {blocked ? (
        <View style={[styles.tag, { backgroundColor: colors.background }]}>
          <Text style={[styles.tagLabel, { color: colors.secondary }]}>
            {blocked}
          </Text>
        </View>
      ) : count > 0 ? (
        <View style={[styles.count, { backgroundColor: colors.primary }]}>
          <Text style={styles.countLabel}>
            {count}/{have}
          </Text>
        </View>
      ) : (
        <Text style={[styles.have, { color: colors.secondary }]}>×{have}</Text>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GAP,
  },
  cell: {
    borderRadius: 14,
    borderWidth: 2,
    alignItems: "center",
  },
  body: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
  },
  blocked: {
    opacity: 0.35,
  },
  image: {
    width: "78%",
    aspectRatio: 1,
  },
  name: {
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },
  badge: {
    position: "absolute",
    top: 4,
    left: 4,
    transform: [{ scale: 0.8 }],
  },
  tag: {
    position: "absolute",
    top: 4,
    right: 4,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  tagLabel: {
    fontSize: 10,
    fontWeight: "800",
  },
  have: {
    position: "absolute",
    top: 5,
    right: 7,
    fontSize: 10,
    fontWeight: "700",
  },
  count: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  countLabel: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "900",
  },
  pressed: {
    opacity: 0.7,
  },
});
