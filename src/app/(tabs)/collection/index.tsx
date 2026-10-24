import { FlatList, ScrollView } from '@/components/refreshable';
import { useCatalog } from '@/providers/catalog-provider';
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MedalCabinet } from '@/components/medal-cabinet';
import { SafeAreaView } from "react-native-safe-area-context";

import { CharacterCard } from "@/components/character-card";
import { CoinBadge } from "@/components/coin-badge";
import { SellSheet } from "@/components/sell-sheet";
import { RunningLoader } from "@/components/running-loader";
import { Select, type SelectOption } from "@/components/select";
import {
  CHARACTERS,
  GRADE_ORDER,
  GRADES,
  type Grade,
  type Character,
  speciesOf,
  speciesGroups,
} from "@/constants/characters";
import { SALE_PRICES } from "@/lib/inventory";
import { useColors } from "@/hooks/use-colors";
import { useConfirmExit } from "@/hooks/use-confirm-exit";
import { useGridCellWidth } from "@/hooks/use-grid-cell-width";
import { useListWindow } from '@/hooks/use-list-window';
import { useSession } from "@/providers/session-provider";
import { DRAW_GRADES, drawGrade } from '../../../../shared/gacha/draw-pools';

const COLUMNS = 3;
const PADDING = 20;
const GAP = 12;

type Sort = "grade" | "count" | "name";

const SORTS: SelectOption<Sort>[] = [
  { value: "grade", label: "등급순" },
  { value: "count", label: "많이 가진 순" },
  { value: "name", label: "이름순" },
];

const GRADE_FILTERS: SelectOption<Grade | null>[] = [
  { value: null, label: "전체" },
  ...DRAW_GRADES.map((g) => ({
    value: g,
    label: GRADES[g].label,
    color: GRADES[g].color,
  })),
];

export default function CollectionScreen() {
  useCatalog();
  const colors = useColors();
  useConfirmExit();
  const cellWidth = useGridCellWidth(COLUMNS, PADDING, GAP);
  const { user, profile } = useSession();
  const { section: sectionParam } = useLocalSearchParams<{ section?: string }>();
  const section = sectionParam === 'medals' ? '훈장' : sectionParam === 'other' ? '기타' : '동물';
  function setSection(tab: '동물' | '훈장' | '기타') {
    router.setParams({ section: tab === '훈장' ? 'medals' : tab === '기타' ? 'other' : 'animals' });
  }
  const [grade, setGrade] = useState<Grade | null>(null);
  const [species, setSpecies] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("grade");
  const [selling, setSelling] = useState(false);
  const [sellTarget, setSellTarget] = useState<Character | null>(null);

  const owned = profile?.characters ?? {};
  const countOf = (id: keyof typeof owned) => owned[id] ?? 0;
  const mine = CHARACTERS.filter((c) => countOf(c.id) > 0);

  const shown = mine
    .filter(c => species === null || speciesOf(c) === species)
    .filter((c) => grade === null || drawGrade(c.grade) === grade)
    .map((c, index) => ({ character: c, index }))
    .sort((a, b) => {
      if (sort === "count")
        return (
          countOf(b.character.id) - countOf(a.character.id) || a.index - b.index
        );
      if (sort === "name")
        return a.character.name.localeCompare(b.character.name, "ko");
      return (
        speciesOf(a.character).localeCompare(speciesOf(b.character), 'ko') ||
        GRADE_ORDER.indexOf(a.character.grade) -
          GRADE_ORDER.indexOf(b.character.grade) || a.index - b.index
      );
    })
    .map(({ character }) => character);

  const page = useListWindow(shown, `${user?.uid}:${species}:${grade}:${sort}`);
  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>보관함</Text>
          <Text style={[styles.summary, { color: colors.secondary }]}>
            보유 동물 {mine.length}종
            {' · '}{mine.reduce((sum,ch)=>sum+countOf(ch.id),0).toLocaleString()}마리
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {section === '동물' && (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: selling }}
            onPress={() => setSelling((v) => !v)}
            style={[
              styles.dexButton,
              { backgroundColor: selling ? colors.primary : colors.surface },
            ]}
          >
            <Text
              style={[
                styles.dexLabel,
                { color: selling ? "#fff" : colors.text },
              ]}
            >
              {selling ? "완료" : "판매"}
            </Text>
          </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/collection/dex")}
            style={({ pressed }) => [
              styles.dexButton,
              { backgroundColor: colors.surface },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.dexLabel, { color: colors.text }]}>도감</Text>
          </Pressable>
        </View>
      </View>

      <View style={{ flexDirection: 'row', paddingHorizontal: 20, paddingBottom: 12, gap: 8 }}>
        {(['동물', '훈장', '기타'] as const).map(tab => <Pressable key={tab} accessibilityRole="tab" accessibilityState={{ selected: tab === section }} onPress={() => { setSection(tab); setSelling(false); }} style={{ flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: section === tab ? colors.primary : colors.surface }}><Text style={{ color: section === tab ? '#fff' : colors.text, fontWeight: '800' }}>{tab}</Text></Pressable>)}
      </View>
      {section === '훈장' && user ? <MedalCabinet uid={user.uid} /> : section === '기타' ? <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>소지품</Text>
        <View style={{ padding: 20, gap: 12, borderRadius: 16, backgroundColor: colors.surface }}><Text style={{ color: colors.text }}>🪙 코인 · {(profile?.coins ?? 0).toLocaleString()}</Text><Text style={{ color: colors.text }}>🎟 뽑기권 · {(profile?.tickets ?? 0).toLocaleString()}장</Text><Text style={{ color: colors.secondary }}>걸음과 업적으로 모은 보상을 보관해요.</Text></View>
      </ScrollView> : !profile ? (
        <RunningLoader label="보관함을 여는 중" style={styles.loading} />
      ) : mine.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: colors.secondary }]}>
            아직 뽑은 캐릭터가 없어요
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.navigate("/gacha")}
            style={({ pressed }) => [
              styles.emptyButton,
              { backgroundColor: colors.primary },
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.emptyButtonLabel}>뽑으러 가기</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {selling && (
            <View
              style={{ paddingHorizontal: PADDING, paddingBottom: 14, gap: 10 }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text style={{ color: colors.primary, fontWeight: "800" }}>
                  판매할 동물을 눌러주세요
                </Text>
                <CoinBadge coins={profile.coins} />
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {GRADE_ORDER.map(g => <View key={g} style={{ paddingHorizontal: 9, paddingVertical: 6, borderRadius: 10, backgroundColor: `${GRADES[g].color}16` }}><Text style={{ color: GRADES[g].color, fontSize: 11, fontWeight: '700' }}>{GRADES[g].label} {SALE_PRICES[g]}코인</Text></View>)}
              </View>
              <Text style={{ color: colors.secondary, fontSize: 12 }}>대표 동물 1마리는 남겨둬요.</Text>
            </View>
          )}
          <View style={styles.selectors}>
            <Select label="동물" value={species} options={[{value:null,label:'모든 동물'},...speciesGroups().map(s=>({value:s.id,label:s.name}))]} onChange={setSpecies}/>
            <Select
              label="등급"
              value={grade}
              options={GRADE_FILTERS}
              onChange={setGrade}
            />
            <Select
              label="정렬"
              value={sort}
              options={SORTS}
              onChange={setSort}
            />
          </View>

          <FlatList
            data={page.data}
            onEndReached={page.loadMore}
            onEndReachedThreshold={0.4}
            maxToRenderPerBatch={12}
            numColumns={COLUMNS}
            keyExtractor={(character) => character.id}
            renderItem={({ item }) =>
              selling ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${item.name} 판매, 1마리당 ${SALE_PRICES[item.grade]}코인`}
                  onPress={() => setSellTarget(item)}
                  style={{ width: cellWidth, gap: 5 }}
                >
                  <CharacterCard
                    character={item}
                    width={cellWidth}
                    count={countOf(item.id)}
                  />
                  <Text
                    style={{
                      color: colors.primary,
                      textAlign: "center",
                      fontWeight: "800",
                      fontSize: 12,
                    }}
                  >
                    {SALE_PRICES[item.grade]}코인 / 마리
                  </Text>
                </Pressable>
              ) : (
                <CharacterCard
                  character={item}
                  width={cellWidth}
                  count={countOf(item.id)}
                />
              )
            }
            contentContainerStyle={styles.list}
            columnWrapperStyle={styles.row}
            initialNumToRender={12}
            windowSize={5}
            ListEmptyComponent={
              <Text style={[styles.emptyText, { color: colors.secondary }]}>
                이 등급의 캐릭터가 아직 없어요
              </Text>
            }
          />
        </>
      )}
      {sellTarget && (
        <SellSheet character={sellTarget} onClose={() => setSellTarget(null)} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    marginBottom: 12,
    paddingHorizontal: PADDING,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
  },
  summary: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 2,
  },
  dexButton: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  dexLabel: {
    fontSize: 15,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.7,
  },
  loading: {
    marginTop: 48,
  },
  selectors: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: PADDING,
    paddingBottom: 12,
  },
  list: {
    paddingHorizontal: PADDING,
    paddingBottom: 24,
    gap: GAP,
  },
  row: {
    gap: GAP,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 24,
  },
  emptyButton: {
    borderRadius: 22,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  emptyButtonLabel: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
