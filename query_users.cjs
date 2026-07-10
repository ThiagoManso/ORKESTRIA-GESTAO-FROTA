require('dotenv').config();
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const staticConfig = require('./firebase-applet-config.json');

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || staticConfig.apiKey,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || staticConfig.authDomain,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || staticConfig.projectId,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || staticConfig.storageBucket,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || staticConfig.messagingSenderId,
  appId: process.env.VITE_FIREBASE_APP_ID || staticConfig.appId,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID || staticConfig.measurementId
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, staticConfig.firestoreDatabaseId);

async function run() {
  const snap = await getDocs(collection(db, 'users'));
  snap.forEach(doc => {
    console.log(doc.id, doc.data());
  });
}
run();
