import { collection, doc, getDocsFromServer, onSnapshot, serverTimestamp, setDoc, type DocumentData, type QuerySnapshot, type Timestamp } from 'firebase/firestore';

import { CHARACTER_BY_ID, GRADES, type CharacterId, type Grade } from '@/constants/characters';

import { db } from './firebase';
import { displayName, type Profile } from './profile';

/** Profile counters copied onto the leaderboard. */
export const RANKING_COUNTS = ['hatchCount', 'evolveCount', 'fuseCount', 'recycleCount', 'auctionTrades', 'arenaWins'] as const;
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
  return rankingEntries(await getDocsFromServer(rankingsRef()));
}
export function watchRankings(next:(entries:(RankingEntry & {uid:string})[])=>void,onError:()=>void) {
  return onSnapshot(rankingsRef(),snapshot=>next(rankingEntries(snapshot)),onError);
}
function rankingEntries(snapshot:QuerySnapshot<DocumentData>): (RankingEntry & {uid:string})[] {
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

export type RankedRow = {
  uid: string;
  username: string;
  avatar: RankingEntry['avatar'];
  value: number;
  rank: number;
};

/** Highest first; tied players share a rank (1, 2, 2, 4). */
export function rankEntries(
  entries: (RankingEntry & { uid: string })[],
  valueOf: (entry: RankingEntry) => number,
): RankedRow[] {
  const rows = entries
    .map((entry) => ({
      uid: entry.uid,
      username: displayName(entry),
      avatar: entry.avatar,
      value: valueOf(entry),
      rank: 0,
    }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value);
  rows.forEach((row, i) => {
    row.rank = i > 0 && row.value === rows[i - 1].value ? rows[i - 1].rank : i + 1;
  });
  return rows;
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
