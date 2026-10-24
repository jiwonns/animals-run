import { onSnapshot } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';

import { useRefreshRevision } from '@/lib/app-refresh';
import {
  listingsRef,
  quotesRef,
  type AuctionListing,
  type AuctionQuote,
} from '@/lib/auction';
import type { CharacterId } from '@/constants/characters';

/** Live open listings and per-animal 시세. */
export function useAuction() {
  const revision = useRefreshRevision();
  const [listings, setListings] = useState<AuctionListing[] | null>(null);
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
      stopQuotes();
    };
  }, [revision]);

  return { listings, quotes, failed };
}

export function useMyListings(uid: string | undefined, listings: AuctionListing[] | null) {
  return useMemo(() => (uid ? (listings ?? []).filter((row) => row.seller === uid) : []), [listings, uid]);
}
