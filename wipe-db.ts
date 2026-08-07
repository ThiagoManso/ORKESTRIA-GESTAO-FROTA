import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from './src/lib/firebase'; // Adjust path if needed

async function wipeDatabase() {
  const collectionsToWipe = ['external_requests', 'dailyLogs', 'routes'];
  
  for (const collName of collectionsToWipe) {
    console.log(`Wiping collection: ${collName}...`);
    try {
      const collRef = collection(db, collName);
      const snapshot = await getDocs(collRef);
      let count = 0;
      for (const d of snapshot.docs) {
        await deleteDoc(doc(db, collName, d.id));
        count++;
      }
      console.log(`Deleted ${count} documents from ${collName}.`);
    } catch (e) {
      console.error(`Error wiping ${collName}:`, e);
    }
  }
  
  console.log('Done wiping test data.');
}

wipeDatabase();
