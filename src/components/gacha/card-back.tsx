import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import type { Banner } from '@/constants/banners';

/** Mixes a #RRGGBB color toward white; amount 0 keeps it, 1 is white. */
export function tintOf(hex: string, amount = 0.82) {
  const n = parseInt(hex.slice(1, 7), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  const [r, g, b] = [mix((n >> 16) & 255), mix((n >> 8) & 255), mix(n & 255)];
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** Decorated back face: diagonal stripes, inset frame, and the banner hero as a silhouette emblem. */
export function CardBack({ banner, width, height, radius, color }: {
  banner: Banner;
  width: number;
  height: number;
  radius: number;
  /** Paint the back in this color (e.g. a grade color) instead of the banner's. */
  color?: string;
}) {
  const background = color ? tintOf(color) : banner.poster.background;
  const accent = color ?? banner.poster.accent;
  const frame = accent;
  const inset = width * 0.07;
  const emblem = width * 0.5;
  const stripeGap = width * 0.2;
  const stripes = Math.ceil((width + height) / stripeGap) + 2;
  const diamond = Math.max(6, width * 0.09);

  return (
    <View style={[StyleSheet.absoluteFill, styles.back, { backgroundColor: background, borderRadius: radius }]}>
      {Array.from({ length: stripes }, (_, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            top: -height,
            left: -height * 0.6 + i * stripeGap,
            width: stripeGap * 0.35,
            height: height * 3,
            backgroundColor: accent,
            opacity: 0.12,
            transform: [{ rotate: '30deg' }],
          }}
        />
      ))}

      <View
        style={[
          styles.frame,
          { top: inset, left: inset, right: inset, bottom: inset, borderColor: frame, borderRadius: radius * 0.6 },
        ]}
      />
      {[inset - diamond / 2, height - inset - diamond / 2].map((top) => (
        <View
          key={top}
          style={[
            styles.diamond,
            { top, left: (width - diamond) / 2, width: diamond, height: diamond, backgroundColor: frame },
          ]}
        />
      ))}

      <View
        style={[
          styles.emblem,
          {
            width: emblem,
            height: emblem,
            borderRadius: emblem / 2,
            backgroundColor: accent,
            borderColor: background,
            borderWidth: Math.max(2, width * 0.025),
            outlineColor: frame,
            outlineWidth: Math.max(1, width * 0.012),
          },
        ]}>
        <Image
          source={banner.hero.image}
          style={{ width: emblem * 0.7, height: emblem * 0.7 }}
          tintColor={background}
          contentFit="contain"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  back: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    position: 'absolute',
    borderWidth: 1.5,
  },
  diamond: {
    position: 'absolute',
    transform: [{ rotate: '45deg' }],
  },
  emblem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
