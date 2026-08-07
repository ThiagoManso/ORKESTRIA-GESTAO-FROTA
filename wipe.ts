import { collection, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from './src/lib/firebase';

const wipe = async () => {
  const collections = ['vehicles', 'drivers', 'routes'];
  for (const c of collections) {
    const snap = await getDocs(collection(db, c));
    for (const doc of snap.docs) {
      await deleteDoc(doc.ref);
    }
  }
  console.log('Wiped');
};
wipe();
