import { CHARACTER_BY_ID, charactersIn, type Character, type CollectionId } from './characters';
import { COLLECTION_DATA } from './gacha.generated';
import type { GachaImage } from './gacha-types';

export type DrawCount = 1 | 10;

export type Banner = {
  id: CollectionId;
  title: string;
  tagline: string;
  cost: Record<DrawCount, number>;
  /** Chance of landing in each collection (sums to 1); characters within a collection are equally likely. */
  rates: { collection: CollectionId; rate: number; hidden: boolean }[];
  hero: Character;
  poster: { background: string; accent: string; text: string; image: GachaImage | null };
};

/** One banner per collection that has one; scripts/generate-gacha.js works out each banner's odds. */
export const BANNERS: Banner[] = COLLECTION_DATA.flatMap(({ id, banner }) =>
    banner && banner.enabled !== false
    ? [
        {
          id,
          title: banner.title,
          tagline: banner.tagline,
          cost: banner.cost,
          rates: banner.rates,
          hero: CHARACTER_BY_ID[banner.hero],
          poster: { ...banner.colors, image: banner.poster },
        },
      ]
    : [],
);

export function rebuildBanners() {
  BANNERS.splice(0, BANNERS.length, ...COLLECTION_DATA.flatMap(({ id, banner }) => banner && banner.enabled !== false ? [{ id, title: banner.title, tagline: banner.tagline, cost: banner.cost, rates: banner.rates, hero: CHARACTER_BY_ID[banner.hero], poster: { ...banner.colors, image: banner.poster } }] : []));
}

export function pickFromBanner(banner: Banner): Character {
  let roll = Math.random();
  const last = banner.rates[banner.rates.length - 1];
  const { collection } = banner.rates.find(({ rate }) => (roll -= rate) < 0) ?? last;
  const pool = charactersIn(collection);
  return pool[Math.floor(Math.random() * pool.length)];
}
