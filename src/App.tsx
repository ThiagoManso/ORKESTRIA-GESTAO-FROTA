import React, { useState, useEffect } from 'react';
import ExternalRequestPage from './pages/ExternalRequestPage';
import DriverAuthWrapper from './pages/DriverAuthWrapper';
import { APIProvider } from '@vis.gl/react-google-maps';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import Dashboard from './pages/Dashboard';
import RoutesPage from './pages/RoutesPage';
import DriversPage from './pages/DriversPage';
import VehiclesPage from './pages/VehiclesPage';
import FinancialPage from './pages/FinancialPage';
import IssuesPage from './pages/IssuesPage';
import MapPage from './pages/MapPage';
import SettingsPage from './pages/SettingsPage';
import RequestsPage from './pages/RequestsPage';
import { ViewState } from './types';

const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';
const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

export default function App() {
  const [isExternal, setIsExternal] = useState(false);
  const [isDriver, setIsDriver] = useState(false);
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'external-request') {
      setIsExternal(true);
    } else if (params.get('view') === 'driver') {
      setIsDriver(true);
    }

    const handleNavigate = (e: any) => {
      if (e.detail) {
        setCurrentView(e.detail as ViewState);
      }
    };
    window.addEventListener('navigate', handleNavigate);
    return () => window.removeEventListener('navigate', handleNavigate);
  }, []);

  if (isExternal) {
    return (
      <APIProvider apiKey={API_KEY} version="weekly">
        <ExternalRequestPage />
      </APIProvider>
    );
  }

  if (isDriver) {
    return (
      <APIProvider apiKey={API_KEY} version="weekly">
        <DriverAuthWrapper />
      </APIProvider>
    );
  }

  if (!hasValidKey) {
    return (
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',fontFamily:'sans-serif'}}>
        <div style={{textAlign:'center',maxWidth:520}}>
          <h2>Google Maps API Key Required</h2>
          <p><strong>Step 1:</strong> <a href="https://console.cloud.google.com/google/maps-apis/start?utm_campaign=gmp-code-assist-ais" target="_blank" rel="noopener">Get an API Key</a></p>
          <p><strong>Step 2:</strong> Add your key as a secret in AI Studio:</p>
          <ul style={{textAlign:'left',lineHeight:'1.8'}}>
            <li>Open <strong>Settings</strong> (⚙️ gear icon, <strong>top-right corner</strong>)</li>
            <li>Select <strong>Secrets</strong></li>
            <li>Type <code>GOOGLE_MAPS_PLATFORM_KEY</code> as the secret name, press <strong>Enter</strong></li>
            <li>Paste your API key as the value, press <strong>Enter</strong></li>
          </ul>
          <p>The app rebuilds automatically after you add the secret.</p>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'routes':
        return <RoutesPage />;
      case 'drivers':
        return <DriversPage />;
      case 'vehicles':
        return <VehiclesPage />;
      case 'financial':
        return <FinancialPage />;
      case 'issues':
        return <IssuesPage />;
      case 'requests':
        return <RequestsPage />;
      case 'map':
        return <MapPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <APIProvider apiKey={API_KEY} version="weekly">
      <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
        <Sidebar 
          currentView={currentView} 
          onViewChange={(view) => {
            setCurrentView(view);
            setIsSidebarOpen(false);
          }}
          isOpen={isSidebarOpen}
          setIsOpen={setIsSidebarOpen}
        />
        <div className="flex-1 flex flex-col min-w-0">
          <Header 
          onMenuClick={() => setIsSidebarOpen(true)} 
          onNotificationClick={() => handleViewChange('requests')}
        />
          <main className="flex-1 overflow-y-auto">
            {renderContent()}
          </main>
        </div>
      </div>
    </APIProvider>
  );
}
