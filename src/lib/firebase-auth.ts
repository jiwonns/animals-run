import { initializeAuth, inMemoryPersistence } from 'firebase/auth';

import { app } from './firebase';

// A new page/app process starts at sign-in; credentials are never restored from browser storage.
export const auth = initializeAuth(app, { persistence: inMemoryPersistence });
