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

export type AuctionQuote = {
  quote: number;
  trades: number;
  lastPrice: number;
  updatedAt: Timestamp | null;
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

/** Next 시세 after a trade at `price`; same integer math as firestore.rules. */
export function nextQuote(id: CharacterId, stored: Pick<AuctionQuote, 'quote'> | null | undefined, price: number) {
  const { floor, ceil } = marketBand(id, stored);
  const quote = stored?.quote ?? AUCTION.quote[gradeOf(id)];
  const next = Math.round((quote * (100 - AUCTION.weight) + price * AUCTION.weight) / 100);
  return Math.min(ceil, Math.max(floor, next));
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
    tx.set(quoteRef(listing.character), {
      quote: nextQuote(listing.character, stored, listing.price),
      trades: (stored?.trades ?? 0) + 1,
      lastPrice: listing.price,
      updatedAt: serverTimestamp(),
    });
  });
}
