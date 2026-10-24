import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AvatarFace } from '@/components/avatar-face';
import { rankEntries, watchRankings, type RankedRow, type RankingEntry } from '@/lib/ranking';

const MEDALS = ['#F5B300', '#A3A3A3', '#C67C3E'];
const TOP = 5;

export function ArenaRankBoard({ uid }: { uid: string }) {
  const [entries, setEntries] = useState<(RankingEntry & { uid: string })[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(
    () =>
      watchRankings(
        (value) => {
          setEntries(value);
          setFailed(false);
        },
        () => setFailed(true),
      ),
    [],
  );

  const rows = entries ? rankEntries(entries, (entry) => entry.arenaWins) : [];
  const top = rows.slice(0, TOP);
  const mine = rows.find((row) => row.uid === uid);
  const showMine = !!mine && mine.rank > top.length;

  return (
    <View style={s.card}>
      <View style={s.head}>
        <Text style={s.title}>결투 랭킹</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="전체 랭킹 보기"
          onPress={() => router.push({ pathname: '/mypage/ranking', params: { board: 'arenaWins' } })}
          hitSlop={8}>
          <Text style={s.link}>전체 보기</Text>
        </Pressable>
      </View>
      {failed ? (
        <Text style={s.hint}>순위를 불러오지 못했어요.</Text>
      ) : entries === null ? (
        <Text style={s.hint}>순위를 세는 중…</Text>
      ) : top.length === 0 ? (
        <Text style={s.hint}>아직 결투 승리가 없어요. 이기면 여기에 올라요.</Text>
      ) : (
        <>
          {top.map((row) => (
            <RankLine key={row.uid} row={row} me={row.uid === uid} />
          ))}
          {showMine && mine ? <RankLine row={mine} me /> : null}
        </>
      )}
    </View>
  );
}

function RankLine({ row, me }: { row: RankedRow; me?: boolean }) {
  const medal = MEDALS[row.rank - 1];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${row.username} 프로필 보기`}
      onPress={() => router.push({ pathname: '/player/[uid]', params: { uid: row.uid } })}
      style={[s.row, me && s.mine]}>
      <View style={[s.rank, medal && { backgroundColor: medal }]}>
        <Text style={[s.rankLabel, { color: medal ? '#fff' : '#878EA9' }]}>{row.rank}</Text>
      </View>
      <AvatarFace avatar={row.avatar} size={32} fallback={row.username} />
      <Text style={s.name} numberOfLines={1}>
        {row.username}
        {me ? <Text style={s.me}> (나)</Text> : null}
      </Text>
      <Text style={s.value}>
        {row.value.toLocaleString()}
        <Text style={s.unit}> 승</Text>
      </Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: '#1A1F32', borderRadius: 18, padding: 14, gap: 8, borderWidth: 1, borderColor: '#323346' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: '#EEEAF5', fontSize: 15, fontWeight: '800' },
  link: { color: '#C7BDD9', fontSize: 11, fontWeight: '700' },
  hint: { color: '#8E97B3', fontSize: 12, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  mine: { backgroundColor: '#C3A26E14', marginHorizontal: -8, paddingHorizontal: 8, borderRadius: 10 },
  rank: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rankLabel: { fontSize: 12, fontWeight: '800', fontVariant: ['tabular-nums'] },
  name: { flex: 1, color: '#E3DFF0', fontSize: 13, fontWeight: '700' },
  me: { color: '#F4D296', fontWeight: '800' },
  value: { color: '#EEE3CE', fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
  unit: { color: '#878EA9', fontSize: 11, fontWeight: '600' },
});
