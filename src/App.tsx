import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import ExternalRequestPage from './pages/ExternalRequestPage';
import DriverAuthWrapper from './pages/DriverAuthWrapper';
import { APIProvider } from '@vis.gl/react-google-maps';
import { WifiOff } from 'lucide-react';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import Dashboard from './pages/Dashboard';
import RoutesPage from './pages/RoutesPage';
import DriversPage from './pages/DriversPage';
import VehiclesPage from './pages/VehiclesPage';
import IssueBanner from './components/layout/IssueBanner';
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
  const [currentUser, setCurrentUser] = useState<SystemUser | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Redirect legacy query params to the new routes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'external-request') {
      navigate('/external-request', { replace: true });
    } else if (params.get('view') === 'driver') {
      navigate('/driver', { replace: true });
    }
  }, [navigate]);

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

  const renderAdminLayout = () => {
    if (!currentUser) {
      return <SystemAuthWrapper onAuthSuccess={setCurrentUser} />;
    }

    const userPermissions = currentUser?.permissions || [];
    const hasPermission = (view: ViewState) => userPermissions.includes(view);
    
    // To extract view from path (e.g. '/dashboard' -> 'dashboard')
    const pathView = location.pathname.split('/')[1];
    const currentView = (pathView || 'dashboard') as ViewState;
    const safeView = hasPermission(currentView) ? currentView : (userPermissions.length > 0 ? userPermissions[0] : 'my_requests');

    return (
      <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
        <Sidebar 
          currentView={currentView} 
          onViewChange={(view) => {
            navigate(`/${view}`);
            setIsSidebarOpen(false);
          }}
          isOpen={isSidebarOpen}
          setIsOpen={setIsSidebarOpen}
          currentUser={currentUser}
        />
        <div className="flex-1 flex flex-col min-w-0 relative">
          <Header 
            onMenuClick={() => setIsSidebarOpen(true)} 
            onNotificationClick={() => navigate('/requests')}
            currentUser={currentUser}
          />
          {!isOnline && (
            <div className="bg-red-500 text-white px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium z-50">
              <WifiOff size={16} /> Você está operando offline (sem internet). Alterações serão sincronizadas depois.
            </div>
          )}
          <IssueBanner onBannerClick={() => navigate('/issues')} />
          <main className="flex-1 overflow-y-auto">
            <Routes>
              <Route path="/dashboard" element={hasPermission('dashboard') ? <Dashboard /> : <Navigate to={`/${safeView}`} replace />} />
              <Route path="/routes" element={hasPermission('routes') ? <RoutesPage /> : <Navigate to={`/${safeView}`} replace />} />
              <Route path="/drivers" element={hasPermission('drivers') ? <DriversPage /> : <Navigate to={`/${safeView}`} replace />} />
              <Route path="/vehicles" element={hasPermission('vehicles') ? <VehiclesPage /> : <Navigate to={`/${safeView}`} replace />} />
              <Route path="/financial" element={hasPermission('financial') ? <FinancialPage /> : <Navigate to={`/${safeView}`} replace />} />
              <Route path="/issues" element={hasPermission('issues') ? <IssuesPage /> : <Navigate to={`/${safeView}`} replace />} />
              <Route path="/requests" element={hasPermission('requests') ? <RequestsPage /> : <Navigate to={`/${safeView}`} replace />} />
              <Route path="/map" element={hasPermission('map') ? <MapPage /> : <Navigate to={`/${safeView}`} replace />} />
              <Route path="/settings" element={hasPermission('settings') ? <SettingsPage /> : <Navigate to={`/${safeView}`} replace />} />
              <Route path="/users" element={hasPermission('users') ? <UsersPage currentUser={currentUser} /> : <Navigate to={`/${safeView}`} replace />} />
              <Route path="/my_requests" element={hasPermission('my_requests') ? <InternalRequestsPage currentUser={currentUser} /> : <Navigate to={`/${safeView}`} replace />} />
              <Route path="/" element={<Navigate to={`/${safeView}`} replace />} />
              <Route path="*" element={<Navigate to={`/${safeView}`} replace />} />
            </Routes>
          </main>
        </div>
      </div>
    );
  };

  return (
    <APIProvider apiKey={API_KEY} version="weekly">
      <Routes>
        <Route path="/external-request" element={
          <>
            {!isOnline && (
              <div className="bg-red-500 text-white px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium fixed top-0 w-full z-50">
                <WifiOff size={16} /> Sem conexão
              </div>
            )}
            <ExternalRequestPage />
          </>
        } />
        <Route path="/driver/*" element={
          <>
            {!isOnline && (
              <div className="bg-red-500 text-white px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium fixed top-0 w-full z-50">
                <WifiOff size={16} /> Modo Offline - Dados salvos localmente
              </div>
            )}
            <DriverAuthWrapper />
          </>
        } />
        <Route path="/*" element={renderAdminLayout()} />
      </Routes>
    </APIProvider>
  );
}
