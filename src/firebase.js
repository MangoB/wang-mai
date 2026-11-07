// Firebase web config is not a secret: access is controlled by firestore.rules, App Check and Auth.
import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyCOlauR1Eek5WxnA6GyO7Guv1XXQ6G6MR4',
  authDomain: 'wang-mai.firebaseapp.com',
  projectId: 'wang-mai',
  storageBucket: 'wang-mai.firebasestorage.app',
  messagingSenderId: '343822594853',
  appId: '1:343822594853:web:48f95f05d6b1239f7ca0cc',
};

// reCAPTCHA Enterprise site key (public). Registered for mangob.github.io only.
const RECAPTCHA_SITE_KEY = '6LeGyBMuAAAAACKIS6rXZErxQjcAJtChX4VdbSyH';

export const app = initializeApp(firebaseConfig);

// App Check proves requests come from this site. Other hosts (emulator, previews) run without it.
if (location.hostname === 'mangob.github.io') {
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  });
}

export const db = getFirestore(app);
export const auth = getAuth(app);

// Local development and CI talk to the Firebase Emulator, never to production.
export const useEmulator = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
if (useEmulator) {
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
}
