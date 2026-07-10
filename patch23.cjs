const fs = require('fs');
let code = fs.readFileSync('src/lib/services.ts', 'utf8');

code = code.replace(/status: 'active',/g, "status: (invitedRole || initialRole === 'admin') ? 'active' : 'pending',");

fs.writeFileSync('src/lib/services.ts', code);
