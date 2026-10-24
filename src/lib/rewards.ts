import { increment, serverTimestamp, writeBatch } from "firebase/firestore";

import {
  CHARACTER_BY_ID,
  CHARACTERS,
  COLLECTIONS,
  GRADE_ORDER,
  GRADES,
  type CharacterId,
  type Grade,
} from "@/constants/characters";
import { REWARDS } from "@/constants/gacha.generated";

import { db } from "./firebase";
import { claimRef, profileRef } from "./profile";

/**
 * An achievement and its free-ticket reward. Ids are what firestore.rules parses in claimReward(), e.g.
 * "char_count:tiger:5", so their format and amounts must stay in step with renderRules() in
 * scripts/generate-gacha.js.
 */
export type Reward = {
  id: string;
  label: string;
  tickets: number;
};

export type GradeCounts = Partial<Record<Grade, number>>;

export type ProgressState = {
  characters: Partial<Record<CharacterId, number>>;
  gradeCounts: GradeCounts;
  drawCount: number;
  auctionTrades: number;
  arenaWins: number;
};

export const characterReward = (grade: Grade) => ({
  ...REWARDS.character.default,
  ...REWARDS.character[grade],
});
export const gradeReward = (grade: Grade) => ({
  ...REWARDS.grade.default,
  ...REWARDS.grade[grade],
});

/** Listed milestones up to `count`, then every multiple of `every` that isn't already listed. */
function reached(count: number, milestones: number[], every: number) {
  const hit = milestones.filter((m) => m > 0 && m <= count);
  for (let m = every; m <= count; m += every)
    if (!milestones.includes(m)) hit.push(m);
  return hit.sort((a, b) => a - b);
}

/** The next milestone above `count`, for progress bars. */
export function nextMilestone(
  count: number,
  milestones: number[],
  every: number,
) {
  const listed = milestones.filter((m) => m > count).sort((a, b) => a - b)[0];
  const multiple = (Math.floor(count / every) + 1) * every;
  return listed === undefined ? multiple : Math.min(listed, multiple);
}

const owns = (state: ProgressState, id: CharacterId) =>
  (state.characters[id] ?? 0) > 0;

/** Every achievement `state` satisfies, claimed or not. */
export function earnedRewards(state: ProgressState): Reward[] {
  const rewards: Reward[] = [];

  for (const grade of GRADE_ORDER) {
    const { label } = GRADES[grade];
    const amounts = gradeReward(grade);
    if (CHARACTERS.some((c) => c.grade === grade && owns(state, c.id))) {
      rewards.push({
        id: `grade_first:${grade}`,
        label: `첫 ${label} 등급 획득`,
        tickets: amounts.first,
      });
    }
    for (const m of reached(
      state.gradeCounts[grade] ?? 0,
      [],
      REWARDS.grade.every,
    )) {
      rewards.push({
        id: `grade_count:${grade}:${m}`,
        label: `${label} 등급 ${m}마리`,
        tickets: amounts.every,
      });
    }
  }

  for (const character of CHARACTERS) {
    const count = state.characters[character.id] ?? 0;
    if (count === 0) continue;
    const amounts = characterReward(character.grade);
    rewards.push({
      id: `char_first:${character.id}`,
      label: `${character.name} 첫 획득`,
      tickets: amounts.first,
    });
    const { milestones, every } = REWARDS.character;
    for (const m of reached(count, milestones, every)) {
      rewards.push({
        id: `char_count:${character.id}:${m}`,
        label: `${character.name} ${m}마리`,
        tickets: milestones.includes(m) ? amounts.milestone : amounts.every,
      });
    }
  }

  for (const collection of COLLECTIONS) {
    if (
      CHARACTERS.every(
        (c) => c.collection !== collection.id || owns(state, c.id),
      )
    ) {
      rewards.push({
        id: `collection_complete:${collection.id}`,
        label: `${collection.name} 완성`,
        tickets: REWARDS.collectionComplete,
      });
    }
  }

  const { milestones, every, reward } = REWARDS.drawCount;
  for (const m of reached(state.drawCount, milestones, every)) {
    rewards.push({
      id: `draws:${m}`,
      label: `누적 ${m}회 뽑기`,
      tickets: reward,
    });
  }

  const auction = REWARDS.auctionTrades;
  for (const m of reached(state.auctionTrades, auction.milestones, auction.every)) {
    rewards.push({
      id: `auction_trades:${m}`,
      label: m === 1 ? '첫 경매 거래' : `경매 거래 ${m}회`,
      tickets: auction.reward,
    });
  }

  const arena = REWARDS.arenaWins;
  for (const m of reached(state.arenaWins, arena.milestones, arena.every)) {
    rewards.push({
      id: `arena_wins:${m}`,
      label: m === 1 ? '첫 결투 승리' : `결투 승리 ${m}회`,
      tickets: arena.reward,
    });
  }

  return rewards;
}

/** Achievements newly satisfied going from `before` to `after`. */
export function newRewards(
  before: ProgressState,
  after: ProgressState,
): Reward[] {
  const had = new Set(earnedRewards(before).map((r) => r.id));
  return earnedRewards(after).filter((r) => !had.has(r.id));
}

export function gradeCountsAfter(
  before: GradeCounts,
  picks: CharacterId[],
): GradeCounts {
  const counts: GradeCounts = { ...before };
  for (const id of picks) {
    const { grade } = CHARACTER_BY_ID[id];
    counts[grade] = (counts[grade] ?? 0) + 1;
  }
  return counts;
}

export const totalTickets = (rewards: Reward[]) =>
  rewards.reduce((sum, r) => sum + r.tickets, 0);

/** Adds the reward's tickets and records the claim; firestore.rules allows each achievement once. */
export async function claimReward(uid: string, reward: Reward) {
  const batch = writeBatch(db);
  batch.update(profileRef(uid), {
    tickets: increment(reward.tickets),
    lastClaim: reward.id,
  });
  batch.set(claimRef(uid, reward.id), {
    tickets: reward.tickets,
    label: reward.label,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
}

/** Claims one at a time (the rules check a single claim per write); stops at the first failure. */
export async function claimRewards(
  uid: string,
  rewards: Reward[],
  onProgress?: (done: number, total: number) => void,
): Promise<Reward[]> {
  const claimed: Reward[] = [];
  for (const reward of rewards) {
    try {
      await claimReward(uid, reward);
      claimed.push(reward);
      onProgress?.(claimed.length, rewards.length);
    } catch {
      break;
    }
  }
  return claimed;
}
