import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { PERMANENT_MEDALS, RANKING_MEDALS, medalsRef, rankingMedalHolder } from './medals';
import { fetchRankings, type RankingEntry } from './ranking';

export type DisplayMedal = { id: string; name: string; description: string; temporary: boolean };
export const medalDisplayRef = (uid: string) => doc(db, 'medalDisplays', uid);

export function ownedMedals(uid: string, claimed: ReadonlySet<string>, entries: (RankingEntry & { uid: string })[]): DisplayMedal[] {
  return [
    ...RANKING_MEDALS.filter(m => rankingMedalHolder(entries, m) === uid).map(m => ({ ...m, temporary: true })),
    ...PERMANENT_MEDALS.filter(m => claimed.has(m.id)).map(m => ({ ...m, temporary: false })),
  ];
}

/** A saved preference never displays a crown after its owner loses first place. */
export const equippedMedal = (id: string | null, medals: DisplayMedal[]) => medals.find(m => m.id === id) ?? null;

export async function equipMedal(uid: string, id: string | null) {
  if (id !== null) {
    const permanent = PERMANENT_MEDALS.find(m => m.id === id);
    const crown = RANKING_MEDALS.find(m => m.id === id);
    const owns = permanent ? (await getDoc(doc(medalsRef(uid), id))).exists()
      : crown ? rankingMedalHolder(await fetchRankings(), crown) === uid : false;
    if (!owns) throw new Error('현재 보유한 훈장만 장착할 수 있어요.');
  }
  return setDoc(medalDisplayRef(uid), { medalId: id, updatedAt: serverTimestamp() });
}
