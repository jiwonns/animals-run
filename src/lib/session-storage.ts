import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SessionLease } from './session-lease';

const key = (uid: string) => `auth:session:${uid}`;
export async function readSession(uid: string): Promise<SessionLease | null> {
  const raw = await AsyncStorage.getItem(key(uid));
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (value.uid === uid && typeof value.sessionId === 'string' && /^[A-Za-z0-9_-]{20,128}$/.test(value.sessionId)
      && Number.isSafeInteger(value.authTime) && value.authTime > 0) return value;
  } catch { /* A damaged local record must never claim another session. */ }
  await AsyncStorage.removeItem(key(uid));
  return null;
}
export const writeSession = (lease: SessionLease) => AsyncStorage.setItem(key(lease.uid), JSON.stringify(lease));
export const removeSession = (uid: string) => AsyncStorage.removeItem(key(uid));
