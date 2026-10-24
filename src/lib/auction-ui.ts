import { GRADES, speciesOf, type Character, type CharacterId } from '@/constants/characters';

import type { AuctionBid, AuctionListing } from './auction';

export const AUCTION_SELL_COLOR = '#0EA5E9';
export const AUCTION_BID_COLOR = '#F59E0B';

const SPECIES_KO: Record<string, string> = {
  mouse: '쥐',
  cow: '소',
  tiger: '호랑이',
  rabbit: '토끼',
  dragon: '용',
  snake: '뱀',
  horse: '말',
  sheep: '양',
  monkey: '원숭이',
  chicken: '닭',
  dog: '강아지',
  pig: '돼지',
};

export function auctionSearchHit(character: Character, query: string) {
  const q = query.trim().toLocaleLowerCase();
  if (!q) return true;
  const species = speciesOf(character);
  return (
    character.name.toLocaleLowerCase().includes(q) ||
    GRADES[character.grade].label.toLocaleLowerCase().includes(q) ||
    species.toLocaleLowerCase().includes(q) ||
    (SPECIES_KO[species] ?? '').includes(q)
  );
}

export function listingsFor(listings: AuctionListing[] | null, id: CharacterId) {
  return (listings ?? []).filter((row) => row.character === id);
}

export function bidsFor(bids: AuctionBid[] | null, id: CharacterId) {
  return (bids ?? []).filter((row) => row.character === id);
}
