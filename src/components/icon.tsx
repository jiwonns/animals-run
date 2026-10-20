import { SymbolView } from 'expo-symbols';
import type { ComponentProps } from 'react';
import { Platform, Text } from 'react-native';

type SymbolName = Extract<ComponentProps<typeof SymbolView>['name'], { ios?: unknown }>;

/** SF Symbol on iOS, Material Symbol on Android and web (the font is loaded in lib/web-setup.web.ts). */
export function Icon({ name, size = 20, color }: { name: SymbolName; size?: number; color: string }) {
  if (Platform.OS === 'web') {
    return (
      <Text
        aria-hidden
        selectable={false}
        style={{ fontFamily: 'Material Symbols Rounded', fontSize: size, lineHeight: size, width: size, color }}>
        {name.android}
      </Text>
    );
  }
  return <SymbolView name={name} size={size} tintColor={color} />;
}

export const ICONS = {
  bell: { ios: 'bell.fill', android: 'notifications' },
  trophy: { ios: 'trophy.fill', android: 'emoji_events' },
  gift: { ios: 'gift.fill', android: 'redeem' },
  grade: { ios: 'rosette', android: 'military_tech' },
  character: { ios: 'pawprint.fill', android: 'pets' },
  collection: { ios: 'square.grid.3x3.fill', android: 'collections_bookmark' },
  draws: { ios: 'dice.fill', android: 'casino' },
  check: { ios: 'checkmark.circle.fill', android: 'check_circle' },
  ticket: { ios: 'ticket.fill', android: 'confirmation_number' },
  history: { ios: 'clock.arrow.circlepath', android: 'history' },
  chevron: { ios: 'chevron.right', android: 'chevron_right' },
  walk: { ios: 'figure.walk', android: 'directions_walk' },
  locate: { ios: 'location.fill', android: 'my_location' },
  location: { ios: 'mappin.and.ellipse', android: 'location_on' },
  people: { ios: 'person.2.fill', android: 'group' },
  visible: { ios: 'eye.fill', android: 'visibility' },
  hidden: { ios: 'eye.slash.fill', android: 'visibility_off' },
  settings: { ios: 'gearshape.fill', android: 'settings' },
  logout: { ios: 'rectangle.portrait.and.arrow.right', android: 'logout' },
  heart: { ios: 'heart.fill', android: 'favorite' },
  recycle: { ios: 'arrow.3.trianglepath', android: 'recycling' },
  fusion: { ios: 'wand.and.stars', android: 'auto_awesome' },
  evolve: { ios: 'arrow.up.circle.fill', android: 'upgrade' },
  plus: { ios: 'plus', android: 'add' },
  community: { ios: 'bubble.left.and.bubble.right.fill', android: 'forum' },
  map: { ios: 'map.fill', android: 'map' },
  dex: { ios: 'book.closed.fill', android: 'menu_book' },
  archive: { ios: 'archivebox.fill', android: 'inventory_2' },
  sort: { ios: 'arrow.up.arrow.down', android: 'swap_vert' },
  ranking: { ios: 'chart.bar.fill', android: 'leaderboard' },
  terms: { ios: 'doc.text.fill', android: 'description' },
  key: { ios: 'key.fill', android: 'key' },
  person: { ios: 'person.fill', android: 'person' },
  edit: { ios: 'pencil', android: 'edit' },
  nickname: { ios: 'face.smiling', android: 'badge' },
  leave: { ios: 'person.crop.circle.badge.xmark', android: 'person_remove' },
} satisfies Record<string, SymbolName>;
