import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { BrandSplash } from '@/components/brand-splash';

import "@/lib/web-setup";
import { SessionProvider, useSession } from "@/providers/session-provider";
import { WalkProvider } from "@/providers/walk-provider";

SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 400, fade: true });

export default function RootLayout() {
  return (
    <SessionProvider>
      <WalkProvider>
        <RootNavigator />
      </WalkProvider>
      <StatusBar style="auto" />
    </SessionProvider>
  );
}

function RootNavigator() {
  const { user, loading } = useSession();
  const [entryReady, setEntryReady] = useState(false);

  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => {});
    const timer = setTimeout(() => setEntryReady(true), 650);
    return () => clearTimeout(timer);
  }, []);

  if (loading || !entryReady) return <BrandSplash />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!user}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="community" />
        <Stack.Screen name="player/[uid]" />
      </Stack.Protected>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="sign-up" />
      </Stack.Protected>
    </Stack>
  );
}
