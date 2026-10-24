import {
  collection,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Timestamp,
} from "firebase/firestore";

import type { CharacterId, Grade } from "@/constants/characters";

import { db } from "./firebase";
import { zodiacOf } from "./zodiac";

export const STARTING_COINS = 100;

export type Profile = {
  /** Receipt checked against the listing and 시세 write by Firestore rules. */
  lastAuction?: { id: string; action: 'list' | 'cancel' | 'buy' | 'sell'; character: CharacterId; price: number };
  /** Receipt for an atomic, server-validated arena payout. */
  lastArenaReward?: string;
  /** Receipt checked against current inventory and grade prices by Firestore rules. */
  lastSale?: { character: CharacterId; quantity: number };
  /** Login id; also the shown name for accounts without a nickname. */
  username: string;
  /** Shown to other players instead of the id; not unique. */
  nickname?: string;
  coins: number;
  /** Owned character id to number of copies. */
  characters: Partial<Record<CharacterId, number>>;
  /** Total characters ever drawn; firestore.rules uses it to verify each draw's cost. */
  drawCount: number;
  /** Ids from the most recent draw and its banner; firestore.rules checks each draw against these. */
  lastDraw?: CharacterId[];
  lastBanner?: string;
  /** Free draw tickets from achievements; missing until the first claim or draw since tickets existed. */
  tickets?: number;
  /** Characters drawn per grade since tickets existed; drives the per-grade "every 100" achievements. */
  gradeCounts?: Partial<Record<Grade, number>>;
  /** Id of the most recently claimed achievement; firestore.rules checks each claim against it. */
  lastClaim?: string;
  /** Total steps turned into coins so far; firestore.rules pays one coin per REWARDS.stepsPerCoin of them. */
  steps?: number;
  /** Owned character whose face marks the player on the map. */
  avatar?: CharacterId | null;
  /** YYYY-MM-DD from sign-up; missing for accounts made before birthdays were asked. */
  birthday?: string;
  /** Egg slot most recently hatched; firestore.rules checks each hatch against that egg. */
  lastHatch?: string;
  /** Times the player has hatched, evolved, fused and recycled; shown on the leaderboards. */
  hatchCount?: number;
  evolveCount?: number;
  fuseCount?: number;
  recycleCount?: number;
  /** The most recent fusion, recycling or evolution; firestore.rules checks each against it. */
  lastCraft?: { inputs: CharacterId[]; output: CharacterId | null };
};

/** locations/{uid}: a player sharing their position on the map. */
export type PlayerLocation = {
  audience?: 'public' | 'friends';
  username: string;
  nickname?: string;
  avatar: CharacterId | null;
  lat: number;
  lng: number;
  /** Null until the server timestamp resolves. */
  updatedAt: Timestamp | null;
};

/** One document per draw in users/{uid}/draws, keyed by drawCount after the draw. */
export type DrawLog = {
  banner: string;
  picks: CharacterId[];
  coins: number;
  /** Tickets spent on the draw. */
  tickets: number;
  /** Achievements the draw unlocked. */
  rewards: { id: string; label: string; tickets: number }[];
  /** Null until the server timestamp resolves. */
  createdAt: Timestamp | null;
};

export const profileRef = (uid: string) => doc(db, "users", uid);
export const drawLogRef = (uid: string, drawCount: number) =>
  doc(db, "users", uid, "draws", String(drawCount));
export const drawLogsRef = (uid: string) =>
  collection(db, "users", uid, "draws");
/** One document per claimed achievement in users/{uid}/claims, keyed by the achievement id. */
export const claimRef = (uid: string, achievementId: string) =>
  doc(db, "users", uid, "claims", achievementId);
export const claimsRef = (uid: string) =>
  collection(db, "users", uid, "claims");
export const locationRef = (uid: string) => doc(db, "locations", uid);
export const locationsRef = () => collection(db, "locations");

/**
 * Called on the first sign-in of an account; firestore.rules only accepts exactly this shape. A birthday
 * from sign-up comes with one of that year's zodiac animal.
 */
export function createProfile(
  uid: string,
  username: string,
  extras: { birthday: string; nickname: string } | null,
) {
  const birthday = extras?.birthday;
  return setDoc(profileRef(uid), {
    username,
    coins: STARTING_COINS,
    characters: birthday ? { [zodiacOf(birthday).id]: 1 } : {},
    drawCount: 0,
    createdAt: serverTimestamp(),
    ...(birthday && { birthday }),
    ...(extras?.nickname && { nickname: extras.nickname }),
  });
}

/** The name shown to players: the nickname, or the id for accounts made before nicknames. */
export const displayName = (p: {
  username: string;
  nickname?: string | null;
}) => p.nickname || p.username;

export function changeNickname(uid: string, nickname: string) {
  return updateDoc(profileRef(uid), { nickname: nickname.trim() });
}
