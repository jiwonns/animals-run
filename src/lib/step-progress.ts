import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, doc, increment, runTransaction, serverTimestamp, setDoc } from 'firebase/firestore';
import { REWARDS } from '@/constants/gacha.generated';
import { db } from './firebase';
import { companionRef } from './home';
import { profileRef, type Profile } from './profile';

let devicePromise: Promise<string> | null = null;
export const newStepEpoch = () => doc(collection(db, 'stepDevices')).id;
export function stepDeviceId() {
  return devicePromise ??= (async () => {
    const saved = await AsyncStorage.getItem('walk:deviceId');
    if (saved) return saved;
    const id = newStepEpoch();
    await AsyncStorage.setItem('walk:deviceId', id);
    return id;
  })().catch(error => { devicePromise = null; throw error; });
}
export const stepSyncsRef = (uid: string) => collection(db, 'users', uid, 'stepSync');
type Cursor = { epoch: string; count: number; credited: number };

/** A server cursor makes retrying after process termination or a lost response safe. */
export async function creditStepProgress(uid: string, tracker: string, epoch: string, count: number, baseline = 0, reset = false) {
  if (!Number.isSafeInteger(count) || count < 0 || !Number.isSafeInteger(baseline) || baseline < 0) throw new Error('잘못된 걸음 기록이에요.');
  const cursorRef = doc(stepSyncsRef(uid), tracker);
  const result = await runTransaction(db, async tx => {
    const [p, c] = await Promise.all([tx.get(profileRef(uid)), tx.get(cursorRef)]);
    if (!p.exists()) throw new Error('로그인이 필요해요.');
    const profile = p.data() as Profile;
    const cursor = c.data() as Cursor | undefined;
    if (cursor?.epoch === epoch && count <= cursor.count) return { added: 0, avatar: null };
    const previous = cursor?.epoch === epoch ? cursor.count : baseline;
    const added = reset ? 0 : Math.max(0, count - previous);
    tx.set(cursorRef, { epoch, count, credited: (cursor?.credited ?? 0) + added, updatedAt: serverTimestamp() });
    if (added) {
      const before = profile.steps ?? 0;
      const after = before + added;
      const coins = Math.floor(after / REWARDS.stepsPerCoin) - Math.floor(before / REWARDS.stepsPerCoin);
      tx.update(profileRef(uid), { steps: after, coins: profile.coins + coins });
    }
    return { added, avatar: profile.avatar ?? null };
  });
  if (result.added && result.avatar) void setDoc(companionRef(uid), { steps: { [result.avatar]: increment(result.added) } }, { merge: true }).catch(() => {});
  return result.added;
}
