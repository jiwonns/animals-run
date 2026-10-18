import { Image } from 'expo-image';
import { limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { RunningLoader } from '@/components/running-loader';
import { TICKET_COLOR } from '@/components/ticket-badge';
import { BANNERS } from '@/constants/banners';
import { CHARACTER_BY_ID, GRADES } from '@/constants/characters';
import { useColors } from '@/hooks/use-colors';
import { drawLogsRef, type DrawLog } from '@/lib/profile';
import { useSession } from '@/providers/session-provider';

const PAGE_SIZE = 50;

type Entry = DrawLog & { id: string };

export default function HistoryScreen() {
  const colors = useColors();
  const { user } = useSession();
  const uid = user?.uid;
  const [entries, setEntries] = useState<{ uid: string; list: Entry[] | null } | null>(null);
  const current = entries && entries.uid === uid ? entries : null;
  const list = current?.list;

  useEffect(() => {
    if (!uid) return;
    const recent = query(drawLogsRef(uid), orderBy('createdAt', 'desc'), limit(PAGE_SIZE));
    return onSnapshot(
      recent,
      (snapshot) => setEntries({ uid, list: snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as DrawLog) })) }),
      () => setEntries({ uid, list: null }),
    );
  }, [uid]);

  if (current && !list) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.failed, { color: colors.secondary }]}>
          뽑기 기록을 불러오지 못했어요.{'\n'}Firebase 콘솔에 최신 firestore.rules가 게시됐는지 확인해주세요.
        </Text>
      </View>
    );
  }

  if (!list) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <RunningLoader label="기록을 불러오는 중" />
      </View>
    );
  }

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      data={list}
      keyExtractor={(entry) => entry.id}
      ListEmptyComponent={
        <Text style={[styles.empty, { color: colors.secondary }]}>아직 뽑기 기록이 없어요.</Text>
      }
      ListFooterComponent={
        list.length === PAGE_SIZE ? (
          <Text style={[styles.empty, { color: colors.secondary }]}>최근 {PAGE_SIZE}번까지 보여드려요.</Text>
        ) : undefined
      }
      renderItem={({ item }) => <HistoryRow entry={item} />}
    />
  );
}

function HistoryRow({ entry }: { entry: Entry }) {
  const colors = useColors();
  const banner = BANNERS.find((b) => b.id === entry.banner);
  const date = entry.createdAt?.toDate();
  const paid = entry.tickets > 0 ? `뽑기권 ${entry.tickets}장` : `${entry.coins}코인`;
  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>
          {banner?.title ?? entry.banner} · {entry.picks.length}회
        </Text>
        <Text style={[styles.meta, { color: entry.tickets > 0 ? TICKET_COLOR : colors.secondary }]}>{paid}</Text>
      </View>
      {date && (
        <Text style={[styles.meta, { color: colors.secondary }]}>
          {date.toLocaleDateString('ko-KR')} {date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
        </Text>
      )}
      <View style={styles.picks}>
        {entry.picks.map((id, index) => {
          const character = CHARACTER_BY_ID[id];
          if (!character) return null;
          return (
            <View
              key={index}
              accessibilityLabel={character.name}
              style={[styles.pick, { borderColor: GRADES[character.grade].color }]}>
              <Image source={character.thumb} style={styles.pickImage} contentFit="contain" />
            </View>
          );
        })}
      </View>
      {entry.rewards.length > 0 && (
        <Text style={[styles.meta, { color: TICKET_COLOR }]} numberOfLines={2}>
          업적: {entry.rewards.map((r) => r.label).join(', ')}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 20,
    gap: 12,
  },
  failed: {
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 20,
    paddingHorizontal: 32,
  },
  empty: {
    textAlign: 'center',
    marginTop: 24,
    fontSize: 14,
  },
  card: {
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  meta: {
    fontSize: 12,
  },
  picks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pick: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickImage: {
    width: 32,
    height: 32,
  },
});
