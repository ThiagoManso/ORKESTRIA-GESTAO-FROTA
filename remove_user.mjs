import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "orkestria-os-gestao-de-frota",
  appId: "1:23796532338:web:c6dfa3903bc060359eeeeb",
  apiKey: "AIzaSyDxhehxMBvx5C8TbfaKr25iaBRzT0B-pf8",
  authDomain: "orkestria-os-gestao-de-frota.firebaseapp.com",
  storageBucket: "orkestria-os-gestao-de-frota.firebasestorage.app",
  messagingSenderId: "23796532338"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, "ai-studio-orkestriaosbrass-d4be16bf-f869-4fdf-95ef-b446bd38bbb5");

async function removeUser() {
  const emailTarget = 'carolinebarbosa.97@outlook.com';
  console.log(`Searching for user with email: ${emailTarget}...`);
  const q = query(collection(db, 'system_users'), where('email', '==', emailTarget));
  const snap = await getDocs(q);
  
  if (snap.empty) {
    console.log('No user found with email:', emailTarget);
    process.exit(0);
  }

  for (const docSnap of snap.docs) {
    console.log(`Deleting user doc ID: ${docSnap.id}, data:`, docSnap.data());
    await deleteDoc(docSnap.ref);
    console.log(`Successfully deleted ${docSnap.id}`);
  }
  process.exit(0);
}

removeUser().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
