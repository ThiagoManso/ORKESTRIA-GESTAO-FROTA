import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

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
export const auth = getAuth(app);
