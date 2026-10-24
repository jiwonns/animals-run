import { Stack } from 'expo-router';

export default function AuctionLayout() {
  return (
    <Stack screenOptions={{ headerBackTitle: '뒤로', headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="index" options={{ title: '경매장' }} />
      <Stack.Screen name="[id]" options={{ title: '시세' }} />
    </Stack>
  );
}
