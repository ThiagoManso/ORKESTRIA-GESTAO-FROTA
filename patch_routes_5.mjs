import fs from 'fs';
let code = fs.readFileSync('src/pages/RoutesPage.tsx', 'utf8');

const regex = /\{isManageModalOpen && selectedRoute && \(/g;
const replacement = `{isManageModalOpen && selectedRoute && (() => {
        const currentManageRoute = routes.find(r => r.id === selectedRoute.id) || selectedRoute;
        return (`;

code = code.replace(regex, replacement);

// Now we need to find the matching closing parenthesis for this block.
// Wait, replacing all `selectedRoute` inside the block is easier.
// Let's just find the block by splitting.

let parts = code.split(`{isManageModalOpen && selectedRoute && (() => {
        const currentManageRoute = routes.find(r => r.id === selectedRoute.id) || selectedRoute;
        return (`);

if (parts.length === 2) {
  let modalContent = parts[1];
  
  // Replace `selectedRoute.` with `currentManageRoute.` inside modalContent
  modalContent = modalContent.replace(/selectedRoute\./g, 'currentManageRoute.');
  
  // Replace `formatRouteId(selectedRoute)` with `formatRouteId(currentManageRoute)`
  modalContent = modalContent.replace(/formatRouteId\(selectedRoute\)/g, 'formatRouteId(currentManageRoute)');
  
  // Replace `handleDeleteRoute(selectedRoute.id)` with `handleDeleteRoute(currentManageRoute.id)`
  modalContent = modalContent.replace(/handleDeleteRoute\(selectedRoute\.id\)/g, 'handleDeleteRoute(currentManageRoute.id)');

  // Replace `setEditingRoute(selectedRoute)` with `setEditingRoute(currentManageRoute)`
  modalContent = modalContent.replace(/setEditingRoute\(selectedRoute\)/g, 'setEditingRoute(currentManageRoute)');

  // To close the IIFE, we need to find where the `)}` is at the end of the modal.
  // Wait, let's just do a simple `.replace(/}\)$/, '})()}');` at the end of modalContent?
  // Actually, the end of the file is just `)}` maybe a couple times. Let's find the closing of isManageModalOpen.
  // We can just append `)()} ` instead of `)` for the last `)}` matching the block.
  // Or simpler: change the replacement to just rename the state variable.
}

