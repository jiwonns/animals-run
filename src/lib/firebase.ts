import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

import { firebaseConfig } from './firebase-config';

const missing = Object.entries(firebaseConfig).filter(([, value]) => !value);
if (missing.length) {
  throw new Error(
    `Firebase 설정이 비어 있어요 (${missing.map(([key]) => key).join(', ')}). .env.example을 .env로 복사하고 Firebase 콘솔의 웹 앱 설정값을 넣어주세요.`,
  );
}

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
