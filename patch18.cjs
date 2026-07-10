const fs = require('fs');
let code = fs.readFileSync('src/components/CollectionsView.tsx', 'utf8');

code = code.replace(/<RoutePlanner[\\s\\S]*?driver=\{[\\s\\S]*?\}[\\s\\S]*?globalSettings=\{globalSettings\}/, `<RoutePlanner 
                          selectedRequests={requests.filter(r => selectedRequestIds.has(r.id) || (r.assignedDriverId === showRoutePlannerForDriver && r.status !== 'completed' && r.status !== 'delivered_manual'))}
                          driver={drivers.find(d => d.id === showRoutePlannerForDriver) || allUsers.find(u => u.uid === showRoutePlannerForDriver) as unknown as Driver}
                          globalSettings={globalSettings}
                          currentDriverLocation={
                             activeLogs.find(l => l.ownerId === showRoutePlannerForDriver || \`legacy-\${l.driverName}\` === showRoutePlannerForDriver)?.currentLat 
                                ? { lat: activeLogs.find(l => l.ownerId === showRoutePlannerForDriver || \`legacy-\${l.driverName}\` === showRoutePlannerForDriver)!.currentLat!, lng: activeLogs.find(l => l.ownerId === showRoutePlannerForDriver || \`legacy-\${l.driverName}\` === showRoutePlannerForDriver)!.currentLng! } 
                                : undefined
                          }`);

fs.writeFileSync('src/components/CollectionsView.tsx', code);
