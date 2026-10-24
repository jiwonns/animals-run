import { Pressable, Text } from 'react-native';
import { ScrollView } from './refreshable';
import { useAppRefresh } from '@/lib/app-refresh';
import { useColors } from '@/hooks/use-colors';

/** Separate map touch surface so refreshing never takes over map panning. */
export function RefreshHandle(){
  const {refresh,refreshing}=useAppRefresh(),colors=useColors();
  return <ScrollView style={{height:44,maxHeight:44}} contentContainerStyle={{flexGrow:1}} showsVerticalScrollIndicator={false}>
    <Pressable accessibilityRole="button" accessibilityLabel="새로고침" onPress={()=>void refresh()} style={{minHeight:44,alignItems:'center',justifyContent:'center',backgroundColor:colors.background,borderRadius:12}}><Text style={{color:colors.secondary,fontSize:12}}>{refreshing?'새로고침 중…':'↓ 내려서 새로고침 · 눌러서도 가능'}</Text></Pressable>
  </ScrollView>;
}
