import { onSnapshot } from 'firebase/firestore';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { useRefreshRevision } from '@/lib/app-refresh';
import {
  auctionSlot,
  bidsRef,
  cancelBid,
  cancelListing,
  isInBand,
  listingsRef,
  quotesRef,
  settleQuote,
  type AuctionBid,
  type AuctionListing,
  type AuctionQuote,
} from '@/lib/auction';
import type { CharacterId } from '@/constants/characters';

/** Live sell listings, buy orders, and per-animal 시세. */
export function useAuction() {
  const revision = useRefreshRevision();
  const [listings, setListings] = useState<AuctionListing[] | null>(null);
  const [bids, setBids] = useState<AuctionBid[] | null>(null);
  const [quotes, setQuotes] = useState<Partial<Record<CharacterId, AuctionQuote>>>({});
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const stopListings = onSnapshot(
      listingsRef(),
      (snap) => {
        setListings(
          snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<AuctionListing, 'id'>) }))
            .sort((a, b) => a.price - b.price || (a.createdAt?.toMillis() ?? 0) - (b.createdAt?.toMillis() ?? 0)),
        );
        setFailed(false);
      },
      () => setFailed(true),
    );
    const stopBids = onSnapshot(
      bidsRef(),
      (snap) => {
        setBids(
          snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<AuctionBid, 'id'>) }))
            .sort((a, b) => b.price - a.price || (a.createdAt?.toMillis() ?? 0) - (b.createdAt?.toMillis() ?? 0)),
        );
      },
      () => setFailed(true),
    );
    const stopQuotes = onSnapshot(
      quotesRef(),
      (snap) => {
        setQuotes(
          Object.fromEntries(snap.docs.map((d) => [d.id, d.data() as AuctionQuote])) as Partial<
            Record<CharacterId, AuctionQuote>
          >,
        );
      },
      () => {},
    );
    return () => {
      stopListings();
      stopBids();
      stopQuotes();
    };
  }, [revision]);

  return { listings, bids, quotes, failed };
}

export function useMyListings(uid: string | undefined, listings: AuctionListing[] | null) {
  return useMemo(() => (uid ? (listings ?? []).filter((row) => row.seller === uid) : []), [listings, uid]);
}

export function useMyBids(uid: string | undefined, bids: AuctionBid[] | null) {
  return useMemo(() => (uid ? (bids ?? []).filter((row) => row.buyer === uid) : []), [bids, uid]);
}

/** Returns animals or coins when my posted price has left the live 하한가~상한가 band. */
export function useAuctionBandSweep(
  uid: string | undefined,
  listings: AuctionListing[] | null,
  bids: AuctionBid[] | null,
  quotes: Partial<Record<CharacterId, AuctionQuote>>,
) {
  const mineSell = useMyListings(uid, listings);
  const mineBuy = useMyBids(uid, bids);
  const busy = useRef(false);
  useEffect(() => {
    if (!uid || busy.current) return;
    const staleSell = mineSell.filter((row) => !isInBand(row.character, row.price, quotes[row.character]));
    const staleBuy = mineBuy.filter((row) => !isInBand(row.character, row.price, quotes[row.character]));
    if (!staleSell.length && !staleBuy.length) return;
    busy.current = true;
    Promise.all([
      ...staleSell.map((row) => cancelListing(uid, row.id).catch(() => null)),
      ...staleBuy.map((row) => cancelBid(uid, row.id).catch(() => null)),
    ]).then((results) => {
      const done = results.filter((value) => value !== null).length;
      if (!done) return;
      Alert.alert(
        '시세가 바뀌었어요',
        `가격 범위를 벗어난 등록 ${done}건을 취소했어요. 동물과 걸어 둔 코인은 돌아왔어요.`,
      );
    }).finally(() => {
      busy.current = false;
    });
  }, [mineBuy, mineSell, quotes, uid]);
}

/** Roll 시세 to the last 2-hour average once that Korean-time slot has ended. */
export function useAuctionQuoteSettle(quotes: Partial<Record<CharacterId, AuctionQuote>>) {
  const busy = useRef(false);
  useEffect(() => {
    const slot = auctionSlot();
    const stale = Object.entries(quotes).filter(([, quote]) => quote && (quote.windowStart ?? 0) < slot);
    if (!stale.length || busy.current) return;
    busy.current = true;
    Promise.all(stale.map(([id]) => settleQuote(id as CharacterId).catch(() => {}))).finally(() => {
      busy.current = false;
    });
  }, [quotes]);
}
