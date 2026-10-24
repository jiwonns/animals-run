import { Stack } from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function HomeLayout() {
  return (
    <Stack screenOptions={{title:'홈',headerBackTitle:'뒤로',headerBackButtonDisplayMode:'minimal'}}>
      <Stack.Screen name="index" options={{ title: '홈' }} />
      <Stack.Screen name="arena" options={{ title: '결투장' }} />
      <Stack.Screen name="auction" options={{ title: '경매장' }} />
      <Stack.Screen name="breed" options={{ title: '교배하기' }} />
      <Stack.Screen name="fuse" options={{ title: '합성' }} />
      <Stack.Screen name="recycle" options={{ title: '재활용' }} />
      <Stack.Screen name="evolve" options={{ title: '진화' }} />
    </Stack>
  );
}
