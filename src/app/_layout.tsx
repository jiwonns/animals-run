import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { BrandSplash } from '@/components/brand-splash';

import "@/lib/web-setup";
import { SessionProvider, useSession } from "@/providers/session-provider";
import { WalkProvider } from "@/providers/walk-provider";
import { BondProvider } from '@/hooks/use-bond';
import { FriendsProvider } from '@/providers/friends-provider';
import { CatalogProvider } from '@/providers/catalog-provider';

SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 400, fade: true });

export default function RootLayout() {
  return (
    <SessionProvider>
      <CatalogProvider>
      <FriendsProvider>
      <BondProvider>
      <WalkProvider>
        <RootNavigator />
      </WalkProvider>
      </BondProvider>
      <StatusBar style="auto" />
      </FriendsProvider>
      </CatalogProvider>
    </SessionProvider>
  );
}

function RootNavigator() {
  const { user, loading, notice } = useSession();
  const [entryReady, setEntryReady] = useState(false);

  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => {});
    const timer = setTimeout(() => setEntryReady(true), 650);
    return () => clearTimeout(timer);
  }, []);

  if (loading || !entryReady) return <BrandSplash notice={notice} />;

  return (
    <Stack screenOptions={{ headerShown: false, title: 'Animals Run', headerBackTitle: '뒤로', headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Protected guard={!!user}>
        <Stack.Screen name="(tabs)" options={{title:'홈'}} />
        <Stack.Screen name="community" options={{title:'커뮤니티'}} />
        <Stack.Screen name="player/[uid]" options={{title:'프로필',headerShown:true}} />
        <Stack.Screen name="friends" options={{title:'친구',headerShown:true}} />
        <Stack.Screen name="notifications" options={{title:'알림',headerShown:true}} />
        <Stack.Screen name="admin" options={{title:'뽑기 관리',headerShown:true}} />
      </Stack.Protected>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="sign-up" />
      </Stack.Protected>
    </Stack>
  );
}
