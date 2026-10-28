// Firebase web config is not a secret: access is controlled by firestore.rules.
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyCOlauR1Eek5WxnA6GyO7Guv1XXQ6G6MR4',
  authDomain: 'wang-mai.firebaseapp.com',
  projectId: 'wang-mai',
  storageBucket: 'wang-mai.firebasestorage.app',
  messagingSenderId: '343822594853',
  appId: '1:343822594853:web:48f95f05d6b1239f7ca0cc',
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
