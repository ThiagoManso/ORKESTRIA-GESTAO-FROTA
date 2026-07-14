import fs from 'fs';
let code = fs.readFileSync('src/pages/RoutesPage.tsx', 'utf8');

code = code.replace(/google\.maps\.TravelMode\.DRIVING/g, "'DRIVING'");
code = code.replace(/google\.maps\.TrafficModel\.BEST_GUESS/g, "'bestguess'");

fs.writeFileSync('src/pages/RoutesPage.tsx', code);
