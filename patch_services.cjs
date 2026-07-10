const fs = require('fs');
let code = fs.readFileSync('src/lib/services.ts', 'utf8');

code = code.replace(
  /} from 'firebase\/firestore';/,
  "  getDoc,\n  getDocs\n} from 'firebase/firestore';"
);

fs.writeFileSync('src/lib/services.ts', code);
