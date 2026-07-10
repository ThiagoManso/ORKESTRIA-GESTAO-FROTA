const fs = require('fs');
let code = fs.readFileSync('src/components/DriverPortalView.tsx', 'utf8');

code = code.replace(/const activeLog = isDriverActive[\\s\\S]*?: null;/, `const activeLog = isDriverActive 
    ? logs.find(l => {
        const isMyLog = l.status === 'active' && !closedLogs.has(l.id) && (l.driverName === profile?.name || l.ownerId === user?.uid) && isEnding !== l.id;
        if (!isMyLog) return false;
        
        const logDateString = l.startTime?.toDate ? l.startTime.toDate().toDateString() : new Date(l.startTime).toDateString();
        const todayString = new Date().toDateString();
        
        return logDateString === todayString || resumedLogId === l.id;
      })
    : null;
    
  const nextRequest = routeManifest ? requests.find(r => routeManifest.requestIds.includes(r.id) && r.status !== 'completed' && r.status !== 'delivered_manual') : undefined;
  
  const { currentDistance, isInside: isNearNextStop } = useGeofencing(nextRequest?.lat, nextRequest?.lng, 1000);
`);

fs.writeFileSync('src/components/DriverPortalView.tsx', code);
