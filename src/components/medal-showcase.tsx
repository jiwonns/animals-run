import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import type { MedalShowcase } from '@/hooks/use-medal-showcase';
import { MoreButton } from './more-button';
import { PagedListSheet } from './paged-list-sheet';

export function EquippedMedal({ showcase }: { showcase: MedalShowcase }) {
  const c = useColors();
  const medal = showcase.equipped;
  if (!medal) return null;
  return <View accessibilityLabel={`장착한 훈장: ${medal.name}`} style={{ alignSelf: 'center', maxWidth: '100%', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: `${c.primary}16`, gap: 3 }}>
    <Text style={{ color: c.primary, fontSize: 11, fontWeight: '700', textAlign: 'center' }}>대표 훈장{medal.temporary ? ' · 랭킹 1위' : ''}</Text>
    <Text style={{ color: c.text, fontWeight: '800', textAlign: 'center' }}>{medal.temporary ? '👑' : '🏅'} {medal.name}</Text>
  </View>;
}

export function MedalShowcaseList({ showcase, editable = false }: { showcase: MedalShowcase; editable?: boolean }) {
  const c = useColors();
  const [expanded, setExpanded] = useState(false);
  const { medals, equipped, saving, equip, loading } = showcase;
  const ordered = equipped ? [equipped, ...medals.filter(m => m.id !== equipped.id)] : medals;
  async function choose(id: string | null) {
    try { await equip(id); }
    catch { Alert.alert('훈장을 장착하지 못했어요', '현재 보유한 훈장인지 확인하고 다시 시도해주세요.'); }
  }
  return <View style={{ gap: 12 }}>
    <Text style={{ color: c.text, fontSize: 19, fontWeight: '800' }}>보유 훈장 <Text style={{ color: c.primary }}>{medals.length}개</Text></Text>
    {editable && <Text style={{ color: c.secondary, lineHeight: 20 }}>훈장 하나를 장착하면 내 프로필과 친구에게 보이는 프로필에 대표로 표시돼요.</Text>}
    {showcase.failed || showcase.rankingFailed || showcase.displayFailed ? <Text style={{ color: c.secondary }}>일부 훈장 정보를 불러오지 못했어요. 연결 상태를 확인해주세요.</Text> : loading && <Text style={{ color: c.secondary }}>훈장을 확인하고 있어요…</Text>}
    {!loading && !medals.length && !showcase.failed && <Text style={{ color: c.secondary }}>아직 보유한 훈장이 없어요.</Text>}
    {ordered.slice(0, 6).map(m => {
      const selected = m.id === equipped?.id;
      return <View key={m.id} style={{ padding: 14, borderRadius: 16, borderWidth: selected ? 1 : 0, borderColor: c.primary, backgroundColor: c.surface, gap: 6 }}>
        <Text style={{ color: selected ? c.primary : c.text, fontWeight: '800' }}>{m.temporary ? '👑' : '🏅'} {m.name}{selected ? ' · 장착 중' : ''}</Text>
        <Text numberOfLines={2} style={{ color: c.secondary, fontSize: 12, lineHeight: 18 }}>{m.description}</Text>
        {editable && <Pressable accessibilityRole="button" accessibilityLabel={`${m.name} ${selected ? '장착 해제' : '장착'}`} accessibilityState={{ disabled: saving }} disabled={saving}
          onPress={() => choose(selected ? null : m.id)} style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 14, borderRadius: 10, backgroundColor: selected ? c.border : `${c.primary}18` }}>
          <Text style={{ color: c.primary, fontWeight: '700' }}>{saving ? '저장 중…' : selected ? '장착 해제' : '장착하기'}</Text>
        </Pressable>}
      </View>;
    })}
    {ordered.length > 6 && <MoreButton expanded={expanded} onPress={() => setExpanded(v => !v)} remaining={ordered.length - 6} label="훈장 더보기" />}
    {expanded && <PagedListSheet title={`보유 훈장 ${ordered.length}개`} data={ordered} keyExtractor={m => m.id} onClose={() => setExpanded(false)} renderItem={({ item: m }) => <View style={{ backgroundColor: c.surface, padding: 16, borderRadius: 16, gap: 8 }}>
      <Text style={{ color: c.text, fontWeight: '800' }}>{m.temporary ? '👑' : '🏅'} {m.name}{m.id === equipped?.id ? ' · 장착 중' : ''}</Text>
      <Text style={{ color: c.secondary, lineHeight: 20 }}>{m.description}</Text>
      {editable && <Pressable accessibilityRole="button" disabled={saving} onPress={() => choose(m.id === equipped?.id ? null : m.id)} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: c.primary, fontWeight: '700' }}>{saving ? '저장 중…' : m.id === equipped?.id ? '장착 해제' : '장착하기'}</Text></Pressable>}
    </View>} />}
  </View>;
}
