const fs = require('fs');
let code = fs.readFileSync('src/components/RoutePlanner.tsx', 'utf8');

code = code.replace(/interface RoutePlannerProps \{/, `interface RoutePlannerProps {
  currentDriverLocation?: { lat: number; lng: number };`);

code = code.replace(/export function RoutePlanner\(\{ selectedRequests, driver, globalSettings, onClose, onSuccess \}: RoutePlannerProps\) \{/, `export function RoutePlanner({ selectedRequests, driver, globalSettings, currentDriverLocation, onClose, onSuccess }: RoutePlannerProps) {`);

code = code.replace(/const origin = globalSettings\?\.headquarterAddress \|\| selectedRequests\[0\]\.address;/, `const origin = currentDriverLocation || globalSettings?.headquarterAddress || selectedRequests[0].address;`);

code = code.replace(/if \(globalSettings\?\.headquarterAddress\) \{/, `if (currentDriverLocation || globalSettings?.headquarterAddress) {`);

fs.writeFileSync('src/components/RoutePlanner.tsx', code);
