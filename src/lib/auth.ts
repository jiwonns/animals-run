import { FirebaseError } from 'firebase/app';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut as firebaseSignOut } from 'firebase/auth';

import { NICKNAME_PATTERN } from '@/constants/gacha.generated';

import { auth } from './firebase-auth';

/**
 * Firebase Auth requires an email, so each username maps to a synthetic address that is never mailed.
 * firestore.rules relies on this exact domain to tie a profile's username to its account.
 */
export const USERNAME_EMAIL_DOMAIN = 'users.animalsrun.local';

export const USERNAME_PATTERN = /^[a-z0-9_]{4,20}$/;
export const MIN_PASSWORD_LENGTH = 6;

export const normalize = (username: string) => username.trim().toLowerCase();
export const toEmail = (username: string) => `${normalize(username)}@${USERNAME_EMAIL_DOMAIN}`;

export function usernameFromEmail(email: string | null): string {
  return email?.split('@')[0] ?? '';
}

export function validateUsername(username: string): string | null {
  if (username.includes('@')) return '이메일 말고 아이디를 입력해주세요. (예: jwp0329)';
  return USERNAME_PATTERN.test(normalize(username))
    ? null
    : '아이디는 영문 소문자, 숫자, _ 조합 4~20자로 입력해주세요.';
}

export function validatePassword(password: string): string | null {
  return password.length >= MIN_PASSWORD_LENGTH ? null : `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 해요.`;
}

const ERROR_MESSAGES: Record<string, string> = {
  'auth/email-already-in-use': '이미 사용 중인 아이디예요.',
  'auth/invalid-credential': '아이디 또는 비밀번호가 맞지 않아요.',
  'auth/user-not-found': '가입되지 않은 아이디예요.',
  'auth/wrong-password': '비밀번호가 맞지 않아요.',
  'auth/requires-recent-login': '보안을 위해 다시 로그인한 뒤 시도해주세요.',
  'auth/weak-password': `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 해요.`,
  'auth/too-many-requests': '시도가 너무 많아요. 잠시 후 다시 해주세요.',
  'auth/network-request-failed': '네트워크 연결을 확인해주세요.',
  'auth/operation-not-allowed': 'Firebase 콘솔에서 이메일/비밀번호 로그인을 사용 설정해주세요.',
};

export function toMessage(error: unknown, fallback: string): string {
  if (error instanceof FirebaseError) return ERROR_MESSAGES[error.code] ?? `${fallback} (${error.code})`;
  return fallback;
}

export function validateNickname(nickname: string): string | null {
  return NICKNAME_PATTERN.test(nickname.trim()) ? null : '닉네임은 한글, 영문, 숫자, _ 조합 2~10자로 입력해주세요.';
}

export type SignUpExtras = { birthday: string; nickname: string };

/** What was typed at sign-up besides the id, waiting for the session to create the new account's profile. */
let pending: { username: string; extras: SignUpExtras } | null = null;

export function pendingSignUpFor(username: string): SignUpExtras | null {
  return pending?.username === username ? pending.extras : null;
}

export async function signUp(username: string, password: string, extras: SignUpExtras): Promise<string | null> {
  pending = { username: normalize(username), extras: { ...extras, nickname: extras.nickname.trim() } };
  try {
    await createUserWithEmailAndPassword(auth, toEmail(username), password);
    return null;
  } catch (error) {
    pending = null;
    return toMessage(error, '회원가입에 실패했어요.');
  }
}

export async function signIn(username: string, password: string): Promise<string | null> {
  try {
    await signInWithEmailAndPassword(auth, toEmail(username), password);
    return null;
  } catch (error) {
    return toMessage(error, '로그인에 실패했어요.');
  }
}

export function signOut() {
  return firebaseSignOut(auth);
}
