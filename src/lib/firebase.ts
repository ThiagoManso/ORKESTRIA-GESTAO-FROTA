import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer, getFirestore, terminate } from 'firebase/firestore';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import staticConfig from '../../firebase-applet-config.json';

// Use environment variables if available (prefixed with VITE_ for client-side)
// Fallback to the local config file if env vars are missing
const firebaseConfig = {
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY || staticConfig.apiKey)?.trim(),
  authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || staticConfig.authDomain)?.trim(),
  projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID || staticConfig.projectId)?.trim(),
  storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || staticConfig.storageBucket)?.trim(),
  messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || staticConfig.messagingSenderId)?.trim(),
  appId: (import.meta.env.VITE_FIREBASE_APP_ID || staticConfig.appId)?.trim(),
  measurementId: (import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || staticConfig.measurementId)?.trim()
};

const databaseId = (import.meta.env.VITE_FIREBASE_DATABASE_ID || staticConfig.firestoreDatabaseId)?.trim();
const app = initializeApp(firebaseConfig);

const initFirestore = (dbId?: string) => {
  try {
    return initializeFirestore(app, {
      experimentalForceLongPolling: true,
    }, dbId);
  } catch (e) {
    return getFirestore(app, dbId);
  }
};

export let db = initFirestore(databaseId && databaseId !== '(default)' ? databaseId : undefined);
export const auth = getAuth();

export const messaging = typeof window !== 'undefined' ? getMessaging(app) : null;

export const requestNotificationPermission = async () => {
  if (!messaging) return null;
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const { getToken } = await import('firebase/messaging');
      const token = await getToken(messaging, {
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY
      });
      return token;
    }
  } catch (error) {
    console.error("FCM Error:", error);
  }
  return null;
};

// No need to alert on every boot if connection fails briefly
async function testConnection() {
  try {
    const testDoc = doc(db, 'test', 'connection');
    await getDocFromServer(testDoc);
    console.log("[Firebase] Initial connection check: Online");
  } catch (error: any) {
    // Quietly log, it's expected in some environments or during cold start
    console.debug("[Firebase] Initial connection check: Waiting for network...");
  }
}

testConnection();
