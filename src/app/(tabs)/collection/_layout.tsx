import { Stack } from 'expo-router';

export default function CollectionLayout() {
  return (
    <Stack screenOptions={{ title:'보관함',headerBackTitle:'뒤로',headerBackButtonDisplayMode:'minimal' }}>
      <Stack.Screen name="index" options={{ title:'보관함',headerShown: false }} />
      <Stack.Screen name="dex" options={{ title: '도감', headerBackTitle: '보관함' }} />
    </Stack>
  );
}
