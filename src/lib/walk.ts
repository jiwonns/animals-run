import { deleteDoc, increment, runTransaction, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';

import type { CharacterId } from '@/constants/characters';
import { REWARDS } from '@/constants/gacha.generated';

import { db } from './firebase';
import { companionRef } from './home';
import { locationRef, profileRef, type Profile } from './profile';

/**
 * Adds walked steps to the profile and pays a coin for every REWARDS.stepsPerCoin of the running total.
 * The avatar's companion steps are best effort: losing them must not hold back the coins.
 */
export async function creditSteps(uid: string, steps: number) {
  const avatar = await runTransaction(db, async (tx) => {
    const snapshot = await tx.get(profileRef(uid));
    const profile = snapshot.data() as Profile;
    const before = profile.steps ?? 0;
    const after = before + steps;
    const coins = Math.floor(after / REWARDS.stepsPerCoin) - Math.floor(before / REWARDS.stepsPerCoin);
    tx.update(profileRef(uid), { steps: after, coins: profile.coins + coins });
    return profile.avatar ?? null;
  });
  if (avatar) {
    setDoc(companionRef(uid), { steps: { [avatar]: increment(steps) } }, { merge: true }).catch(() => {});
  }
}

export function setAvatar(uid: string, avatar: CharacterId | null) {
  return updateDoc(profileRef(uid), { avatar });
}

/** firestore.rules requires the username, nickname and avatar to match the player's profile. */
export function shareLocation(
  uid: string,
  name: { username: string; nickname?: string },
  avatar: CharacterId | null,
  lat: number,
  lng: number,
) {
  return setDoc(locationRef(uid), {
    username: name.username,
    ...(name.nickname && { nickname: name.nickname }),
    avatar,
    lat,
    lng,
    updatedAt: serverTimestamp(),
  });
}

export function stopSharingLocation(uid: string) {
  return deleteDoc(locationRef(uid));
}
