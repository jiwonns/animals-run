import { Stack } from 'expo-router';
import { ArenaScreen } from '@/components/arena-screen';
export default function ArenaRoute() {
  return <><Stack.Screen options={{ title: '결투장', headerStyle: { backgroundColor: '#101321' }, headerTintColor: '#F5F2FF' }} /><ArenaScreen /></>;
}
