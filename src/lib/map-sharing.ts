import { doc, runTransaction, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { locationRef } from './profile';

export type MapSharing = { sharing: boolean; audience: 'public' | 'friends' };
export const mapPreferencesRef = (uid: string) => doc(db, 'mapPreferences', uid);
/** Changing visibility also removes the old location atomically, so no public copy is left behind. */
export function saveMapSharing(uid: string, preference: MapSharing) {
  const batch = writeBatch(db);
  batch.set(mapPreferencesRef(uid), { ...preference, updatedAt: serverTimestamp() });
  batch.delete(locationRef(uid));
  return batch.commit();
}
export function initializeMapSharing(uid: string, sharing: boolean) {
  return runTransaction(db, async tx => {
    const snapshot = await tx.get(mapPreferencesRef(uid));
    if (snapshot.exists()) return;
    tx.set(mapPreferencesRef(uid), { sharing, audience: 'public', updatedAt: serverTimestamp() });
    tx.delete(locationRef(uid));
  });
}
