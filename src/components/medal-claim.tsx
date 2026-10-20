import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import { claimMedal, type Medal } from '@/lib/medals';
import { useSession } from '@/providers/session-provider';

export function MedalClaim({ medal, claimed }: { medal: Medal; claimed: ReadonlySet<string> | null }) {
  const c = useColors();
  const { user, profile } = useSession();
  const [saving, setSaving] = useState(false);
  const owned = claimed?.has(medal.id);
  const eligible = !!profile && medal.eligible(profile);
  const disabled = !user || !claimed || owned || !eligible || saving;
  async function claim() {
    if (disabled || !user) return;
    setSaving(true);
    try { await claimMedal(user.uid, medal); }
    catch { Alert.alert('훈장을 받지 못했어요', '연결을 확인한 뒤 다시 시도해주세요.'); }
    finally { setSaving(false); }
  }
  return <View style={{ backgroundColor: c.surface, borderRadius: 16, padding: 14, gap: 8 }}>
    <Text style={{ color: c.text, fontWeight: '800' }}>🏅 {medal.name}</Text>
    <Text style={{ color: c.secondary, lineHeight: 20 }}>{medal.description}</Text>
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} disabled={!!disabled} onPress={claim}
      style={{ alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 12, backgroundColor: !disabled ? c.primary : c.border }}>
      <Text style={{ color: !disabled ? '#fff' : c.secondary, fontWeight: '700' }}>{saving ? '수령 중…' : owned ? '수령 완료 · 영구 보유' : !claimed ? '훈장 확인 중' : eligible ? '훈장 받기' : '조건 달성 후 수령'}</Text>
    </Pressable>
  </View>;
}
