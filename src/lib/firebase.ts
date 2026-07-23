import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getMessaging, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  projectId: "orkestria-os-gestao-de-frota",
  appId: "1:23796532338:web:c6dfa3903bc060359eeeeb",
  apiKey: (import.meta as any).env?.VITE_FIREBASE_API_KEY || "AIzaSyDxhehxMBvx5C8TbfaKr25iaBRzT0B-pf8",
  authDomain: "orkestria-os-gestao-de-frota.firebaseapp.com",
  storageBucket: "orkestria-os-gestao-de-frota.firebasestorage.app",
  messagingSenderId: "23796532338"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, "ai-studio-orkestriaosbrass-d4be16bf-f869-4fdf-95ef-b446bd38bbb5");

import { enableMultiTabIndexedDbPersistence } from 'firebase/firestore';
enableMultiTabIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn('Multiple tabs open, persistence can only be enabled in one tab at a a time.');
  } else if (err.code === 'unimplemented') {
    console.warn('The current browser does not support all of the features required to enable persistence');
  }
});

export const auth = getAuth(app);
import { getStorage } from 'firebase/storage';
export const storage = getStorage(app);
import { getFunctions } from 'firebase/functions';
export const functions = getFunctions(app);

// Inicializa o Messaging apenas se for suportado pelo navegador
export const messaging = async () => {
  const supported = await isSupported();
  if (supported) {
    return getMessaging(app);
  }
  return null;
};
