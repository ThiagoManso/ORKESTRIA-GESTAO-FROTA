const fs = require('fs');
let code = fs.readFileSync('vite.config.ts', 'utf8');

code = code.replace(/workbox: \{/, `workbox: {
          maximumFileSizeToCacheInBytes: 3000000,`);

fs.writeFileSync('vite.config.ts', code);
