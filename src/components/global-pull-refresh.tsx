import { Pressable, Text, View } from 'react-native';
import { useAppRefresh } from '@/lib/app-refresh';
export function GlobalPullRefresh(){
  const {error,refreshing,refresh}=useAppRefresh();
  if(!error||refreshing)return null;
  return <View style={{position:'absolute',top:44,left:16,right:16,padding:12,borderRadius:12,backgroundColor:'#fff8f0',borderWidth:1,borderColor:'#f4cba4',gap:8}}><Text accessibilityRole="alert" style={{color:'#5d3215'}}>{error}</Text><Pressable accessibilityRole="button" onPress={()=>void refresh()} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:'#d65d00'}}>다시 시도</Text></Pressable></View>;
}
