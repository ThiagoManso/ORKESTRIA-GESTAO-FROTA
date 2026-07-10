const fs = require('fs');
let code = fs.readFileSync('src/components/RoutePlanner.tsx', 'utf8');

code = code.replace(/origin: \{ query: origin \},/, 'origin: origin,');
code = code.replace(/destination: \{ query: destination \},/, 'destination: destination,');
code = code.replace(/intermediates: waypoints,/, 'intermediates: waypoints.map(w => ({ location: { query: w.location.query } })) as any,'); // using as any for now to bypass type error since computeRoutes has complex types

fs.writeFileSync('src/components/RoutePlanner.tsx', code);
