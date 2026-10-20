import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
const cache = new Map<string, Promise<string>>();
export function loadGachaImage(uri: string): Promise<string> {
  if (!uri.startsWith('gacha-image:')) return Promise.resolve(uri);
  const id = uri.slice('gacha-image:'.length);
  if (!/^[A-Za-z0-9_-]{20}$/.test(id)) return Promise.reject(new Error('이미지 주소를 확인해주세요.'));
  let pending = cache.get(id);
  if (!pending) {
    pending = (async () => {
      const stored = await AsyncStorage.getItem(`gacha:image:${id}`).catch(() => null);
      if (stored) return stored;
      const snap = await getDoc(doc(db,'gachaImages',id));
      const data = snap.data()?.data;
      if (typeof data !== 'string' || !data.startsWith('data:image/png;base64,')) throw new Error('이미지를 불러오지 못했어요.');
      // Immutable image IDs: reusing a local copy avoids repeated Firestore reads.
      await AsyncStorage.setItem(`gacha:image:${id}`, data).catch(() => {});
      return data;
    })();
    cache.set(id,pending);
    pending.catch(()=>cache.delete(id));
    if (cache.size>32) cache.delete(cache.keys().next().value!);
  }
  return pending;
}
