import { Text, View } from 'react-native';
import { useBond } from '@/hooks/use-bond';
import { useColors } from '@/hooks/use-colors';
import { useSession } from '@/providers/session-provider';

export function BondCard() {
  const c = useColors();
  const { profile } = useSession();
  const { status, failed } = useBond();
  return <View style={{ padding: 16, gap: 8, borderRadius: 16, backgroundColor: c.surface }}>
    <Text style={{ color: c.primary, fontWeight: '800' }}>{status ? `♥ 친밀도 Lv.${status.level} · ${status.name}` : '♥ 동물과의 친밀도'}</Text>
    <Text style={{ color: c.text, lineHeight: 22 }}>{failed ? '친밀도를 불러오지 못했어요. 연결 상태를 확인해주세요.' : !profile?.avatar ? '대표 동물을 선택하고 첫 인연을 시작해보세요.' : status?.message ?? '친구와의 인연을 확인하고 있어요.'}</Text>
    {status && <Text style={{ color: c.secondary }}>{status.points.toLocaleString()}점 · {status.next ? `다음 단계 ${status.next.toLocaleString()}점` : '가장 깊은 인연을 맺었어요'}</Text>}
    <Text style={{ color: c.secondary, fontSize: 12, lineHeight: 18 }}>대표 동물과 100걸음마다 1점, 함께한 1시간마다 1점씩 쌓여요. 앱을 닫아도 시간이 쌓이고, 동물을 바꿔도 인연은 남아요.</Text>
  </View>;
}
