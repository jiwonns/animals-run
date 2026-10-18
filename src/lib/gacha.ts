import { runTransaction, serverTimestamp } from 'firebase/firestore';

import { pickFromBanner, type Banner, type DrawCount } from '@/constants/banners';
import type { Character } from '@/constants/characters';
import { REWARDS } from '@/constants/gacha.generated';

import { db } from './firebase';
import { drawLogRef, profileRef, type Profile } from './profile';
import { gradeCountsAfter, newRewards, type Reward } from './rewards';

export type DrawResult = {
  character: Character;
  isNew: boolean;
};

export type DrawOutcome = {
  results: DrawResult[];
  /** Achievements this draw unlocked; claim them with claimRewards(). */
  rewards: Reward[];
};

export type Payment = 'coins' | 'tickets';

export class DrawError extends Error {}

/** Tickets cover one draw each, on banners whose single draw costs at most REWARDS.ticketMaxCost coins. */
export const acceptsTickets = (banner: Banner) => banner.cost[1] <= REWARDS.ticketMaxCost;

/**
 * Pays with coins or tickets, adds characters and logs the draw atomically. firestore.rules rejects
 * any write whose cost or characters do not match a legal draw.
 */
export async function drawCharacters(
  uid: string,
  banner: Banner,
  count: DrawCount,
  payment: Payment,
): Promise<DrawOutcome> {
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(profileRef(uid));
    if (!snapshot.exists()) throw new DrawError('프로필을 찾을 수 없어요.');
    const profile = snapshot.data() as Profile;
    const tickets = profile.tickets ?? 0;
    const coinCost = payment === 'coins' ? banner.cost[count] : 0;
    const ticketCost = payment === 'tickets' ? count : 0;
    if (payment === 'tickets' && !acceptsTickets(banner)) throw new DrawError('이 뽑기는 뽑기권을 쓸 수 없어요.');
    if (profile.coins < coinCost) throw new DrawError('코인이 부족해요.');
    if (tickets < ticketCost) throw new DrawError('뽑기권이 부족해요.');

    const characters = { ...profile.characters };
    const results: DrawResult[] = [];
    for (let i = 0; i < count; i++) {
      const character = pickFromBanner(banner);
      const owned = characters[character.id] ?? 0;
      results.push({ character, isNew: owned === 0 });
      characters[character.id] = owned + 1;
    }

    const picks = results.map((r) => r.character.id);
    const gradeBefore = profile.gradeCounts ?? {};
    const gradeCounts = gradeCountsAfter(gradeBefore, picks);
    const drawCount = profile.drawCount + count;
    const rewards = newRewards(
      { characters: profile.characters, gradeCounts: gradeBefore, drawCount: profile.drawCount },
      { characters, gradeCounts, drawCount },
    );

    transaction.update(profileRef(uid), {
      coins: profile.coins - coinCost,
      characters,
      drawCount,
      lastDraw: picks,
      lastBanner: banner.id,
      tickets: tickets - ticketCost,
      gradeCounts,
    });
    transaction.set(drawLogRef(uid, drawCount), {
      banner: banner.id,
      picks,
      coins: coinCost,
      tickets: ticketCost,
      rewards,
      createdAt: serverTimestamp(),
    });
    return { results, rewards };
  });
}
