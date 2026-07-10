const fs = require('fs');
let code = fs.readFileSync('src/lib/services.ts', 'utf8');

code = code.replace(
  /const \{ getDoc, setDoc, updateDoc, query, collection, where, getDocs, deleteDoc \} = await import\('firebase\/firestore'\);/g,
  "import { getDoc, getDocs } from 'firebase/firestore';" // Wait, imports must be top level
);
