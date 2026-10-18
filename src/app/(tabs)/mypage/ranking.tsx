import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AvatarFace } from '@/components/avatar-face';
import { RunningLoader } from '@/components/running-loader';
import { Select, type SelectOption } from '@/components/select';
import { GRADES, GRADE_ORDER, type Grade } from '@/constants/characters';
import { useColors } from '@/hooks/use-colors';
import { displayName } from '@/lib/profile';
import { fetchRankings, ownedByGrade, type RankingCount, type RankingEntry } from '@/lib/ranking';
import { useSession } from '@/providers/session-provider';

type Board = 'steps' | RankingCount | 'grade';
type Row = { uid: string; username: string; avatar: RankingEntry['avatar']; value: number; rank: number };

const SHOWN = 100;
const MEDALS = ['#F5B300', '#A3A3A3', '#C67C3E'];

const BOARDS: { id: Board; label: string; caption: string; unit: string }[] = [
  { id: 'steps', label: '걸음', caption: '지금까지 걸은 걸음 수', unit: '걸음' },
  { id: 'hatchCount', label: '부화', caption: '알을 부화시킨 횟수', unit: '회' },
  { id: 'evolveCount', label: '진화', caption: '동물을 진화시킨 횟수', unit: '회' },
  { id: 'fuseCount', label: '합성', caption: '동물을 합성한 횟수', unit: '회' },
  { id: 'recycleCount', label: '재활용', caption: '동물을 재활용한 횟수', unit: '회' },
  { id: 'grade', label: '등급별 보유', caption: '가지고 있는 동물 수 (중복 포함)', unit: '마리' },
];

const GRADE_OPTIONS: SelectOption<Grade>[] = GRADE_ORDER.map((g) => ({
  value: g,
  label: GRADES[g].label,
  color: GRADES[g].color,
}));

/** Highest first; tied players share a rank (1, 2, 2, 4). */
function rank(entries: (RankingEntry & { uid: string })[], board: Board, grade: Grade): Row[] {
  const rows = entries
    .map((e) => ({
      uid: e.uid,
      username: displayName(e),
      avatar: e.avatar,
      value: board === 'grade' ? ownedByGrade(e.characters)[grade] : e[board],
      rank: 0,
    }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);
  rows.forEach((row, i) => {
    row.rank = i > 0 && row.value === rows[i - 1].value ? rows[i - 1].rank : i + 1;
  });
  return rows;
}

export default function RankingScreen() {
  const colors = useColors();
  const { user } = useSession();
  const [board, setBoard] = useState<Board>('steps');
  const [grade, setGrade] = useState<Grade>(GRADE_ORDER[0]);
  const [entries, setEntries] = useState<(RankingEntry & { uid: string })[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setEntries(await fetchRankings());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const rows = entries ? rank(entries, board, grade) : [];
  const mine = rows.find((r) => r.uid === user?.uid);
  const current = BOARDS.find((b) => b.id === board)!;
  const unit = current.unit;

  function renderRow(row: Row, pinned = false) {
    const me = row.uid === user?.uid;
    const medal = MEDALS[row.rank - 1];
    return (
      <View
        style={[
          styles.row,
          { backgroundColor: me ? `${colors.primary}14` : colors.background },
          pinned && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
        ]}>
        <View style={[styles.rank, medal && { backgroundColor: medal }]}>
          <Text style={[styles.rankLabel, { color: medal ? '#fff' : colors.secondary }]}>{row.rank}</Text>
        </View>
        <AvatarFace avatar={row.avatar} size={40} fallback={row.username} />
        <Text style={[styles.name, { color: colors.text }, me && styles.bold]} numberOfLines={1}>
          {row.username}
          {me && <Text style={{ color: colors.primary }}> (나)</Text>}
        </Text>
        <Text style={[styles.value, { color: colors.text }]}>
          {row.value.toLocaleString()}
          <Text style={[styles.unit, { color: colors.secondary }]}> {unit}</Text>
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <FlatList
        data={rows.slice(0, SHOWN)}
        keyExtractor={(row) => row.uid}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
              {BOARDS.map((b) => {
                const active = b.id === board;
                return (
                  <Pressable
                    key={b.id}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    onPress={() => setBoard(b.id)}
                    style={[styles.tab, { backgroundColor: active ? colors.text : colors.surface }]}>
                    <Text style={[styles.tabLabel, { color: active ? colors.background : colors.secondary }]}>
                      {b.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={styles.captionRow}>
              <Text style={[styles.caption, { color: colors.secondary }]}>{current.caption}</Text>
              {board === 'grade' && <Select label="등급" value={grade} options={GRADE_OPTIONS} onChange={setGrade} />}
            </View>
          </View>
        }
        renderItem={({ item }) => renderRow(item)}
        ListEmptyComponent={
          <View style={styles.empty}>
            {entries === null && !failed ? (
              <RunningLoader label="순위를 세는 중" />
            ) : (
              <Text style={[styles.emptyText, { color: colors.secondary }]}>
                {failed ? '랭킹을 불러오지 못했어요. 당겨서 다시 시도해주세요.' : '아직 순위에 오른 사람이 없어요.'}
              </Text>
            )}
          </View>
        }
      />
      {mine && mine.rank > SHOWN && renderRow(mine, true)}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    padding: 16,
    paddingBottom: 8,
    gap: 10,
  },
  tabs: {
    gap: 8,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  captionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 38,
  },
  caption: {
    flex: 1,
    fontSize: 12,
    marginLeft: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  rank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankLabel: {
    fontSize: 14,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  name: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  bold: {
    fontWeight: '800',
  },
  value: {
    fontSize: 15,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  unit: {
    fontSize: 12,
    fontWeight: '600',
  },
  empty: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
});
