import { onIdTokenChanged, signOut as firebaseSignOut, type User } from 'firebase/auth';
import { onSnapshot, updateDoc } from 'firebase/firestore';
import { createContext, use, useEffect, useState, type ReactNode } from 'react';

import { isLeaving } from '@/lib/account';
import { pendingSignUpFor, usernameFromEmail } from '@/lib/auth';
import { auth } from '@/lib/firebase-auth';
import { claimsRef, createProfile, profileRef, type Profile } from '@/lib/profile';
import { activateSession, forgetSession, isSessionChanging, isSessionSigningOut, sessionRef, waitForSessionLogin } from '@/lib/session-lease';

type SessionContextValue = {
  user: User | null;
  loading: boolean;
  /** Live copy of users/{uid}; null until the first snapshot arrives. */
  profile: Profile | null;
  /** Ids of claimed achievements (users/{uid}/claims); null until the first snapshot arrives. */
  claimed: ReadonlySet<string> | null;
  /** Reading claims was refused, usually because the deployed firestore.rules are out of date. */
  claimsFailed: boolean;
  notice: string | null;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [sessionEpoch, setSessionEpoch] = useState(0);
  const [profileState, setProfileState] = useState<{ uid: string; profile: Profile } | null>(null);
  const [claimedState, setClaimedState] = useState<{
    uid: string;
    ids: ReadonlySet<string>;
    failed: boolean;
  } | null>(null);
  const uid = user?.uid;
  const profile = profileState && profileState.uid === uid ? profileState.profile : null;
  const current = claimedState && claimedState.uid === uid ? claimedState : null;
  const claimed = current && !current.failed ? current.ids : null;
  const claimsFailed = current?.failed ?? false;

  useEffect(() => {
    let revision = 0; let cancelled = false; let readyUid: string | null = null;
    let detach = () => {};
    const off = onIdTokenChanged(auth, next => {
      const currentRevision = ++revision;
      detach(); detach = () => {};
      if (!next) {
        readyUid = null; forgetSession(); setUser(null); setProfileState(null); setClaimedState(null); setLoading(false);
        return;
      }
      if (readyUid !== next.uid) setLoading(true);
      const valid = () => !cancelled && revision === currentRevision && auth.currentUser?.uid === next.uid;
      const expire = (message: string) => {
        if (!valid() || isLeaving()) return;
        if (!isSessionSigningOut()) setNotice(message);
        readyUid = null; setUser(null); setProfileState(null); setClaimedState(null); setLoading(false);
        void firebaseSignOut(auth).catch(() => {});
      };
      void (async () => {
        try {
          await waitForSessionLogin();
          if (!valid()) return;
          const lease = await activateSession(next);
          if (!valid()) return;
          detach = onSnapshot(sessionRef(next.uid), snapshot => {
            if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
            const data = snapshot.data();
            if (!snapshot.exists() || !data?.active || data.sessionId !== lease.sessionId || data.authTime !== lease.authTime) {
              expire('다른 기기에서 로그인해 이 기기의 접속이 종료됐어요. 다시 로그인해주세요.');
            }
          }, () => expire('로그인 세션을 확인하지 못했어요. 연결을 확인하고 다시 로그인해주세요.'));
          readyUid = next.uid; setNotice(null); setUser(next); setSessionEpoch(value => value + 1); setLoading(false);
        } catch { expire('로그인 세션을 확인하지 못했어요. 연결을 확인하고 다시 로그인해주세요.'); }
      })();
    });
    return () => { cancelled = true; revision++; off(); detach(); };
  }, []);

  useEffect(() => {
    if (!user) return;
    const { uid } = user;
    return onSnapshot(profileRef(uid), (snapshot) => {
      const username = usernameFromEmail(user.email);
      if (snapshot.exists()) {
        const profile = snapshot.data() as Profile;
        setProfileState({ uid, profile });
        // An id change that stopped between the account and the profile finishes here.
        if (profile.username !== username && !snapshot.metadata.hasPendingWrites) {
          updateDoc(profileRef(uid), { username }).catch(() => {});
        }
      } else if (!isLeaving() && !snapshot.metadata.fromCache) {
        void createProfile(uid, username, pendingSignUpFor(username)).catch(() => {
          setNotice('프로필을 준비하지 못했어요. 다시 로그인해주세요.');
          void firebaseSignOut(auth).catch(() => {});
        });
      }
    }, () => {
      if (isLeaving() || isSessionSigningOut() || isSessionChanging()) return;
      setNotice('로그인이 만료되었거나 다른 기기에서 접속했어요. 다시 로그인해주세요.');
      void firebaseSignOut(auth).catch(() => {});
    });
  }, [user, sessionEpoch]);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      claimsRef(uid),
      (snapshot) => setClaimedState({ uid, ids: new Set(snapshot.docs.map((d) => d.id)), failed: false }),
      () => setClaimedState({ uid, ids: new Set(), failed: true }),
    );
  }, [uid, sessionEpoch]);

  return <SessionContext value={{ user, loading, profile, claimed, claimsFailed, notice }}>{children}</SessionContext>;
}

export function useSession() {
  const value = use(SessionContext);
  if (!value) throw new Error('useSession must be used inside <SessionProvider>');
  return value;
}
