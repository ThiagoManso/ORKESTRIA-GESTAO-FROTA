import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { VehiclesView } from './components/VehiclesView';
import { MaintenanceView } from './components/MaintenanceView';
import { UsageView } from './components/UsageView';
import { DriversView } from './components/DriversView';
import { FinesView } from './components/FinesView';
import { CollectionsView } from './components/CollectionsView';
import { CollectionsDashboardView } from './components/CollectionsDashboardView';
import { DriverPortalView } from './components/DriverPortalView';
import { UserManagementView } from './components/UserManagementView';
import PublicRequestForm from './components/PublicRequestForm';
import PublicPurchaseRequestForm from './components/PublicPurchaseRequestForm';
import { PurchaseRequestsView } from './components/PurchaseRequestsView';
import { ChevronRight, Car, Menu } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { isAdminEmail } from './lib/utils';

import { SplashScreen } from './components/SplashScreen';

import { LoginView } from './components/LoginView';

function AppContent() {
  const { user, profile, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [showSplash, setShowSplash] = useState(true);

  const path = window.location.pathname;
  const search = window.location.search;
  
  const isPublicPurchase = path.includes('/request/compras') || search.includes('public=compras');
  const isPublicRequest = path.includes('/request') || search.includes('public=true');

  // Set default tab based on role when profile changes
  useEffect(() => {
    if (profile) {
      if (profile.role === 'driver') {
        setActiveTab('driver-portal');
      } else if (profile.role === 'purchasing') {
        setActiveTab('purchases');
      } else {
        setActiveTab('dashboard');
      }
    }
  }, [profile]);

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  if (isPublicPurchase) {
    return <PublicPurchaseRequestForm />;
  }

  if (isPublicRequest) {
    return <PublicRequestForm />;
  }

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-ork-bg">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-4 border-ork-primary border-t-transparent animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-ork-secondary shadow-[0_0_15px_#2D9CFF]" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  if (user && !profile) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-ork-bg text-white">
        <div className="w-12 h-12 rounded-full border-4 border-ork-primary border-t-transparent animate-spin mb-4" />
        <p className="text-ork-text-muted font-bold tracking-widest uppercase text-xs">Preparando seu acesso...</p>
      </div>
    );
  }

  // Double check role protection
  const isDeveloper = isAdminEmail(user?.email);
  const isDriver = profile?.role === 'driver' && !isDeveloper;
  const isPurchasing = profile?.role === 'purchasing' && !isDeveloper;

  const allowedTabs = isPurchasing ? ['purchases'] : isDriver ? ['usage', 'driver-portal'] : [
    'dashboard', 'usage', 'vehicles', 'maintenance', 'drivers', 
    'collections', 'collections-dash', 'fines', 'schedules', 'users', 'driver-portal', 'purchases'
  ];

  const currentTab = allowedTabs.includes(activeTab) ? activeTab : (isPurchasing ? 'purchases' : isDriver ? 'usage' : 'dashboard');

  return (
    <div className="min-h-screen bg-ork-bg text-slate-200 flex flex-col lg:flex-row overflow-x-hidden">
      <Sidebar 
        activeTab={currentTab} 
        setActiveTab={setActiveTab} 
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
      />
      
      {/* Universal Menu Toggle for Mobile & Desktop (when collapsed) */}
      <div className="fixed top-6 left-6 z-40 lg:hidden">
        <button 
          onClick={() => setIsCollapsed(false)}
          className="p-4 bg-ork-surface border border-ork-border rounded-2xl text-white shadow-2xl active:scale-95"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      <div className="lg:hidden flex items-center justify-between p-4 bg-ork-bg/50 backdrop-blur-md border-b border-white/5 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-ork-primary rounded-lg flex items-center justify-center">
            <Car className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-white tracking-tighter uppercase text-sm">Ork Fleet</span>
        </div>
        <button 
          onClick={() => setIsCollapsed(false)}
          className="p-2 bg-white/5 rounded-xl text-ork-text-muted transition-all active:scale-90"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      <motion.main 
        initial={false}
        animate={{ paddingLeft: 0 }}
        className="flex-1 w-full min-h-screen"
      >
        <div className="p-4 sm:p-8 lg:p-12 w-full max-w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            >
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
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
