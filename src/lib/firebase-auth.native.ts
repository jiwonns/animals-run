import AsyncStorage from '@react-native-async-storage/async-storage';
import { getReactNativePersistence, initializeAuth } from 'firebase/auth';

import { app } from './firebase';

/** Without explicit persistence, React Native users would be signed out on every app restart. */
export const auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
