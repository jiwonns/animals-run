import { useListWindow } from '@/hooks/use-list-window';
import { useCatalog } from '@/providers/catalog-provider';
import { Image } from '@/components/gacha-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { AvatarFace } from '@/components/avatar-face';
import { GradeBadge } from '@/components/grade-badge';
import { CHARACTERS, GRADE_ORDER, type CharacterId } from '@/constants/characters';
import { useColors } from '@/hooks/use-colors';
import { useGridCellWidth } from '@/hooks/use-grid-cell-width';
import { displayName } from '@/lib/profile';
import { setAvatar } from '@/lib/walk';
import { useSession } from '@/providers/session-provider';

const COLUMNS = 4;
const PADDING = 20;
const GAP = 10;
/** Padding plus border of the section around the grid. */
const INSET = 13;

export default function AvatarScreen() {
  useCatalog();
  const colors = useColors();
  const cellWidth = useGridCellWidth(COLUMNS, PADDING + INSET, GAP);
  const { user, profile } = useSession();
  const [saving, setSaving] = useState(false);

  const current = profile?.avatar ?? null;
  const owned = CHARACTERS.filter((c) => (profile?.characters[c.id] ?? 0) > 0).sort(
    (a, b) => GRADE_ORDER.indexOf(a.grade) - GRADE_ORDER.indexOf(b.grade),
  );

  async function choose(avatar: CharacterId | null) {
    if (!user || saving || avatar === current) return;
    setSaving(true);
    try {
      await setAvatar(user.uid, avatar);
    } catch {
      Alert.alert('저장하지 못했어요', '잠시 후 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  }

  const page=useListWindow(owned,user?.uid??'');
  return <FlatList style={{backgroundColor:colors.background}} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{padding:PADDING,gap:GAP}}
    data={page.data} numColumns={COLUMNS} keyExtractor={v=>v.id} columnWrapperStyle={{gap:GAP}}
    initialNumToRender={16} maxToRenderPerBatch={16} windowSize={5} onEndReached={page.loadMore} onEndReachedThreshold={0.4}
    ListHeaderComponent={<View style={{gap:16,paddingBottom:12}}><View style={styles.preview}><AvatarFace avatar={current} size={112} fallback={profile?displayName(profile):''} borderColor={colors.primary}/><Text style={[styles.previewName,{color:colors.text}]}>{profile&&displayName(profile)}</Text><Text style={{color:colors.secondary}}>함께할 대표 동물 친구를 선택해주세요</Text></View><View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><Text style={[styles.sectionTitle,{color:colors.text}]}>보유 동물 {owned.length}종</Text><Pressable disabled={saving} onPress={()=>choose(null)} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:colors.primary}}>선택 해제</Text></Pressable></View></View>}
    ListEmptyComponent={<Pressable onPress={()=>router.navigate('/gacha')} style={{padding:20}}><Text style={{color:colors.primary}}>뽑기에서 새로운 동물 친구를 만나보세요</Text></Pressable>}
    renderItem={({item:character})=><Pressable accessibilityRole="button" accessibilityLabel={character.name} accessibilityState={{selected:character.id===current,disabled:saving}} disabled={saving} onPress={()=>choose(character.id)} style={[styles.cell,{width:cellWidth,backgroundColor:colors.surface,borderColor:character.id===current?colors.primary:'transparent'}]}><Image source={character.thumb} style={styles.image} contentFit="contain"/><Text style={[styles.name,{color:colors.text}]} numberOfLines={1}>{character.name}</Text><GradeBadge grade={character.grade}/></Pressable>}/>;
}

const styles = StyleSheet.create({
  content: {
    padding: PADDING,
    gap: 20,
  },
  preview: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  previewName: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 6,
  },
  previewHint: {
    fontSize: 13,
  },
  section: {
    borderWidth: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  clear: {
    fontSize: 13,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
    padding: INSET - 1,
  },
  cell: {
    aspectRatio: 0.8,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  image: {
    width: '78%',
    aspectRatio: 1,
  },
  name: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  badge: {
    position: 'absolute',
    top: 4,
    left: 4,
    transform: [{ scale: 0.8 }],
  },
  check: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
  },
  empty: {
    borderWidth: 1,
    borderRadius: 20,
    alignItems: 'center',
    padding: 28,
    gap: 14,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
  },
  button: {
    borderRadius: 22,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  buttonLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.7,
  },
});
