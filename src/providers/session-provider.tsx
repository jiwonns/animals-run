import { onAuthStateChanged, type User } from 'firebase/auth';
import { onSnapshot, updateDoc } from 'firebase/firestore';
import { createContext, use, useEffect, useState, type ReactNode } from 'react';

import { isLeaving } from '@/lib/account';
import { pendingSignUpFor, usernameFromEmail } from '@/lib/auth';
import { auth } from '@/lib/firebase-auth';
import { claimsRef, createProfile, profileRef, type Profile } from '@/lib/profile';

type SessionContextValue = {
  user: User | null;
  loading: boolean;
  /** Live copy of users/{uid}; null until the first snapshot arrives. */
  profile: Profile | null;
  /** Ids of claimed achievements (users/{uid}/claims); null until the first snapshot arrives. */
  claimed: ReadonlySet<string> | null;
  /** Reading claims was refused, usually because the deployed firestore.rules are out of date. */
  claimsFailed: boolean;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
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

  useEffect(
    () =>
      onAuthStateChanged(auth, (next) => {
        setUser(next);
        setLoading(false);
      }),
    [],
  );

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
      } else if (!isLeaving()) {
        createProfile(uid, username, pendingSignUpFor(username));
      }
    });
  }, [user]);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      claimsRef(uid),
      (snapshot) => setClaimedState({ uid, ids: new Set(snapshot.docs.map((d) => d.id)), failed: false }),
      () => setClaimedState({ uid, ids: new Set(), failed: true }),
    );
  }, [uid]);

  return <SessionContext value={{ user, loading, profile, claimed, claimsFailed }}>{children}</SessionContext>;
}

export function useSession() {
  const value = use(SessionContext);
  if (!value) throw new Error('useSession must be used inside <SessionProvider>');
  return value;
}
