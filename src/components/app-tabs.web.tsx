import { TabList, TabSlot, Tabs, TabTrigger } from 'expo-router/ui';
import { Pressable, StyleSheet, Text, View, type PressableProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, ICONS } from '@/components/icon';
import { useColors } from '@/hooks/use-colors';

const TABS = [
  { name: 'collection', href: '/collection', label: '보관함', icon: 'archive' },
  { name: 'gacha', href: '/gacha', label: '뽑기', icon: 'gift' },
  { name: '(home)', href: '/', label: '홈', icon: 'character' },
  { name: 'manage', href: '/manage', label: '지도', icon: 'map' },
  { name: 'mypage', href: '/mypage', label: '마이페이지', icon: 'person' },
] as const;

/** Browsers have no system tab bar, so the web build draws a bottom bar like the apps'. */
export function AppTabs() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <Tabs style={styles.root}>
      <TabSlot />
      <TabList
        style={[
          styles.bar,
          { backgroundColor: colors.background, borderColor: colors.border, paddingBottom: insets.bottom + 6 },
        ]}>
        {TABS.map((tab) => (
          <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
            <TabButton label={tab.label} icon={tab.icon} />
          </TabTrigger>
        ))}
      </TabList>
    </Tabs>
  );
}

function TabButton({
  label,
  icon,
  isFocused,
  ...props
}: PressableProps & { isFocused?: boolean; label: string; icon: keyof typeof ICONS }) {
  const colors = useColors();
  const tint = isFocused ? colors.primary : colors.secondary;
  return (
    <Pressable {...props} accessibilityRole="tab" accessibilityState={{ selected: isFocused }} style={styles.tab}>
      <View style={[styles.pill, isFocused && { backgroundColor: colors.primary + '1F' }]}>
        <Icon name={ICONS[icon]} size={22} color={tint} />
      </View>
      <Text style={[styles.label, { color: tint }, isFocused && styles.labelFocused]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  pill: {
    width: 56,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
  },
  labelFocused: {
    fontWeight: '800',
  },
});
