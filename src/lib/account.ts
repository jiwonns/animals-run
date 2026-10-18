import { FirebaseError } from 'firebase/app';
import {
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updateEmail,
  updatePassword,
  type User,
} from 'firebase/auth';
import { deleteDoc, getDocs, updateDoc, writeBatch, type CollectionReference } from 'firebase/firestore';

import { normalize, toEmail, toMessage, validatePassword, validateUsername } from './auth';
import { db } from './firebase';
import { auth } from './firebase-auth';
import { companionRef, eggsRef } from './home';
import { claimsRef, drawLogsRef, locationRef, profileRef } from './profile';
import { rankingRef } from './ranking';

/** While true the session must not recreate the profile it sees disappear. */
let leaving = false;
export const isLeaving = () => leaving;

function currentUser(): User {
  const user = auth.currentUser;
  if (!user?.email) throw new Error('로그인이 필요해요.');
  return user;
}

/** Sensitive account changes need a fresh sign-in; asking for the password covers that. */
async function reauthenticate(password: string) {
  const user = currentUser();
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email!, password));
  return user;
}

/** Each resolves to an error message, or null on success. */
export async function changePassword(current: string, next: string): Promise<string | null> {
  const invalid = validatePassword(next);
  if (invalid) return invalid;
  try {
    const user = await reauthenticate(current);
    await updatePassword(user, next);
    return null;
  } catch (error) {
    return toMessage(error, '비밀번호를 바꾸지 못했어요.');
  }
}

/**
 * The id is the account's email, so this changes the email and then the profile. Firebase only allows it
 * with email enumeration protection turned off (Authentication > Settings > User actions).
 */
export async function changeUsername(next: string, password: string): Promise<string | null> {
  const invalid = validateUsername(next);
  if (invalid) return invalid;
  const username = normalize(next);
  try {
    const user = await reauthenticate(password);
    if (user.email === toEmail(username)) return '지금 쓰는 아이디예요.';
    await updateEmail(user, toEmail(username));
    await user.getIdToken(true);
    await updateDoc(profileRef(user.uid), { username });
    return null;
  } catch (error) {
    if (error instanceof FirebaseError && error.code === 'auth/operation-not-allowed') {
      return '지금은 아이디를 바꿀 수 없어요. (Firebase 콘솔에서 이메일 열거 보호를 꺼야 해요)';
    }
    return toMessage(error, '아이디를 바꾸지 못했어요.');
  }
}

async function deleteAll(ref: CollectionReference) {
  const docs = (await getDocs(ref)).docs;
  for (let i = 0; i < docs.length; i += 400) {
    const batch = writeBatch(db);
    docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

/**
 * Deletes the profile first (firestore.rules only lets history go after it), then everything else the
 * player owns, then the sign-in account itself.
 */
export async function deleteAccount(password: string): Promise<string | null> {
  try {
    const user = await reauthenticate(password);
    const uid = user.uid;
    leaving = true;
    await deleteDoc(profileRef(uid));
    await Promise.all([
      deleteAll(drawLogsRef(uid)),
      deleteAll(claimsRef(uid)),
      deleteAll(eggsRef(uid)),
      deleteDoc(companionRef(uid)),
      deleteDoc(locationRef(uid)),
      deleteDoc(rankingRef(uid)),
    ]);
    await deleteUser(user);
    return null;
  } catch (error) {
    return toMessage(error, '회원탈퇴에 실패했어요.');
  } finally {
    leaving = false;
  }
}
