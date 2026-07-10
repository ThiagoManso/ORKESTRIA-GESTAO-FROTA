const fs = require('fs');
let code = fs.readFileSync('src/components/DriverPortalView.tsx', 'utf8');

code = code.replace(/const staleLog = isDriverActive/, `const nextRequest = routeManifest ? requests.find(r => routeManifest.requestIds.includes(r.id) && r.status !== 'completed' && r.status !== 'delivered_manual') : undefined;
  const { currentDistance, isInside: isNearNextStop } = useGeofencing(nextRequest?.lat, nextRequest?.lng, 1000);
  const staleLog = isDriverActive`);

fs.writeFileSync('src/components/DriverPortalView.tsx', code);
