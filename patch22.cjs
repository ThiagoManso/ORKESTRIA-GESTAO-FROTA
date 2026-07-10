const fs = require('fs');
let code = fs.readFileSync('src/types.ts', 'utf8');

code = code.replace(/status: 'active' \| 'inactive';/, "status: 'active' | 'inactive' | 'pending';");

fs.writeFileSync('src/types.ts', code);
