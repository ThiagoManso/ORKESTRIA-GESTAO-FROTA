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
import UsersPage from './pages/UsersPage';
import InternalRequestsPage from './pages/InternalRequestsPage';
import SystemAuthWrapper from './components/auth/SystemAuthWrapper';
import { ViewState, SystemUser } from './types';

const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';
const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

export default function App() {
  const [isExternal, setIsExternal] = useState(false);
  const [isDriver, setIsDriver] = useState(false);
  const [currentUser, setCurrentUser] = useState<SystemUser | null>(null);
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
  
  // Set default view based on user permissions when user logs in
  useEffect(() => {
    if (currentUser) {
      const userPermissions = currentUser.permissions || [];
      if (!userPermissions.includes(currentView)) {
        // If current view is not allowed, switch to the first allowed view
        if (userPermissions.length > 0) {
          setCurrentView(userPermissions[0]);
        } else {
          setCurrentView('my_requests');
        }
      }
    }
  }, [currentUser]);

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
          <p>Para o mapa funcionar, você precisa configurar a sua chave de API do Google Maps.</p>
          <ul style={{textAlign:'left',lineHeight:'1.8'}}>
            <li>Abra o arquivo <strong>.env</strong> na raiz do seu projeto.</li>
            <li>Adicione a seguinte linha:</li>
            <li><code>VITE_GOOGLE_MAPS_PLATFORM_KEY=sua_chave_aqui</code></li>
            <li>Salve o arquivo e reinicie o servidor local (npm run dev).</li>
          </ul>
        </div>
      </div>
    );
  }
  
  if (!currentUser) {
    return (
      <APIProvider apiKey={API_KEY} version="weekly">
        <SystemAuthWrapper onAuthSuccess={setCurrentUser} />
      </APIProvider>
    );
  }

  const renderContent = () => {
    const userPermissions = currentUser?.permissions || [];
    const hasPermission = (view: ViewState) => userPermissions.includes(view);

    // Default to 'my_requests' if they don't have permission for the requested view
    const safeView = hasPermission(currentView) ? currentView : (userPermissions.length > 0 ? userPermissions[0] : 'my_requests');

    switch (safeView) {
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
      case 'users':
        return <UsersPage currentUser={currentUser} />;
      case 'my_requests':
        return <InternalRequestsPage currentUser={currentUser} />;
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
          currentUser={currentUser}
        />
        <div className="flex-1 flex flex-col min-w-0">
          <Header 
            onMenuClick={() => setIsSidebarOpen(true)} 
            onNotificationClick={() => setCurrentView('requests')}
            currentUser={currentUser}
          />
          <main className="flex-1 overflow-y-auto">
            {renderContent()}
          </main>
        </div>
      </div>
    </APIProvider>
  );
}
