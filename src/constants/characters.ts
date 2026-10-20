import { COLLECTION_DATA, type CharacterId, type CollectionId } from './gacha.generated';
import type { Grade, GachaImage } from './gacha-types';

export type { CharacterId, CollectionId, Grade };

/**
 * Grades used in assets/gacha/<collection>/collection.json; keep in sync with GRADES in scripts/generate-gacha.js.
 * Declaration order is the display order in the dex and collection.
 */
export const GRADES: Record<Grade, { label: string; color: string }> = {
  N: { label: '노말', color: '#8E8E93' },
  R: { label: '레어', color: '#38BDF8' },
  EP: { label: '에픽', color: '#A855F7' },
  U: { label: '유니크', color: '#EC4899' },
  L: { label: '레전더리', color: '#EF4444' },
  E: { label: '이벤트', color: '#F97316' },
  H: { label: '히든', color: '#EAB308' },
};

/** Grades that have at least one collection, in display order. */
export const GRADE_ORDER = (Object.keys(GRADES) as Grade[]).filter((g) => COLLECTION_DATA.some((c) => c.grade === g));

export type Character = {
  id: CharacterId;
  name: string;
  image: GachaImage;
  /** A small copy of `image` for grids and lists. */
  thumb: GachaImage;
  collection: CollectionId;
  grade: Grade;
};

export const COLLECTIONS = COLLECTION_DATA.map(({ id, name, grade }) => ({ id, name, grade }));

export const CHARACTERS: Character[] = COLLECTION_DATA.flatMap((collection) =>
  collection.characters.map((character) => ({
    ...character,
    collection: collection.id,
    grade: collection.grade,
  })),
);

export const CHARACTER_BY_ID = Object.fromEntries(CHARACTERS.map((c) => [c.id, c])) as Record<
  CharacterId,
  Character
>;

export function charactersIn(collection: CollectionId): Character[] {
  return CHARACTERS.filter((c) => c.collection === collection);
}

/** Keep imported array/object identities stable when a published catalog is loaded. */
export function rebuildCharacters() {
  COLLECTIONS.splice(0, COLLECTIONS.length, ...COLLECTION_DATA.map(({ id, name, grade }) => ({ id, name, grade })));
  CHARACTERS.splice(0, CHARACTERS.length, ...COLLECTION_DATA.flatMap(c => c.characters.map(ch => ({ ...ch, collection: c.id, grade: c.grade }))));
  for (const key of Object.keys(CHARACTER_BY_ID)) delete CHARACTER_BY_ID[key as CharacterId];
  Object.assign(CHARACTER_BY_ID, Object.fromEntries(CHARACTERS.map(ch => [ch.id, ch])));
  GRADE_ORDER.splice(0, GRADE_ORDER.length, ...(Object.keys(GRADES) as Grade[]).filter(g => COLLECTION_DATA.some(c => c.grade === g)));
}
