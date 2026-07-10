const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const importsToRemove = [
  "import { DashboardView } from './components/DashboardView';",
  "import { VehiclesView } from './components/VehiclesView';",
  "import { MaintenanceView } from './components/MaintenanceView';",
  "import { UsageView } from './components/UsageView';",
  "import { DriversView } from './components/DriversView';",
  "import { FinesView } from './components/FinesView';",
  "import { CollectionsView } from './components/CollectionsView';",
  "import { CollectionsDashboardView } from './components/CollectionsDashboardView';",
  "import { DriverPortalView } from './components/DriverPortalView';",
  "import { UserManagementView } from './components/UserManagementView';",
  "import PublicRequestForm from './components/PublicRequestForm';",
  "import PublicPurchaseRequestForm from './components/PublicPurchaseRequestForm';",
  "import { PurchaseRequestsView } from './components/PurchaseRequestsView';"
];

for (const imp of importsToRemove) {
  code = code.replace(imp, "");
}

code = code.replace(
  "import { useState, useEffect } from 'react';",
  "import { useState, useEffect, lazy, Suspense } from 'react';"
);

const dynamicImports = `
const DashboardView = lazy(() => import('./components/DashboardView').then(m => ({ default: m.DashboardView })));
const VehiclesView = lazy(() => import('./components/VehiclesView').then(m => ({ default: m.VehiclesView })));
const MaintenanceView = lazy(() => import('./components/MaintenanceView').then(m => ({ default: m.MaintenanceView })));
const UsageView = lazy(() => import('./components/UsageView').then(m => ({ default: m.UsageView })));
const DriversView = lazy(() => import('./components/DriversView').then(m => ({ default: m.DriversView })));
const FinesView = lazy(() => import('./components/FinesView').then(m => ({ default: m.FinesView })));
const CollectionsView = lazy(() => import('./components/CollectionsView').then(m => ({ default: m.CollectionsView })));
const CollectionsDashboardView = lazy(() => import('./components/CollectionsDashboardView').then(m => ({ default: m.CollectionsDashboardView })));
const DriverPortalView = lazy(() => import('./components/DriverPortalView').then(m => ({ default: m.DriverPortalView })));
const UserManagementView = lazy(() => import('./components/UserManagementView').then(m => ({ default: m.UserManagementView })));
const PublicRequestForm = lazy(() => import('./components/PublicRequestForm'));
const PublicPurchaseRequestForm = lazy(() => import('./components/PublicPurchaseRequestForm'));
const PurchaseRequestsView = lazy(() => import('./components/PurchaseRequestsView').then(m => ({ default: m.PurchaseRequestsView })));
`;

code = code.replace(
  "import { LoginView } from './components/LoginView';",
  "import { LoginView } from './components/LoginView';\n" + dynamicImports
);

const loadingFallback = `
<div className="h-full w-full flex items-center justify-center min-h-[400px]">
  <div className="w-8 h-8 rounded-full border-4 border-ork-primary border-t-transparent animate-spin" />
</div>
`;

code = code.replace(
  /<AnimatePresence mode="wait">[\s\S]*?<\/AnimatePresence>/,
  `<AnimatePresence mode="wait">
            <motion.div
              key={currentTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            >
              <Suspense fallback={${JSON.stringify(loadingFallback).slice(1, -1)}}>
                {currentTab === 'dashboard' && <DashboardView />}
                {currentTab === 'usage' && <UsageView />}
                {currentTab === 'vehicles' && <VehiclesView />}
                {currentTab === 'maintenance' && <MaintenanceView />}
                {currentTab === 'drivers' && <DriversView />}
                {currentTab === 'collections' && <CollectionsView />}
                {currentTab === 'collections-dash' && <CollectionsDashboardView />}
                {currentTab === 'fines' && <FinesView />}
                {currentTab === 'schedules' && <MaintenanceView initialView="schedules" />}
                {currentTab === 'users' && <UserManagementView />}
                {currentTab === 'driver-portal' && <DriverPortalView />}
                {currentTab === 'purchases' && <PurchaseRequestsView />}
              </Suspense>
            </motion.div>
          </AnimatePresence>`
);

code = code.replace(
  "return <PublicPurchaseRequestForm />;",
  "return <Suspense fallback={null}><PublicPurchaseRequestForm /></Suspense>;"
);

code = code.replace(
  "return <PublicRequestForm />;",
  "return <Suspense fallback={null}><PublicRequestForm /></Suspense>;"
);

fs.writeFileSync('src/App.tsx', code);
