import { Stack } from 'expo-router';

export default function CollectionLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="dex" options={{ title: '도감', headerBackTitle: '보관함' }} />
    </Stack>
  );
}
