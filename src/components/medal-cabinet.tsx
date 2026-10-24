import { ScrollView } from '@/components/refreshable';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import { useMedalShowcase } from '@/hooks/use-medal-showcase';
import { PERMANENT_MEDALS } from '@/lib/medals';
import { useSession } from '@/providers/session-provider';
import { MedalClaim } from './medal-claim';
import { EquippedMedal, MedalShowcaseList } from './medal-showcase';
import { MoreButton } from './more-button';
import { PagedListSheet } from './paged-list-sheet';

export function MedalCabinet({ uid }: { uid: string }) {
  const c = useColors();
  const { user, profile } = useSession();
  const showcase = useMedalShowcase(uid);
  const [showAvailable, setShowAvailable] = useState(false);
  const [showLocked, setShowLocked] = useState(false);
  const editable = user?.uid === uid;
  const remaining = showcase.claimed ? PERMANENT_MEDALS.filter(m => !showcase.claimed!.has(m.id)) : [];
  const available = profile ? remaining.filter(m => m.eligible(profile)) : [];
  const locked = profile ? remaining.filter(m => !m.eligible(profile)) : [];
  return <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 36, gap: 20 }}>
    <EquippedMedal showcase={showcase} />
    <MedalShowcaseList showcase={showcase} editable={editable} />
    <Text style={{ color: c.secondary, fontSize: 12, lineHeight: 18 }}>랭킹 훈장은 현재 1위만 보유해요. 새로운 1위가 나오면 훈장이 이동하고, 장착한 프로필에서도 사라져요.</Text>
    {editable && available.length > 0 && <View style={{ gap: 12 }}>
      <Text style={{ color: c.text, fontSize: 19, fontWeight: '800' }}>받을 수 있는 훈장 {available.length}개</Text>
      {available.slice(0, 3).map(m => <MedalClaim key={m.id} medal={m} claimed={showcase.claimed} />)}
      {showAvailable && <PagedListSheet title="받을 수 있는 훈장" data={available} keyExtractor={m => m.id} renderItem={({ item }) => <MedalClaim medal={item} claimed={showcase.claimed} />} onClose={() => setShowAvailable(false)} />}
      {available.length > 3 && <MoreButton expanded={showAvailable} onPress={() => setShowAvailable(v => !v)} remaining={available.length - 3} />}
    </View>}
    {editable && locked.length > 0 && <View style={{ gap: 12 }}>
      {showLocked && <PagedListSheet title="훈장 획득 조건" data={locked} keyExtractor={m => m.id} renderItem={({ item }) => <MedalClaim medal={item} claimed={showcase.claimed} />} onClose={() => setShowLocked(false)} />}
      <MoreButton expanded={showLocked} onPress={() => setShowLocked(v => !v)} remaining={locked.length} label="훈장 획득 조건 보기" />
    </View>}
  </ScrollView>;
}
