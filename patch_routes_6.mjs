import fs from 'fs';
let code = fs.readFileSync('src/pages/RoutesPage.tsx', 'utf8');

// Insert currentManageRoute before the first return in the component
code = code.replace(/  return \(\n    <div/m, `  const currentManageRoute = selectedRoute ? (routes.find(r => r.id === selectedRoute.id) || selectedRoute) : null;

  return (
    <div`);

// Now replace `{isManageModalOpen && selectedRoute && (` with `{isManageModalOpen && currentManageRoute && (`
code = code.replace(/\{isManageModalOpen && selectedRoute && \(/g, '{isManageModalOpen && currentManageRoute && (');

// Now we need to replace all usages of selectedRoute INSIDE that block with currentManageRoute.
// We can do this safely by splitting code on `{isManageModalOpen && currentManageRoute && (`
let parts = code.split('{isManageModalOpen && currentManageRoute && (');
if (parts.length === 2) {
  let modalContent = parts[1];
  modalContent = modalContent.replace(/selectedRoute/g, 'currentManageRoute');
  code = parts[0] + '{isManageModalOpen && currentManageRoute && (' + modalContent;
}

fs.writeFileSync('src/pages/RoutesPage.tsx', code);
