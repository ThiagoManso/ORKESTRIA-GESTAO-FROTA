import fs from 'fs';
let code = fs.readFileSync('src/pages/RoutesPage.tsx', 'utf8');

// Insert currentManageRoute declaration just before return (
code = code.replace(/return \(/, `const currentManageRoute = selectedRoute ? (routes.find(r => r.id === selectedRoute.id) || selectedRoute) : null;
  return (`);

// Replace selectedRoute with currentManageRoute ONLY inside the isManageModalOpen block.
// The block starts with `{isManageModalOpen && selectedRoute && (`
// Wait, the easiest way is to change the condition to:
// `{isManageModalOpen && currentManageRoute && (`
// and then replace all `selectedRoute.` or `selectedRoute)` or `selectedRoute }` 
// with `currentManageRoute` inside that block.
// Actually, it might be simpler to just use an IIFE:
// {isManageModalOpen && selectedRoute && (() => { 
//   const currentManageRoute = routes.find(r => r.id === selectedRoute.id) || selectedRoute;
//   return ( ... JSX ... ) 
// })()}
