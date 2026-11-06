import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import AuthView from './components/AuthView';
import SellerDashboard from './components/SellerDashboard';
import BookingForm from './components/BookingForm';
import ShipmentDetail from './components/ShipmentDetail';
import CourierHubView from './components/CourierHubView';
import OpsDashboard from './components/OpsDashboard';
import SettingsModal from './components/SettingsModal';
import { ToastProvider } from './components/Toast';
import { getStoredUser, getStoredToken, storeAuth, clearAuth, authApi, opsApi } from './api';

function AppContent() {
  const [user, setUser] = useState(getStoredUser());
  const [token, setToken] = useState(getStoredToken());
  const [currentView, setCurrentView] = useState("dashboard");
  const [selectedShipmentId, setSelectedShipmentId] = useState(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [alertsCount, setAlertsCount] = useState(0);

  // Sync token check on mount
  useEffect(() => {
    async function checkUser() {
      if (token) {
        try {
          const res = await authApi.getMe();
          setUser(res.user);
          storeAuth(token, res.user);
        } catch {
          handleLogout();
        }
      }
    }
    checkUser();

    const handleUnauthorized = () => {
      handleLogout();
    };
    window.addEventListener("shipguard:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("shipguard:unauthorized", handleUnauthorized);
  }, [token]);

  // Load alerts count if admin
  useEffect(() => {
    if (user?.role === 'admin') {
      opsApi.getAlerts()
        .then(res => setAlertsCount(res.count || 0))
        .catch(() => {});
    }
  }, [user]);

  // Adjust default view upon login
  const handleAuthSuccess = (newToken, newUser) => {
    setToken(newToken);
    setUser(newUser);
    storeAuth(newToken, newUser);
    if (newUser.role === 'courier') {
      setCurrentView("scan_hub");
    } else if (newUser.role === 'admin') {
      setCurrentView("ops_alerts");
    } else {
      setCurrentView("dashboard");
    }
  };

  const handleLogout = () => {
    clearAuth();
    setToken(null);
    setUser(null);
    setCurrentView("dashboard");
    setSelectedShipmentId(null);
  };

  // 1-Click Demo Login
  const handleQuickLogin = async (email) => {
    try {
      const res = await authApi.login(email, "password123");
      handleAuthSuccess(res.token, res.user);
    } catch (err) {
      alert("Quick login failed: " + err.message);
    }
  };

  const handleSelectShipment = (id) => {
    setSelectedShipmentId(id);
    setCurrentView("detail");
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      
      {/* Top Navigation */}
      <Navbar
        user={user}
        currentView={currentView}
        setCurrentView={(view) => {
          setCurrentView(view);
          setSelectedShipmentId(null);
        }}
        onLogout={handleLogout}
        onQuickLogin={handleQuickLogin}
        alertsCount={alertsCount}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-16">
        
        {!user ? (
          <AuthView
            onAuthSuccess={handleAuthSuccess}
            onQuickLogin={handleQuickLogin}
          />
        ) : (
          <>
            {/* Shipment Detail View */}
            {currentView === 'detail' && selectedShipmentId && (
              <ShipmentDetail
                shipmentId={selectedShipmentId}
                user={user}
                onBack={() => {
                  setSelectedShipmentId(null);
                  setCurrentView(
                    user.role === 'courier' ? 'scan_hub' :
                    user.role === 'admin' ? 'ops_alerts' :
                    'dashboard'
                  );
                }}
              />
            )}

            {/* Seller Views */}
            {user.role === 'seller' && (
              <>
                {currentView === 'dashboard' && (
                  <SellerDashboard
                    user={user}
                    onBookNew={() => setCurrentView("book")}
                    onSelectShipment={handleSelectShipment}
                  />
                )}

                {currentView === 'book' && (
                  <BookingForm
                    user={user}
                    onShipmentCreated={(shp) => {
                      setSelectedShipmentId(shp.id);
                      setCurrentView("detail");
                    }}
                    onCancel={() => setCurrentView("dashboard")}
                  />
                )}

                {currentView === 'claims' && (
                  <div className="max-w-6xl mx-auto px-4 py-8">
                    <SellerDashboard
                      user={user}
                      onBookNew={() => setCurrentView("book")}
                      onSelectShipment={handleSelectShipment}
                    />
                  </div>
                )}
              </>
            )}

            {/* Courier Staff Views */}
            {user.role === 'courier' && (
              <>
                {currentView === 'scan_hub' && (
                  <CourierHubView
                    user={user}
                    onSelectShipment={handleSelectShipment}
                  />
                )}

                {currentView === 'dashboard' && (
                  <CourierHubView
                    user={user}
                    onSelectShipment={handleSelectShipment}
                  />
                )}
              </>
            )}

            {/* Ops Admin Views */}
            {user.role === 'admin' && (
              <>
                {currentView.startsWith('ops_') && (
                  <OpsDashboard
                    activeTab={currentView.replace('ops_', '')}
                    initialTab={currentView.replace('ops_', '')}
                    onTabChange={(tab) => setCurrentView(`ops_${tab}`)}
                    onSelectShipment={handleSelectShipment}
                  />
                )}
              </>
            )}
          </>
        )}

      </main>

      {/* Settings Modal for Ops Admin */}
      {showSettingsModal && (
        <SettingsModal onClose={() => setShowSettingsModal(false)} />
      )}

      {/* Enterprise Footer */}
      <footer className="border-t border-slate-900 bg-[#0B0F19] py-8 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <span className="font-bold text-slate-300">ShipGuard Enterprise</span>
            <span>•</span>
            <span>Parametric Claims & Telemetry Protocol v2.4</span>
          </div>
          <div className="flex items-center space-x-4 text-slate-500 font-mono text-[11px]">
            <span>FastEx Network</span>
            <span>•</span>
            <span>SwiftPost Hub</span>
            <span>•</span>
            <span>CityLink Dispatch</span>
          </div>
        </div>
      </footer>

    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
