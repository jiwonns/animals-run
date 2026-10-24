import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';

import { pickFromBanner, type Banner, type DrawCount } from '@/constants/banners';
import type { Character } from '@/constants/characters';
import { REWARDS } from '@/constants/gacha.generated';

import { db } from './firebase';
import { drawLogRef, profileRef, type Profile } from './profile';
import { gradeCountsAfter, newRewards, type Reward } from './rewards';
import { BANNERS } from '@/constants/banners';
import { currentCatalog, loadRemoteCatalog } from './remote-catalog';

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

/** Price and pool only — poster/hero images change after an app update even when the offer did not. */
export function sameOffer(a: Banner, b: Banner) {
  return (
    a.id === b.id &&
    a.cost[1] === b.cost[1] &&
    a.cost[10] === b.cost[10] &&
    JSON.stringify(a.rates) === JSON.stringify(b.rates) &&
    JSON.stringify(a.characterIds ?? []) === JSON.stringify(b.characterIds ?? [])
  );
}

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
  // Fetch before every payment: prices/odds shown by the app and used by the server share a version.
  const displayedVersion = currentCatalog()?.version;
  const catalog = await loadRemoteCatalog();
  if (displayedVersion !== catalog?.version) throw new DrawError('뽑기 정보가 업데이트됐어요. 새 가격과 확률을 확인한 뒤 다시 눌러주세요.');
  const live = BANNERS.find((item) => item.id === banner.id);
  if (catalog) {
    if (!live) throw new DrawError('이 뽑기는 지금은 판매하지 않아요. 화면을 다시 열어주세요.');
    if (!sameOffer(live, banner)) throw new DrawError('판매 중인 뽑기 가격이나 확률이 바뀌었어요. 화면을 확인한 뒤 다시 눌러주세요.');
  }
  const offer = live ?? banner;
  return runTransaction(db, async (transaction) => {
    // Reading the version inside the payment transaction retries/rejects an admin update mid-draw.
    if (catalog) {
      const live = await transaction.get(doc(db,'gachaCatalog','live'));
      if (live.data()?.version !== catalog.version) throw new DrawError('뽑기 정보가 바뀌었어요. 다시 시도해주세요.');
    }
    const snapshot = await transaction.get(profileRef(uid));
    if (!snapshot.exists()) throw new DrawError('프로필을 찾을 수 없어요.');
    const profile = snapshot.data() as Profile;
    const tickets = profile.tickets ?? 0;
    const coinCost = payment === 'coins' ? offer.cost[count] : 0;
    const ticketCost = payment === 'tickets' ? count : 0;
    if (payment === 'tickets' && !acceptsTickets(offer)) throw new DrawError('이 뽑기는 뽑기권을 쓸 수 없어요.');
    if (profile.coins < coinCost) throw new DrawError('코인이 부족해요.');
    if (tickets < ticketCost) throw new DrawError('뽑기권이 부족해요.');

    const characters = { ...profile.characters };
    const results: DrawResult[] = [];
    for (let i = 0; i < count; i++) {
      const character = pickFromBanner(offer);
      const owned = characters[character.id] ?? 0;
      results.push({ character, isNew: owned === 0 });
      characters[character.id] = owned + 1;
    }

    const picks = results.map((r) => r.character.id);
    const gradeBefore = profile.gradeCounts ?? {};
    const gradeCounts = gradeCountsAfter(gradeBefore, picks);
    const drawCount = profile.drawCount + count;
    const rewards = newRewards(
      {
        characters: profile.characters,
        gradeCounts: gradeBefore,
        drawCount: profile.drawCount,
        auctionTrades: profile.auctionTrades ?? 0,
        arenaWins: profile.arenaWins ?? 0,
      },
      {
        characters,
        gradeCounts,
        drawCount,
        auctionTrades: profile.auctionTrades ?? 0,
        arenaWins: profile.arenaWins ?? 0,
      },
    );

    transaction.update(profileRef(uid), {
      coins: profile.coins - coinCost,
      characters,
      drawCount,
      lastDraw: picks,
      lastBanner: offer.id,
      tickets: tickets - ticketCost,
      gradeCounts,
    });
    transaction.set(drawLogRef(uid, drawCount), {
      banner: offer.id,
      picks,
      coins: coinCost,
      tickets: ticketCost,
      rewards,
      createdAt: serverTimestamp(),
    });
    return { results, rewards };
  });
}
