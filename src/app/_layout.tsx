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
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!user}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="community" />
        <Stack.Screen name="player/[uid]" />
        <Stack.Screen name="friends" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="admin" />
      </Stack.Protected>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="sign-up" />
      </Stack.Protected>
    </Stack>
  );
}
