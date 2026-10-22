import { Image } from '@/components/gacha-image';
import { StyleSheet, Text, View } from 'react-native';

import { GradeBadge } from '@/components/grade-badge';
import type { Banner } from '@/constants/banners';
import { COLLECTIONS } from '@/constants/characters';
import { drawGrade } from '../../shared/gacha/draw-pools';

export function BannerPoster({ banner, width, height }: { banner: Banner; width: number; height: number }) {
  const { background, accent, text, image } = banner.poster;

  if (image) {
    return (
      <View style={[styles.poster, styles.imagePoster, { width, height, backgroundColor: background }]}>
        <Image source={image} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" />
        {banner.id === 'cats' ? (
          <>
            <View style={[styles.catEyebrow, { backgroundColor: '#FFF9F0E8' }]}><Text style={{ color: accent, fontSize: 9, letterSpacing: 1, fontWeight: '900' }}>MEOW CLUB  ·  10 BREEDS</Text></View>
            <View style={styles.catTitleCard}>
              <Text style={[styles.catFooterTitle, { color: text }]}>{banner.title}</Text>
              <Text style={[styles.catFooterBody, { color: text }]}>{banner.tagline}</Text>
            </View>
          </>
        ) : banner.tagline ? (
          <View style={styles.overlay}>
            <Text style={styles.description}>{banner.tagline}</Text>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.poster, styles.framed, { width, height, backgroundColor: background, borderColor: accent }]}>
      <View style={styles.top}>
        <View style={styles.badges}>
          {[
            ...new Set(
              banner.rates.filter((r) => !r.hidden).map(({ collection }) => drawGrade(COLLECTIONS.find((c) => c.id === collection)!.grade)),
            ),
          ].map((grade) => (
            <GradeBadge key={grade} grade={grade} showLabel />
          ))}
        </View>
        <Text style={[styles.title, { color: text }]}>{banner.title}</Text>
        <Text style={[styles.tagline, { color: text }]}>{banner.tagline}</Text>
      </View>

      <Image source={banner.hero.image} style={styles.hero} contentFit="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  poster: {
    borderRadius: 28,
    padding: 20,
    overflow: 'hidden',
  },
  framed: {
    borderWidth: 3,
  },
  imagePoster: {
    justifyContent: 'flex-end',
  },
  overlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  description: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  top: {
    gap: 6,
  },
  badges: {
    flexDirection: 'row',
    gap: 6,
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    marginTop: 4,
  },
  tagline: {
    fontSize: 15,
    fontWeight: '600',
    opacity: 0.85,
  },
  hero: {
    flex: 1,
    width: '100%',
    marginTop: 8,
  },
  catEyebrow: { alignSelf: 'flex-start', marginTop: 2, marginLeft: 2, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 20 },
  catTitleCard: { gap: 4, alignItems: 'center', marginHorizontal: 2, marginBottom: 2, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 16, backgroundColor: '#FFF9F0E8' },
  catFooterTitle: { fontSize: 15, fontWeight: '900' },
  catFooterBody: { fontSize: 9, textAlign: 'center' },
});
