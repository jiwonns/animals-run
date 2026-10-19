import type { User } from 'firebase/auth';
import { collection, doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export type SessionLease = { uid: string; sessionId: string; authTime: number };
export class SessionCollision extends Error {}
export class SessionExpired extends Error {}
export const sessionRef = (uid: string) => doc(db, 'activeSessions', uid);
let local: SessionLease | null = null;
let pendingLogin: Promise<void> | null = null;
let signingOut = false;
const inflight = new Map<string, Promise<SessionLease>>();

export function beginSessionLogin() {
  if (pendingLogin) return null;
  let finish!: () => void;
  const pending = new Promise<void>(resolve => { finish = resolve; });
  pendingLogin = pending;
  return () => { if (pendingLogin === pending) pendingLogin = null; finish(); };
}
export const waitForSessionLogin = () => pendingLogin ?? Promise.resolve();
export const isSessionSigningOut = () => signingOut;
export const isSessionChanging = () => pendingLogin !== null || inflight.size > 0;
export const setSessionSigningOut = (value: boolean) => { signingOut = value; };
export const forgetSession = () => { local = null; };

export async function activateSession(user: User): Promise<SessionLease> {
  const token = await user.getIdTokenResult();
  const authTime = Number(token.claims.auth_time);
  if (!Number.isSafeInteger(authTime) || authTime <= 0) throw new Error('로그인 정보를 확인하지 못했어요.');
  if (local?.uid !== user.uid) local = { uid: user.uid, authTime, sessionId: doc(collection(db, 'activeSessions')).id };
  const lease = { ...local, authTime };
  const key = `${lease.uid}:${authTime}:${lease.sessionId}`;
  const existing = inflight.get(key);
  if (existing) return existing;
  const operation = runTransaction(db, async tx => {
    const ref = sessionRef(user.uid);
    const snapshot = await tx.get(ref);
    if (snapshot.exists()) {
      const current = snapshot.data();
      if (current.authTime > authTime) throw new SessionExpired('다른 기기에서 로그인했어요. 다시 로그인해주세요.');
      if (current.authTime === authTime) {
        if (current.sessionId !== lease.sessionId || !current.active) throw new SessionCollision('새 로그인 정보를 확인하고 있어요.');
        return lease;
      }
    }
    tx.set(ref, { sessionId: lease.sessionId, authTime, active: true, updatedAt: serverTimestamp() });
    return lease;
  }).then(result => { if (local?.sessionId === result.sessionId) local = result; return result; });
  inflight.set(key, operation);
  try { return await operation; }
  finally { if (inflight.get(key) === operation) inflight.delete(key); }
}

export async function releaseSession() {
  const lease = local;
  if (!lease) return;
  await runTransaction(db, async tx => {
    const ref = sessionRef(lease.uid);
    const snapshot = await tx.get(ref);
    if (snapshot.exists() && snapshot.data().sessionId === lease.sessionId && snapshot.data().authTime === lease.authTime && snapshot.data().active) {
      tx.update(ref, { active: false, updatedAt: serverTimestamp() });
    }
  });
}
