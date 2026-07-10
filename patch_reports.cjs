const fs = require('fs');

// Patch DashboardView
let dash = fs.readFileSync('src/components/DashboardView.tsx', 'utf8');
dash = dash.replace("import { generateDailyPDF } from '../lib/reportGenerator';", "");
dash = dash.replace(
  "generateDailyPDF(today, todayReqs, todayLogs, drivers, user?.displayName || 'Administrador');",
  "const { generateDailyPDF } = await import('../lib/reportGenerator');\n              generateDailyPDF(today, todayReqs, todayLogs, drivers, user?.displayName || 'Administrador');"
);
fs.writeFileSync('src/components/DashboardView.tsx', dash);

// Patch CollectionsView
let coll = fs.readFileSync('src/components/CollectionsView.tsx', 'utf8');
coll = coll.replace("import { generateDailyPDF } from '../lib/reportGenerator';", "");
coll = coll.replace(
  "generateDailyPDF(dateFilter, activeReqs, activeFleetLogs, drivers, user?.displayName || 'Administrador');",
  "const { generateDailyPDF } = await import('../lib/reportGenerator');\n              generateDailyPDF(dateFilter, activeReqs, activeFleetLogs, drivers, user?.displayName || 'Administrador');"
);
fs.writeFileSync('src/components/CollectionsView.tsx', coll);

