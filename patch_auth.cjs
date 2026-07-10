const fs = require('fs');
let code = fs.readFileSync('src/lib/AuthContext.tsx', 'utf8');

if (!code.includes('GoogleAuthProvider')) {
  code = code.replace(/import \{ User, onAuthStateChanged, signInWithPopup, signOut \} from 'firebase\/auth';/, "import { User, onAuthStateChanged, signInWithPopup, signOut, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';");
}

code = code.replace(/const \{ [^\}]+ \} = await import\('firebase\/auth'\);/g, '');

fs.writeFileSync('src/lib/AuthContext.tsx', code);
