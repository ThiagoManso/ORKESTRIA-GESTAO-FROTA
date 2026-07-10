const fs = require('fs');
let code = fs.readFileSync('src/lib/services.ts', 'utf8');

code = code.replace(/writeBatch\n  getDoc,/, 'writeBatch,\n  getDoc,');
code = code.replace(/writeBatch\r?\n  getDoc,/, 'writeBatch,\n  getDoc,');

fs.writeFileSync('src/lib/services.ts', code);
