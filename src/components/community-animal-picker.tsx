import { FlatList } from '@/components/refreshable';
import { Image } from '@/components/gacha-image';
import { useMemo, useState } from "react";
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from "react-native-safe-area-context";
import {
  CHARACTERS,
  GRADES,
  GRADE_ORDER,
  type CharacterId,
  type Grade,
} from "@/constants/characters";
import { useColors } from "@/hooks/use-colors";
import { useGridCellWidth } from "@/hooks/use-grid-cell-width";
import { useSession } from "@/providers/session-provider";

export function CommunityAnimalPicker({
  selected,
  maximum,
  onDone,
  onClose,
}: {
  selected: CharacterId[];
  maximum: number;
  onDone: (ids: CharacterId[]) => void;
  onClose: () => void;
}) {
  const c = useColors();
  const { profile } = useSession();
  const [draft, setDraft] = useState(selected);
  const [grade, setGrade] = useState<Grade | null>(null);
  const [search, setSearch] = useState("");
  const width = useGridCellWidth(4, 20, 8);
  const owned = useMemo(
    () => CHARACTERS.filter((a) => (profile?.characters[a.id] ?? 0) > 0),
    [profile?.characters],
  );
  const shown = owned.filter(
    (a) =>
      (!grade || a.grade === grade) &&
      (!search.trim() ||
        a.name.includes(search.trim()) ||
        GRADES[a.grade].label.includes(search.trim())),
  );
  const current = draft.filter((id) => (profile?.characters[id] ?? 0) > 0);
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
        <View style={{ padding: 20, gap: 15 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ gap: 5 }}>
              <Text style={{ color: c.text, fontSize: 23, fontWeight: "900" }}>
                동물 고르기
              </Text>
              <Text style={{ color: c.secondary, fontSize: 12 }}>
                {owned.length}종 보유 · 최대 {maximum}마리 선택
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              style={{ padding: 12 }}
            >
              <Text style={{ color: c.secondary }}>닫기</Text>
            </Pressable>
          </View>
          <TextInput
            accessibilityLabel="동물 이름 검색"
            placeholder="동물 이름 또는 등급 검색"
            placeholderTextColor={c.secondary}
            value={search}
            onChangeText={setSearch}
            style={{
              backgroundColor: c.surface,
              borderRadius: 17,
              padding: 14,
              color: c.text,
              fontSize: 15,
            }}
          />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
            {[null, ...GRADE_ORDER].map((g) => (
              <Pressable
                key={g ?? "all"}
                accessibilityRole="tab"
                accessibilityState={{ selected: grade === g }}
                onPress={() => setGrade(g)}
                style={{
                  paddingVertical: 9,
                  paddingHorizontal: 13,
                  backgroundColor: grade === g ? c.text : c.surface,
                  borderRadius: 12,
                }}
              >
                <Text
                  style={{
                    color:
                      grade === g
                        ? c.background
                        : g
                          ? GRADES[g].color
                          : c.secondary,
                    fontSize: 12,
                    fontWeight: "700",
                  }}
                >
                  {g ? GRADES[g].label : "전체"}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        <FlatList
          data={shown}
          numColumns={4}
          keyExtractor={(a) => a.id}
          extraData={current.join(",")}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: 20,
            gap: 8,
          }}
          columnWrapperStyle={{ gap: 8 }}
          initialNumToRender={20}
          windowSize={5}
          renderItem={({ item }) => {
            const index = current.indexOf(item.id);
            const active = index >= 0;
            const disabled = !active && current.length >= maximum;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${item.name} ${active ? "선택됨" : "선택"}`}
                accessibilityState={{ selected: active, disabled }}
                disabled={disabled}
                onPress={() =>
                  setDraft((previous) => {
                    const valid = previous.filter(
                      (id) => (profile?.characters[id] ?? 0) > 0,
                    );
                    return valid.includes(item.id)
                      ? valid.filter((id) => id !== item.id)
                      : valid.length < maximum
                        ? [...valid, item.id]
                        : valid;
                  })
                }
                style={{
                  width,
                  borderRadius: 17,
                  borderWidth: 2,
                  borderColor: active ? c.primary : "transparent",
                  backgroundColor: active ? "#FF5A1F12" : c.surface,
                  padding: 6,
                  alignItems: "center",
                  gap: 5,
                  opacity: disabled ? 0.4 : 1,
                }}
              >
                <Image
                  source={item.thumb}
                  contentFit="contain"
                  style={{ width: "100%", aspectRatio: 1 }}
                />
                <Text
                  numberOfLines={1}
                  style={{ color: c.text, fontSize: 11, fontWeight: "700" }}
                >
                  {item.name}
                </Text>
                <Text
                  style={{
                    color: active ? c.primary : GRADES[item.grade].color,
                    fontSize: 10,
                    fontWeight: "700",
                  }}
                >
                  {active ? `${index + 1}번째 선택` : GRADES[item.grade].label}
                </Text>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <Text
              style={{ color: c.secondary, textAlign: "center", padding: 30 }}
            >
              {owned.length
                ? "검색 결과가 없어요."
                : "동물을 뽑으면 여기서 선택할 수 있어요."}
            </Text>
          }
        />
        <View
          style={{
            padding: 20,
            gap: 12,
            borderTopWidth: 1,
            borderColor: c.border,
          }}
        >
          <View
            style={{ flexDirection: "row", justifyContent: "space-between" }}
          >
            <Text style={{ color: c.text, fontWeight: "800" }}>
              {current.length} / {maximum}마리 선택
            </Text>
            <Pressable onPress={() => setDraft([])}>
              <Text style={{ color: c.secondary }}>선택 해제</Text>
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => onDone(current)}
            style={{
              backgroundColor: c.primary,
              padding: 17,
              borderRadius: 18,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>
              {current.length
                ? `${current.length}마리 선택 완료`
                : "선택 없이 돌아가기"}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
