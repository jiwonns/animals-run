import type { ComponentProps } from 'react';
import { View } from 'react-native';
import { Icon } from './icon';

export function IconTile({ name, color, size = 44, iconSize = 22 }: { name: ComponentProps<typeof Icon>['name']; color: string; size?: number; iconSize?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size * .29, backgroundColor: color, borderWidth: 1, borderColor: '#FFFFFF55', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxShadow: `0 3px 7px ${color}22` }}>
    <View style={{ position: 'absolute', left: size * .08, right: size * .08, top: size * .05, height: size * .39, borderRadius: size, backgroundColor: '#FFFFFF12' }} />
    <View style={{ position: 'absolute', left: size * .18, right: size * .18, top: size * .06, height: 1, backgroundColor: '#FFFFFF55' }} />
    <Icon name={name} size={iconSize} color="#fff" />
  </View>;
}
