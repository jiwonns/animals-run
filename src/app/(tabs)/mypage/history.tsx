import { FlatList } from '@/components/refreshable';
import { useCatalog } from '@/providers/catalog-provider';
import { Image } from '@/components/gacha-image';
import { orderBy, query } from 'firebase/firestore';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFirestorePage } from '@/hooks/use-firestore-page';

import { RunningLoader } from '@/components/running-loader';
import { TICKET_COLOR } from '@/components/ticket-badge';
import { BANNERS } from '@/constants/banners';
import { CHARACTER_BY_ID, GRADES } from '@/constants/characters';
import { useColors } from '@/hooks/use-colors';
import { drawLogsRef, type DrawLog } from '@/lib/profile';
import { useSession } from '@/providers/session-provider';


type Entry = DrawLog & { id: string };

export default function HistoryScreen() {
  useCatalog();
  const colors = useColors();
  const { user } = useSession();
  const uid = user?.uid;
  const source = useMemo(()=>uid?query(drawLogsRef(uid),orderBy('createdAt','desc')):null,[uid]);
  const page = useFirestorePage(source,uid??'');
  const list = page.docs.map(d=>({id:d.id,...d.data() as DrawLog}));

  if (page.failed && !list.length) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.failed, { color: colors.secondary }]}>
          뽑기 기록을 불러오지 못했어요.
        </Text>
        <Pressable onPress={page.refresh} accessibilityRole="button" style={{minHeight:44,justifyContent:'center'}}><Text style={{color:colors.primary}}>다시 시도</Text></Pressable>
      </View>
    );
  }

  if (page.loading && !list.length) {
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
      onEndReached={page.loadMore}
      onEndReachedThreshold={0.4}
      initialNumToRender={8}
      maxToRenderPerBatch={8}
      windowSize={5}
      onRefresh={page.refresh}
      refreshing={page.loading && !list.length}
      keyExtractor={(entry) => entry.id}
      ListEmptyComponent={
        <Text style={[styles.empty, { color: colors.secondary }]}>아직 뽑기 기록이 없어요.</Text>
      }
      ListFooterComponent={
        page.failed ? <Pressable onPress={page.loadMore} accessibilityRole="button" style={{minHeight:48,justifyContent:'center'}}><Text style={{color:colors.primary,textAlign:'center'}}>불러오지 못했어요 · 다시 시도</Text></Pressable> : page.loading ? <Text style={[styles.empty,{color:colors.secondary}]}>더 불러오는 중…</Text> : undefined
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
