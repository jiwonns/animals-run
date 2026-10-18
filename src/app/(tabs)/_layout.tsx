import { NativeTabs } from 'expo-router/native-tabs';

import { useColors } from '@/hooks/use-colors';
import { useRankingSync } from '@/hooks/use-ranking-sync';
import { WalkProvider } from '@/providers/walk-provider';

export default function TabLayout() {
  const colors = useColors();
  useRankingSync();
  return (
    <WalkProvider>
      <NativeTabs
        tintColor={colors.primary}
        iconColor={{ default: colors.secondary, selected: colors.primary }}
        labelStyle={{
          default: { color: colors.secondary, fontSize: 11, fontWeight: '600' },
          selected: { color: colors.primary, fontSize: 11, fontWeight: '800' },
        }}
        backgroundColor={colors.background}
        indicatorColor={colors.primary + '24'}
        rippleColor={colors.primary + '33'}
        labelVisibilityMode="labeled">
        <NativeTabs.Trigger name="collection">
          <NativeTabs.Trigger.Label>보관함</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: 'archivebox', selected: 'archivebox.fill' }} md="inventory_2" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="gacha">
          <NativeTabs.Trigger.Label>뽑기</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: 'gift', selected: 'gift.fill' }} md="redeem" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="(home)">
          <NativeTabs.Trigger.Label>홈</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: 'pawprint', selected: 'pawprint.fill' }} md="pets" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="manage">
          <NativeTabs.Trigger.Label>지도</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: 'map', selected: 'map.fill' }} md="map" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="mypage">
          <NativeTabs.Trigger.Label>마이페이지</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }}
            md="account_circle"
          />
        </NativeTabs.Trigger>
      </NativeTabs>
    </WalkProvider>
  );
}
