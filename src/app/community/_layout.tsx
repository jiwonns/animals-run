import { Stack } from "expo-router";

export default function CommunityLayout() {
  return <Stack screenOptions={{title:'커뮤니티',headerBackTitle:'뒤로',headerBackButtonDisplayMode:'minimal'}}><Stack.Screen name="index" options={{title:'커뮤니티'}}/><Stack.Screen name="[id]" options={{title:'게시글'}}/><Stack.Screen name="new" options={{title:'글쓰기'}}/></Stack>;
}
