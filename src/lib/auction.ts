import { collection, doc, runTransaction, serverTimestamp, type Timestamp } from 'firebase/firestore';

import { CHARACTER_BY_ID, type CharacterId, type Grade } from '@/constants/characters';
import { REWARDS } from '@/constants/gacha.generated';

import { db } from './firebase';
import { HomeError } from './home';
import { availableCopies } from './inventory';
import { displayName, profileRef, type Profile } from './profile';

export class AuctionError extends HomeError {}

export type AuctionListing = {
  id: string;
  seller: string;
  sellerName: string;
  character: CharacterId;
  price: number;
  createdAt: Timestamp | null;
};

export type AuctionBid = {
  id: string;
  buyer: string;
  buyerName: string;
  character: CharacterId;
  price: number;
  createdAt: Timestamp | null;
};

export type AuctionQuote = {
  quote: number;
  trades: number;
  lastPrice: number;
  updatedAt: Timestamp | null;
  /** UTC millis of the current KST 2-hour window start. */
  windowStart?: number;
  windowSum?: number;
  windowCount?: number;
  /** Trades that made the live 시세, shown after that window closes. */
  lastWindowCount?: number;
};

export type MarketBand = {
  quote: number;
  min: number;
  max: number;
  floor: number;
  ceil: number;
};

const AUCTION = REWARDS.auction;

export const listingsRef = () => collection(db, 'auctionListings');
export const listingRef = (id: string) => doc(listingsRef(), id);
export const bidsRef = () => collection(db, 'auctionBids');
export const bidRef = (id: string) => doc(bidsRef(), id);
export const quotesRef = () => collection(db, 'auctionQuotes');
export const quoteRef = (id: CharacterId) => doc(db, 'auctionQuotes', id);

function gradeOf(id: CharacterId): Grade {
  const character = CHARACTER_BY_ID[id];
  if (!character) throw new AuctionError('없는 동물이에요.');
  return character.grade;
}

/** 시세 and the 하한가/상한가 band a listing must sit inside. */
export function marketBand(id: CharacterId, stored: Pick<AuctionQuote, 'quote'> | null | undefined): MarketBand {
  const grade = gradeOf(id);
  const floor = AUCTION.floor[grade];
  const ceil = AUCTION.ceil[grade];
  const quote = Math.min(ceil, Math.max(floor, stored?.quote ?? AUCTION.quote[grade]));
  const min = Math.max(floor, Math.floor((quote * AUCTION.low) / 100));
  const max = Math.min(ceil, Math.ceil((quote * AUCTION.high) / 100));
  return { quote, min: Math.min(min, max), max: Math.max(min, max), floor, ceil };
}

export function isInBand(id: CharacterId, price: number, stored: Pick<AuctionQuote, 'quote'> | null | undefined) {
  const { min, max } = marketBand(id, stored);
  return price >= min && price <= max;
}

/** Cheapest in-band sell of this animal that `uid` did not post. */
export function cheapestAsk(
  listings: AuctionListing[],
  character: CharacterId,
  uid: string | undefined,
  stored: Pick<AuctionQuote, 'quote'> | null | undefined,
) {
  return listings
    .filter((row) => row.character === character && row.seller !== uid && isInBand(character, row.price, stored))
    .sort((a, b) => a.price - b.price || (a.createdAt?.toMillis() ?? 0) - (b.createdAt?.toMillis() ?? 0))[0];
}

/** Highest in-band buy order of this animal that `uid` did not post. */
export function highestBid(
  bids: AuctionBid[],
  character: CharacterId,
  uid: string | undefined,
  stored: Pick<AuctionQuote, 'quote'> | null | undefined,
) {
  return bids
    .filter((row) => row.character === character && row.buyer !== uid && isInBand(character, row.price, stored))
    .sort((a, b) => b.price - a.price || (a.createdAt?.toMillis() ?? 0) - (b.createdAt?.toMillis() ?? 0))[0];
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
export const AUCTION_WINDOW_MS = AUCTION.windowHours * 60 * 60 * 1000;

/** Start of the current 2-hour Korean-time slot, as UTC millis. */
export function auctionSlot(now = Date.now()) {
  return Math.floor((now + KST_OFFSET_MS) / AUCTION_WINDOW_MS) * AUCTION_WINDOW_MS - KST_OFFSET_MS;
}

export function nextAuctionSlot(now = Date.now()) {
  return auctionSlot(now) + AUCTION_WINDOW_MS;
}

/** Trades from the window that produced the current 시세. Hidden until that window closes. */
export function lastWindowVolume(quote?: Pick<AuctionQuote, 'lastWindowCount'> | null) {
  return quote?.lastWindowCount ?? 0;
}

export function lastWindowBoard(quotes: Partial<Record<CharacterId, AuctionQuote>>) {
  return Object.entries(quotes)
    .flatMap(([id, quote]) => {
      const count = lastWindowVolume(quote);
      return quote && count > 0 ? [{ id: id as CharacterId, quote: quote.quote, count }] : [];
    })
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
}

function clampQuote(id: CharacterId, value: number) {
  const { floor, ceil } = marketBand(id, { quote: value });
  return Math.min(ceil, Math.max(floor, value));
}

function settledQuote(id: CharacterId, stored: AuctionQuote | null | undefined) {
  const count = stored?.windowCount ?? 0;
  const current = stored?.quote ?? AUCTION.quote[gradeOf(id)];
  return count === 0 ? current : clampQuote(id, Math.round((stored?.windowSum ?? 0) / count));
}

/** Apply one trade: keep 시세 in the current window, or roll the last window's average first. */
export function quoteAfterTrade(id: CharacterId, stored: AuctionQuote | null | undefined, price: number, now = Date.now()) {
  const slot = auctionSlot(now);
  const same = (stored?.windowStart ?? 0) === slot;
  return {
    quote: same ? (stored?.quote ?? AUCTION.quote[gradeOf(id)]) : settledQuote(id, stored),
    trades: (stored?.trades ?? 0) + 1,
    lastPrice: price,
    windowStart: slot,
    windowSum: same ? (stored?.windowSum ?? 0) + price : price,
    windowCount: same ? (stored?.windowCount ?? 0) + 1 : 1,
    lastWindowCount: same ? (stored?.lastWindowCount ?? 0) : (stored?.windowCount ?? 0),
  };
}

export function listOnAuction(uid: string, id: CharacterId, price: number) {
  if (!CHARACTER_BY_ID[id] || !Number.isSafeInteger(price)) throw new AuctionError('등록 정보를 확인해주세요.');
  const reference = doc(listingsRef());
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(profileRef(uid));
    const quoteSnap = await tx.get(quoteRef(id));
    if (!snap.exists()) throw new AuctionError('프로필을 찾을 수 없어요.');
    const profile = snap.data() as Profile;
    if (availableCopies(profile, id) < 1) {
      throw new AuctionError('대표 동물 1마리는 남겨두고, 여분을 등록해주세요.');
    }
    const band = marketBand(id, quoteSnap.exists() ? (quoteSnap.data() as AuctionQuote) : null);
    if (price < band.min || price > band.max) {
      throw new AuctionError(`지금은 ${band.min}~${band.max}코인 사이에서만 등록할 수 있어요.`);
    }
    const characters = { ...profile.characters };
    const remaining = (characters[id] ?? 0) - 1;
    if (remaining) characters[id] = remaining;
    else delete characters[id];
    tx.set(reference, {
      seller: uid,
      sellerName: displayName(profile),
      character: id,
      price,
      createdAt: serverTimestamp(),
    });
    tx.update(profileRef(uid), {
      characters,
      lastAuction: { id: reference.id, action: 'list', character: id, price },
    });
    return reference.id;
  });
}

export function cancelListing(uid: string, listingId: string) {
  const reference = listingRef(listingId);
  return runTransaction(db, async (tx) => {
    const [listingSnap, profileSnap] = await Promise.all([tx.get(reference), tx.get(profileRef(uid))]);
    if (!listingSnap.exists() || !profileSnap.exists()) throw new AuctionError('등록을 찾을 수 없어요.');
    const listing = listingSnap.data() as Omit<AuctionListing, 'id'>;
    if (listing.seller !== uid) throw new AuctionError('내가 올린 등록만 취소할 수 있어요.');
    const profile = profileSnap.data() as Profile;
    const characters = { ...profile.characters };
    characters[listing.character] = (characters[listing.character] ?? 0) + 1;
    tx.delete(reference);
    tx.update(profileRef(uid), {
      characters,
      lastAuction: { id: listingId, action: 'cancel', character: listing.character, price: listing.price },
    });
  });
}

export function buyListing(uid: string, listingId: string) {
  const reference = listingRef(listingId);
  return runTransaction(db, async (tx) => {
    const listingSnap = await tx.get(reference);
    if (!listingSnap.exists()) throw new AuctionError('이미 거래된 등록이에요.');
    const listing = listingSnap.data() as Omit<AuctionListing, 'id'>;
    if (listing.seller === uid) throw new AuctionError('내가 올린 등록은 살 수 없어요.');
    const [buyerSnap, sellerSnap, quoteSnap] = await Promise.all([
      tx.get(profileRef(uid)),
      tx.get(profileRef(listing.seller)),
      tx.get(quoteRef(listing.character)),
    ]);
    if (!buyerSnap.exists() || !sellerSnap.exists()) throw new AuctionError('프로필을 찾을 수 없어요.');
    const buyer = buyerSnap.data() as Profile;
    const seller = sellerSnap.data() as Profile;
    if (buyer.coins < listing.price) throw new AuctionError('코인이 부족해요.');
    const stored = quoteSnap.exists() ? (quoteSnap.data() as AuctionQuote) : null;
    if (!isInBand(listing.character, listing.price, stored)) {
      throw new AuctionError('시세가 바뀌어 이 가격으로는 살 수 없어요. 등록이 취소되길 기다려주세요.');
    }
    const characters = { ...buyer.characters };
    characters[listing.character] = (characters[listing.character] ?? 0) + 1;
    const receipt = { id: listingId, character: listing.character, price: listing.price };
    tx.delete(reference);
    tx.update(profileRef(uid), {
      characters,
      coins: buyer.coins - listing.price,
      lastAuction: { ...receipt, action: 'buy' },
    });
    tx.update(profileRef(listing.seller), {
      coins: seller.coins + listing.price,
      lastAuction: { ...receipt, action: 'sell' },
    });
    const next = quoteAfterTrade(listing.character, stored, listing.price);
    tx.set(quoteRef(listing.character), {
      ...next,
      updatedAt: stored && (stored.windowStart ?? 0) === next.windowStart ? stored.updatedAt : serverTimestamp(),
    });
  });
}

export function placeBid(uid: string, id: CharacterId, price: number) {
  if (!CHARACTER_BY_ID[id] || !Number.isSafeInteger(price)) throw new AuctionError('등록 정보를 확인해주세요.');
  const reference = doc(bidsRef());
  return runTransaction(db, async (tx) => {
    const [snap, quoteSnap] = await Promise.all([tx.get(profileRef(uid)), tx.get(quoteRef(id))]);
    if (!snap.exists()) throw new AuctionError('프로필을 찾을 수 없어요.');
    const profile = snap.data() as Profile;
    if (profile.coins < price) throw new AuctionError('코인이 부족해요.');
    const band = marketBand(id, quoteSnap.exists() ? (quoteSnap.data() as AuctionQuote) : null);
    if (price < band.min || price > band.max) {
      throw new AuctionError(`지금은 ${band.min}~${band.max}코인 사이에서만 걸어둘 수 있어요.`);
    }
    tx.set(reference, {
      buyer: uid,
      buyerName: displayName(profile),
      character: id,
      price,
      createdAt: serverTimestamp(),
    });
    tx.update(profileRef(uid), {
      coins: profile.coins - price,
      lastAuction: { id: reference.id, action: 'bid', character: id, price },
    });
    return reference.id;
  });
}

export function cancelBid(uid: string, bidId: string) {
  const reference = bidRef(bidId);
  return runTransaction(db, async (tx) => {
    const [bidSnap, profileSnap] = await Promise.all([tx.get(reference), tx.get(profileRef(uid))]);
    if (!bidSnap.exists() || !profileSnap.exists()) throw new AuctionError('구매희망을 찾을 수 없어요.');
    const bid = bidSnap.data() as Omit<AuctionBid, 'id'>;
    if (bid.buyer !== uid) throw new AuctionError('내가 건 구매희망만 취소할 수 있어요.');
    const profile = profileSnap.data() as Profile;
    tx.delete(reference);
    tx.update(profileRef(uid), {
      coins: profile.coins + bid.price,
      lastAuction: { id: bidId, action: 'cancelBid', character: bid.character, price: bid.price },
    });
  });
}

export function fillBid(uid: string, bidId: string) {
  const reference = bidRef(bidId);
  return runTransaction(db, async (tx) => {
    const bidSnap = await tx.get(reference);
    if (!bidSnap.exists()) throw new AuctionError('이미 거래된 구매희망이에요.');
    const bid = bidSnap.data() as Omit<AuctionBid, 'id'>;
    if (bid.buyer === uid) throw new AuctionError('내가 건 구매희망에는 팔 수 없어요.');
    const [sellerSnap, buyerSnap, quoteSnap] = await Promise.all([
      tx.get(profileRef(uid)),
      tx.get(profileRef(bid.buyer)),
      tx.get(quoteRef(bid.character)),
    ]);
    if (!sellerSnap.exists() || !buyerSnap.exists()) throw new AuctionError('프로필을 찾을 수 없어요.');
    const seller = sellerSnap.data() as Profile;
    const buyer = buyerSnap.data() as Profile;
    if (availableCopies(seller, bid.character) < 1) {
      throw new AuctionError('대표 동물 1마리는 남겨두고, 여분을 팔아주세요.');
    }
    const stored = quoteSnap.exists() ? (quoteSnap.data() as AuctionQuote) : null;
    if (!isInBand(bid.character, bid.price, stored)) {
      throw new AuctionError('시세가 바뀌어 이 가격으로는 팔 수 없어요. 구매희망이 취소되길 기다려주세요.');
    }
    const sold = { ...seller.characters };
    const remaining = (sold[bid.character] ?? 0) - 1;
    if (remaining) sold[bid.character] = remaining;
    else delete sold[bid.character];
    const received = { ...buyer.characters };
    received[bid.character] = (received[bid.character] ?? 0) + 1;
    const receipt = { id: bidId, character: bid.character, price: bid.price };
    tx.delete(reference);
    tx.update(profileRef(uid), {
      characters: sold,
      coins: seller.coins + bid.price,
      lastAuction: { ...receipt, action: 'fill' },
    });
    tx.update(profileRef(bid.buyer), {
      characters: received,
      lastAuction: { ...receipt, action: 'filled' },
    });
    const next = quoteAfterTrade(bid.character, stored, bid.price);
    tx.set(quoteRef(bid.character), {
      ...next,
      updatedAt: stored && (stored.windowStart ?? 0) === next.windowStart ? stored.updatedAt : serverTimestamp(),
    });
  });
}

/** Close an expired window so 시세 becomes that window's average even if nobody just traded. */
export function settleQuote(id: CharacterId) {
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(quoteRef(id));
    if (!snap.exists()) return;
    const stored = snap.data() as AuctionQuote;
    const slot = auctionSlot();
    if ((stored.windowStart ?? 0) >= slot) return;
    tx.update(quoteRef(id), {
      quote: settledQuote(id, stored),
      trades: stored.trades,
      lastPrice: stored.lastPrice,
      windowStart: slot,
      windowSum: 0,
      windowCount: 0,
      lastWindowCount: stored.windowCount ?? 0,
      updatedAt: serverTimestamp(),
    });
  });
}
