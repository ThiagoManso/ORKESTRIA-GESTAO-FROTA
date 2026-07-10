const fs = require('fs');
let code = fs.readFileSync('src/lib/services.ts', 'utf8');

code = code.replace(/const handleFirestoreError = /, 'export const handleFirestoreError = ');

fs.writeFileSync('src/lib/services.ts', code);
