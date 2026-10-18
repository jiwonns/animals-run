import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { CHARACTER_BY_ID, type CharacterId } from '@/constants/characters';
import { useColors } from '@/hooks/use-colors';

/** Square around a character's face, as fractions of the image: characters are drawn head-first at the top. */
export const FACE_CROP = { x: 0.15, y: 0.05, size: 0.7 };

type Props = {
  avatar: CharacterId | null | undefined;
  size: number;
  /** Shown when there is no avatar. */
  fallback: string;
  borderColor?: string;
};

export function AvatarFace({ avatar, size, fallback, borderColor }: Props) {
  const colors = useColors();
  const character = avatar ? CHARACTER_BY_ID[avatar] : undefined;
  const image = size / FACE_CROP.size;
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surface },
        borderColor && { borderWidth: 3, borderColor },
      ]}>
      {character ? (
        <Image
          source={image <= 128 ? character.thumb : character.image}
          contentFit="contain"
          style={{
            position: 'absolute',
            width: image,
            height: image,
            left: -FACE_CROP.x * image - (borderColor ? 3 : 0),
            top: -FACE_CROP.y * image - (borderColor ? 3 : 0),
          }}
        />
      ) : (
        <Text style={[styles.initial, { color: colors.secondary, fontSize: size * 0.38 }]}>
          {fallback.charAt(0).toUpperCase()}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontWeight: '700',
  },
});
