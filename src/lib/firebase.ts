import { getApp, getApps, initializeApp } from "firebase/app";
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentMultipleTabManager,
  persistentLocalCache,
} from "firebase/firestore";
import { connectStorageEmulator, getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

/**
 * Firestore is initialized with persistent cache so the Photographer
 * screen can continue to enqueue writes while offline/spotty Wi‑Fi.
 */
const db = initializeFirestore(app, {
  // Enable multi-tab persistence so staff can open multiple consoles without
  // fighting for the persistence owner tab.
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
  // Safari sometimes blocks Firestore's streaming connections; this enables a
  // long-poll fallback so realtime updates still work there.
  experimentalAutoDetectLongPolling: true,
  useFetchStreams: false,
});

const storage = getStorage(app);

const useEmulator = process.env.NEXT_PUBLIC_FIREBASE_EMULATOR === "true";
if (useEmulator) {
  const host = process.env.FIRESTORE_EMULATOR_HOST?.split(":")[0] ?? "localhost";
  const port =
    Number(process.env.FIRESTORE_EMULATOR_HOST?.split(":")[1]) ||
    Number(process.env.FIRESTORE_EMULATOR_PORT) ||
    8080;
  const storagePort = Number(process.env.STORAGE_EMULATOR_PORT) || 9199;
  connectFirestoreEmulator(db, host, port);
  connectStorageEmulator(storage, host, storagePort);
}

export { app, db, storage };
