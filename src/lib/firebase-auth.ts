import { getAuth } from 'firebase/auth';

import { app } from './firebase';

// Match the installed app: reopening the browser also restores the signed-in account.
export const auth = getAuth(app);
