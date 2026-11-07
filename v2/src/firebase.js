// Shares the app (and App Check) with v1; adds Auth for v2.
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { app, db, useEmulator } from '../../src/firebase.js';

export { app, db };
export const auth = getAuth(app);
if (useEmulator) connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
