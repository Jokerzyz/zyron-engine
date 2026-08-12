import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyCIA_yKDZyo9nOLHh1nNCRh278ldPodplM',
  authDomain: 'zyronmatrix.firebaseapp.com',
  projectId: 'zyronmatrix',
  storageBucket: 'zyronmatrix.firebasestorage.app',
  messagingSenderId: '1021435323563',
  appId: '1:1021435323563:web:e698deddfba66c60d4c3ee',
};

export interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  authApi: typeof import('firebase/auth');
  firestoreApi: typeof import('firebase/firestore');
}

let servicesPromise: Promise<FirebaseServices> | null = null;

export function loadFirebaseServices(): Promise<FirebaseServices> {
  servicesPromise ??= Promise.all([
    import('firebase/app'),
    import('firebase/auth'),
    import('firebase/firestore'),
  ]).then(([appApi, authApi, firestoreApi]) => {
    const app = appApi.initializeApp(firebaseConfig);
    return {
      app,
      auth: authApi.getAuth(app),
      db: firestoreApi.getFirestore(app),
      authApi,
      firestoreApi,
    };
  }).catch((error: unknown) => {
    servicesPromise = null;
    throw error;
  });
  return servicesPromise;
}
