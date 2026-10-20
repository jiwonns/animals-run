import { collection, doc, getDocs, serverTimestamp, setDoc, type Timestamp } from 'firebase/firestore';

import { CHARACTER_BY_ID, GRADES, type CharacterId, type Grade } from '@/constants/characters';

import { db } from './firebase';
import type { Profile } from './profile';

/** Profile counters copied onto the leaderboard. */
export const RANKING_COUNTS = ['hatchCount', 'evolveCount', 'fuseCount', 'recycleCount'] as const;
export type RankingCount = (typeof RANKING_COUNTS)[number];

/** rankings/{uid}: firestore.rules require these to match the player's profile exactly. */
export type RankingEntry = {
  username: string;
  nickname?: string;
  avatar: CharacterId | null;
  steps: number;
  characters: Partial<Record<CharacterId, number>>;
  updatedAt: Timestamp | null;
} & Record<RankingCount, number>;

const countsOf = (profile: Profile) =>
  Object.fromEntries(RANKING_COUNTS.map((key) => [key, profile[key] ?? 0])) as Record<RankingCount, number>;


export const rankingRef = (uid: string) => doc(db, 'rankings', uid);
export const rankingsRef = () => collection(db, 'rankings');

/** The profile numbers a ranking entry copies; compare these to skip writes that change nothing. */
export function rankingKey(profile: Profile) {
  return JSON.stringify([
    profile.username,
    profile.nickname ?? null,
    profile.avatar ?? null,
    profile.steps ?? 0,
    profile.characters,
    countsOf(profile),
  ]);
}

export function syncRanking(uid: string, profile: Profile) {
  return setDoc(rankingRef(uid), {
    username: profile.username,
    ...(profile.nickname && { nickname: profile.nickname }),
    avatar: profile.avatar ?? null,
    steps: profile.steps ?? 0,
    characters: profile.characters,
    ...countsOf(profile),
    updatedAt: serverTimestamp(),
  });
}

/** Entries written before a counter existed read it as 0. */
export async function fetchRankings(): Promise<(RankingEntry & { uid: string })[]> {
  const snapshot = await getDocs(rankingsRef());
  return snapshot.docs.map((d) => {
    const data = d.data() as Partial<RankingEntry>;
    return {
      uid: d.id,
      username: data.username ?? '',
      nickname: data.nickname,
      avatar: data.avatar ?? null,
      steps: data.steps ?? 0,
      characters: data.characters ?? {},
      updatedAt: data.updatedAt ?? null,
      ...(Object.fromEntries(RANKING_COUNTS.map((key) => [key, data[key] ?? 0])) as Record<RankingCount, number>),
    };
  });
}

/** Copies owned of each grade, counting duplicates. */
export function ownedByGrade(characters: RankingEntry['characters']): Record<Grade, number> {
  const counts = Object.fromEntries(Object.keys(GRADES).map((g) => [g, 0])) as Record<Grade, number>;
  for (const [id, count] of Object.entries(characters)) {
    const character = CHARACTER_BY_ID[id as CharacterId];
    if (character && count) counts[character.grade] += count;
  }
  return counts;
}
