const fs = require('fs');
let code = fs.readFileSync('src/components/RoutePlanner.tsx', 'utf8');

code = code.replace(/routingPreference: 'TRAFFIC_AWARE',/, "routingPreference: 'TRAFFIC_AWARE' as any,");

fs.writeFileSync('src/components/RoutePlanner.tsx', code);
