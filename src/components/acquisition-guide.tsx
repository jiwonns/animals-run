import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useColors } from '@/hooks/use-colors';

export function AcquisitionGuide() {
  const c=useColors();
  return <View style={{flex:1,backgroundColor:c.background,padding:24,gap:18}}><Text style={{color:c.text,fontSize:24,fontWeight:'800'}}>뽑기와 진화로 만나요</Text><Text style={{color:c.secondary,lineHeight:24}}>현재 뽑기에서는 노말·프리미엄 동물만 나와요. 레어·에픽·유니크·레전더리 모습은 함께 걸은 뒤 진화로 획득해요. 교배·합성·재활용으로 새 동물을 만드는 기능은 종료됐어요. 이미 받은 알은 홈에서 부화할 수 있어요.</Text>{([{label:'동물 뽑기',href:'/gacha'},{label:'진화하기',href:'/evolve'}] as const).map(item=><Pressable key={item.href} accessibilityRole="button" onPress={()=>router.navigate(item.href)} style={{backgroundColor:c.primary,borderRadius:14,padding:16,alignItems:'center'}}><Text style={{color:'#fff',fontWeight:'800'}}>{item.label}</Text></Pressable>)}</View>;
}
