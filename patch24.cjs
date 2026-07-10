const fs = require('fs');
let code = fs.readFileSync('src/lib/services.ts', 'utf8');

code = code.replace(/status: \(invitedRole \|\| initialRole === 'admin'\) \? 'active' : 'pending'/g, "status: 'active'");

code = code.replace(/        role: initialRole,\n        status: 'active',/g, "        role: initialRole,\n        status: (invitedRole || initialRole === 'admin') ? 'active' : 'pending',");

fs.writeFileSync('src/lib/services.ts', code);
