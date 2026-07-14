import fs from 'fs';
let code = fs.readFileSync('src/pages/MapPage.tsx', 'utf8');

code = code.replace(/return \(\n    <div className="flex h/m, `const currentSelectedRoute = selectedRoute ? (routes.find(r => r.id === selectedRoute.id) || selectedRoute) : null;
  return (
    <div className="flex h`);

code = code.replace(/\{selectedRoute && \(/g, '{currentSelectedRoute && (');

// Inside the currentSelectedRoute rendering block, replace selectedRoute with currentSelectedRoute
// Wait, I can just replace `selectedRoute` with `currentSelectedRoute` inside the whole block for selectedRoute && (
let parts = code.split('{currentSelectedRoute && (');
if (parts.length === 2) {
  let modalContent = parts[1];
  modalContent = modalContent.replace(/selectedRoute/g, 'currentSelectedRoute');
  code = parts[0] + '{currentSelectedRoute && (' + modalContent;
}

fs.writeFileSync('src/pages/MapPage.tsx', code);
