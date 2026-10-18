import { collection, doc, runTransaction, serverTimestamp, setDoc, type Timestamp } from 'firebase/firestore';

import { CHARACTER_BY_ID, type CharacterId, type Grade } from '@/constants/characters';
import { REWARDS } from '@/constants/gacha.generated';

import { rollChild } from './craft';
import { db } from './firebase';
import { profileRef, type Profile } from './profile';

/** The nest holds one egg per slot; firestore.rules only accepts these ids. */
export const EGG_SLOTS = ['0', '1', '2'] as const;
export type EggSlot = (typeof EGG_SLOTS)[number];

/** users/{uid}/eggs/{slot}: the child is decided when the egg is laid. */
export type Egg = {
  parents: [CharacterId, CharacterId];
  child: CharacterId;
  grade: Grade;
  /** Null until the server timestamp resolves. */
  createdAt: Timestamp | null;
};

/** companions/{uid}: steps walked with each character as the avatar. */
export type Companion = {
  steps: Partial<Record<CharacterId, number>>;
};

export class HomeError extends Error {}

export const eggRef = (uid: string, slot: EggSlot) => doc(db, 'users', uid, 'eggs', slot);
export const eggsRef = (uid: string) => collection(db, 'users', uid, 'eggs');
export const companionRef = (uid: string) => doc(db, 'companions', uid);

/** Only grades with a hatch time can breed; eggs only ever hold those grades. */
export const canBreed = (grade: Grade) => REWARDS.breeding.hatchMinutes[grade] !== undefined;
export const hatchMinutes = (grade: Grade) => REWARDS.breeding.hatchMinutes[grade] ?? 0;
/** An egg whose timestamp hasn't resolved yet was laid just now. */
export function hatchAt(egg: Egg, now: number) {
  return (egg.createdAt?.toMillis() ?? now) + hatchMinutes(egg.grade) * 60_000;
}

/** Coins to hatch now; firestore.rules charges per started minute left. */
export function skipCost(egg: Egg, now: number) {
  const left = hatchAt(egg, now) - now;
  return left > 0 ? Math.ceil(left / 60_000) * REWARDS.breeding.coinsPerMinute : 0;
}

/** Free and keeps both parents; the child is rolled now (see breedOdds). */
export function layEgg(uid: string, slot: EggSlot, parents: [CharacterId, CharacterId]) {
  const child = rollChild(parents);
  return setDoc(eggRef(uid, slot), {
    parents,
    child,
    grade: CHARACTER_BY_ID[child].grade,
    createdAt: serverTimestamp(),
  });
}

/** Adds the child, pays for any time left and removes the egg in one write. */
export function hatchEgg(uid: string, slot: EggSlot) {
  return runTransaction(db, async (tx) => {
    const profileSnap = await tx.get(profileRef(uid));
    const eggSnap = await tx.get(eggRef(uid, slot));
    if (!profileSnap.exists() || !eggSnap.exists()) throw new HomeError('알을 찾을 수 없어요.');
    const profile = profileSnap.data() as Profile;
    const egg = eggSnap.data() as Egg;
    const cost = skipCost(egg, Date.now());
    if (profile.coins < cost) throw new HomeError('코인이 부족해요.');
    tx.update(profileRef(uid), {
      [`characters.${egg.child}`]: (profile.characters[egg.child] ?? 0) + 1,
      coins: profile.coins - cost,
      lastHatch: slot,
      hatchCount: (profile.hatchCount ?? 0) + 1,
    });
    tx.delete(eggRef(uid, slot));
    return egg;
  });
}
