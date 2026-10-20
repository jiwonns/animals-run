import { doc, runTransaction, serverTimestamp, type Timestamp } from 'firebase/firestore';
import { CHARACTER_BY_ID, type CharacterId } from '@/constants/characters';
import { db } from './firebase';
import { displayName, profileRef, type Profile } from './profile';

export type BondRecord = { seconds: number; steps: number; since: Timestamp | null; stepStart: number };
export type Bonds = Partial<Record<CharacterId, BondRecord>>;
export const bondRef = (uid: string) => doc(db, 'bonds', uid);
export const BOND_LEVELS = [
  { name: '첫 만남', points: 0, phrase: '님을 조금씩 알아가고 있어요.' },
  { name: '익숙한 사이', points: 100, phrase: '님과 함께하는 산책을 기다리고 있어요.' },
  { name: '든든한 친구', points: 500, phrase: '님을 믿고 의지하고 있어요.' },
  { name: '마음의 단짝', points: 1500, phrase: '님과 함께라면 어디든 행복해요.' },
  { name: '평생의 동반자', points: 4000, phrase: '님을 세상에서 가장 소중한 가족으로 생각해요.' },
] as const;

export function bondStatus(profile: Profile, bonds: Bonds, now = Date.now()) {
  const id = profile.avatar;
  if (!id) return null;
  const record = bonds[id];
  const seconds = (record?.seconds ?? 0) + (record?.since ? Math.max(0, (now - record.since.toMillis()) / 1000) : 0);
  const steps = (record?.steps ?? 0) + (record?.since ? Math.max(0, (profile.steps ?? 0) - record.stepStart) : 0);
  const points = Math.floor(seconds / 3600) + Math.floor(steps / 100);
  const index = BOND_LEVELS.reduce((level, item, i) => points >= item.points ? i : level, 0);
  const level = BOND_LEVELS[index];
  return { points, level: index + 1, name: level.name, next: BOND_LEVELS[index + 1]?.points,
    message: `${CHARACTER_BY_ID[id].name} 친구는 ${displayName(profile)}${level.phrase}` };
}

/** Server timestamps count offline time too. A transaction settles the previous animal exactly once. */
export function selectCompanion(uid: string, avatar: CharacterId | null) {
  return runTransaction(db, async tx => {
    const [p, b] = await Promise.all([tx.get(profileRef(uid)), tx.get(bondRef(uid))]);
    const profile = p.data() as Profile;
    const records = (b.data()?.animals ?? {}) as Bonds;
    const old = (b.data()?.active ?? null) as CharacterId | null;
    if (old === avatar && (!avatar || records[avatar]?.since)) {
      if (profile.avatar !== avatar) tx.update(profileRef(uid), { avatar });
      return;
    }
    const animals = { ...records };
    if (old && records[old]?.since) {
      const record = records[old]!;
      animals[old] = { ...record, seconds: record.seconds + Math.max(0, Math.floor((Date.now() - record.since!.toMillis()) / 1000)),
        steps: record.steps + Math.max(0, (profile.steps ?? 0) - record.stepStart), since: null };
    }
    if (avatar) animals[avatar] = { seconds: animals[avatar]?.seconds ?? 0, steps: animals[avatar]?.steps ?? 0,
      stepStart: profile.steps ?? 0, since: serverTimestamp() as Timestamp };
    tx.set(bondRef(uid), { animals, active: avatar, updatedAt: serverTimestamp() });
    tx.update(profileRef(uid), { avatar });
  });
}
