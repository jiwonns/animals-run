import { FlatList } from '@/components/refreshable';
import { useCatalog } from '@/providers/catalog-provider';
import { router, useLocalSearchParams } from "expo-router";
import { memo, useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MedalCabinet } from '@/components/medal-cabinet';
import { SafeAreaView } from "react-native-safe-area-context";

import { CharacterCard } from "@/components/character-card";
import { CoinBadge, CoinToken } from "@/components/coin-badge";
import { TicketToken } from "@/components/ticket-badge";
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
type Section = '동물' | '훈장' | '기타';

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

const TABS: Section[] = ['동물', '훈장', '기타'];

function sectionFromParam(value?: string): Section {
  return value === 'medals' ? '훈장' : value === 'other' ? '기타' : '동물';
}

export default function CollectionScreen() {
  const { version } = useCatalog();
  const colors = useColors();
  useConfirmExit();
  const cellWidth = useGridCellWidth(COLUMNS, PADDING, GAP);
  const { user, profile } = useSession();
  const { section: sectionParam } = useLocalSearchParams<{ section?: string }>();
  const routeSection = sectionFromParam(sectionParam);
  const [picked, setPicked] = useState<Section | null>(null);
  const [fromParam, setFromParam] = useState(sectionParam);
  if (sectionParam !== fromParam) {
    setFromParam(sectionParam);
    setPicked(null);
  }
  const section = picked ?? routeSection;
  const [visited, setVisited] = useState({ medals: false, other: false });
  const opened = {
    medals: visited.medals || section === '훈장',
    other: visited.other || section === '기타',
  };
  const [grade, setGrade] = useState<Grade | null>(null);
  const [species, setSpecies] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("grade");
  const [selling, setSelling] = useState(false);
  const [sellTarget, setSellTarget] = useState<Character | null>(null);

  const speciesOptions = useMemo(() => {
    void version;
    return [{ value: null, label: '모든 동물' }, ...speciesGroups().map((s) => ({ value: s.id, label: s.name }))];
  }, [version]);
  const owned = profile?.characters ?? EMPTY_OWNED;
  const mine = useMemo(() => {
    void version;
    return CHARACTERS.filter((c) => (owned[c.id] ?? 0) > 0);
  }, [owned, version]);
  const shown = useMemo(() => {
    const rows = mine
      .filter((c) => species === null || speciesOf(c) === species)
      .filter((c) => grade === null || drawGrade(c.grade) === grade)
      .map((c, index) => ({ character: c, index }));
    rows.sort((a, b) => {
      if (sort === "count") {
        return (owned[b.character.id] ?? 0) - (owned[a.character.id] ?? 0) || a.index - b.index;
      }
      if (sort === "name") return a.character.name.localeCompare(b.character.name, "ko");
      return (
        speciesOf(a.character).localeCompare(speciesOf(b.character), 'ko') ||
        GRADE_ORDER.indexOf(a.character.grade) - GRADE_ORDER.indexOf(b.character.grade) ||
        a.index - b.index
      );
    });
    return rows.map(({ character }) => character);
  }, [mine, species, grade, sort, owned]);
  const totalOwned = useMemo(
    () => mine.reduce((sum, ch) => sum + (owned[ch.id] ?? 0), 0),
    [mine, owned],
  );
  const page = useListWindow(shown, `${user?.uid}:${species}:${grade}:${sort}`);

  const openSell = useCallback((character: Character) => setSellTarget(character), []);
  const renderAnimal = useCallback(
    ({ item }: { item: Character }) => (
      <AnimalCell
        character={item}
        width={cellWidth}
        count={owned[item.id] ?? 0}
        selling={selling}
        accent={colors.primary}
        onSell={openSell}
      />
    ),
    [cellWidth, owned, selling, colors.primary, openSell],
  );

  function selectTab(tab: Section) {
    setPicked(tab);
    setSelling(false);
    setVisited((v) => ({
      medals: v.medals || tab === '훈장',
      other: v.other || tab === '기타',
    }));
  }

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
            {' · '}{totalOwned.toLocaleString()}마리
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
        {TABS.map((tab) => (
          <Pressable
            key={tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === section }}
            onPress={() => selectTab(tab)}
            style={{
              flex: 1,
              minHeight: 44,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 14,
              backgroundColor: section === tab ? colors.primary : colors.surface,
            }}
          >
            <Text style={{ color: section === tab ? '#fff' : colors.text, fontWeight: '800' }}>{tab}</Text>
          </Pressable>
        ))}
      </View>

      <View style={section === '동물' ? styles.panel : styles.hidden} collapsable={false}>
        {!profile ? (
          <RunningLoader label="보관함을 여는 중" style={styles.loading} />
        ) : mine.length === 0 ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.secondary }]}>
              아직 뽑은 동물이 없어요
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
                  {GRADE_ORDER.map((g) => (
                    <View key={g} style={{ paddingHorizontal: 9, paddingVertical: 6, borderRadius: 10, backgroundColor: `${GRADES[g].color}16` }}>
                      <Text style={{ color: GRADES[g].color, fontSize: 11, fontWeight: '700' }}>{GRADES[g].label} {SALE_PRICES[g]}코인</Text>
                    </View>
                  ))}
                </View>
                <Text style={{ color: colors.secondary, fontSize: 12 }}>대표 동물 1마리는 남겨둬요.</Text>
              </View>
            )}
            <View style={styles.selectors}>
              <Select label="동물" value={species} options={speciesOptions} onChange={setSpecies}/>
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
              keyExtractor={animalKey}
              renderItem={renderAnimal}
              contentContainerStyle={styles.list}
              columnWrapperStyle={styles.row}
              initialNumToRender={12}
              windowSize={5}
              removeClippedSubviews
              ListEmptyComponent={
                <Text style={[styles.emptyText, { color: colors.secondary }]}>
                  이 등급의 동물이 아직 없어요
                </Text>
              }
            />
          </>
        )}
      </View>

      <View style={section === '훈장' ? styles.panel : styles.hidden} collapsable={false}>
        {opened.medals && user ? <MedalCabinet uid={user.uid} /> : null}
      </View>

      <View style={section === '기타' ? styles.panel : styles.hidden} collapsable={false}>
        {opened.other ? (
          <FlatList
            data={OTHER_ITEMS}
            numColumns={COLUMNS}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ItemCard
                item={item}
                width={cellWidth}
                count={item.id === 'coins' ? profile?.coins ?? 0 : profile?.tickets ?? 0}
              />
            )}
            contentContainerStyle={styles.list}
            columnWrapperStyle={styles.row}
            ListHeaderComponent={
              <Text style={[styles.emptyText, { color: colors.secondary, marginTop: 0, marginBottom: 4 }]}>
                걸음과 업적으로 모은 보상을 보관해요.
              </Text>
            }
          />
        ) : null}
      </View>
      {sellTarget && (
        <SellSheet character={sellTarget} onClose={() => setSellTarget(null)} />
      )}
    </SafeAreaView>
  );
}

const EMPTY_OWNED: Partial<Record<string, number>> = {};
const animalKey = (character: Character) => character.id;

type OtherItem = { id: 'coins' | 'tickets'; name: string; accent: string };
const OTHER_ITEMS: OtherItem[] = [
  { id: 'coins', name: '코인', accent: '#D99818' },
  { id: 'tickets', name: '뽑기권', accent: '#8B5CF6' },
];

const ItemCard = memo(function ItemCard({
  item,
  width,
  count,
}: {
  item: OtherItem;
  width: number;
  count: number;
}) {
  const colors = useColors();
  return (
    <View
      accessibilityLabel={`${item.name} ${count.toLocaleString()}${item.id === 'tickets' ? '장' : '개'}`}
      style={[
        styles.itemCell,
        { width, backgroundColor: colors.surface, borderColor: `${item.accent}66` },
      ]}
    >
      <View style={styles.itemArt}>
        {item.id === 'coins' ? (
          <CoinToken size={Math.round(width * 0.46)} />
        ) : (
          <TicketToken size={Math.round(width * 0.52)} cutoutColor={colors.surface} />
        )}
      </View>
      <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={1}>
        {item.name}
      </Text>
      <View style={[styles.countBadge, { backgroundColor: colors.primary }]}>
        <Text style={styles.countLabel}>×{count.toLocaleString()}</Text>
      </View>
    </View>
  );
});

const AnimalCell = memo(function AnimalCell({
  character,
  width,
  count,
  selling,
  accent,
  onSell,
}: {
  character: Character;
  width: number;
  count: number;
  selling: boolean;
  accent: string;
  onSell: (character: Character) => void;
}) {
  const card = <CharacterCard character={character} width={width} count={count} />;
  if (!selling) return card;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${character.name} 판매, 1마리당 ${SALE_PRICES[character.grade]}코인`}
      onPress={() => onSell(character)}
      style={{ width, gap: 5 }}
    >
      {card}
      <Text style={{ color: accent, textAlign: "center", fontWeight: "800", fontSize: 12 }}>
        {SALE_PRICES[character.grade]}코인 / 마리
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  panel: {
    flex: 1,
  },
  hidden: {
    display: 'none',
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
  itemCell: {
    aspectRatio: 0.85,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderWidth: 1.5,
  },
  itemArt: {
    width: '80%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemName: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    marginTop: 4,
  },
  countBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  countLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
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
