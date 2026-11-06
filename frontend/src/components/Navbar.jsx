import React, { useState } from 'react';
import { 
  Shield, Package, Truck, User, LogOut, Sliders, 
  ChevronDown, Bell, Search, Activity, ExternalLink, HelpCircle
} from 'lucide-react';

export default function Navbar({
  user,
  currentView,
  setCurrentView,
  onLogout,
  onQuickLogin,
  alertsCount = 0
}) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const demoAccounts = [
    { label: "Apex Electronics", email: "apex@seller.com", role: "seller", tag: "20% Clean Discount" },
    { label: "Nova Retail", email: "nova@seller.com", role: "seller", tag: "Standard Seller" },
    { label: "FastEx Dispatch Staff", email: "staff@fastex.com", role: "courier", tag: "FastEx Fleet" },
    { label: "SwiftPost Station Staff", email: "staff@swiftpost.com", role: "courier", tag: "SwiftPost Fleet" },
    { label: "CityLink Driver", email: "staff@citylink.com", role: "courier", tag: "CityLink Fleet" },
    { label: "Sarah Connor (Ops Admin)", email: "admin@shipguard.com", role: "admin", tag: "Director of Ops" },
  ];

  return (
    <header className="sticky top-0 z-40 bg-[#0B0F19]/90 backdrop-blur-md border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Left: Brand Identity & Environment Tag */}
          <div className="flex items-center space-x-3 cursor-pointer shrink-0" onClick={() => setCurrentView("dashboard")}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 p-0.5 shadow-md shadow-indigo-600/20 flex items-center justify-center">
              <div className="w-full h-full bg-[#0B0F19] rounded-[10px] flex items-center justify-center">
                <Shield className="w-4 h-4 text-cyan-400" />
              </div>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-lg font-extrabold tracking-tight text-white font-sans">
                Ship<span className="text-cyan-400">Guard</span>
              </span>
              <span className="hidden sm:inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800/90 text-slate-400 border border-slate-700/60 uppercase tracking-wider">
                Enterprise
              </span>
            </div>
          </div>

          {/* Center Navigation Links (Role Scoped) */}
          {user && (
            <nav className="hidden md:flex items-center space-x-1">
              {user.role === 'seller' && (
                <>
                  <button
                    onClick={() => setCurrentView("dashboard")}
                    className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                      currentView === 'dashboard'
                        ? 'bg-slate-800 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                  >
                    Shipment Tracker
                  </button>
                  <button
                    onClick={() => setCurrentView("book")}
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                      currentView === 'book'
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                        : 'text-indigo-400 hover:text-indigo-300 hover:bg-indigo-950/40'
                    }`}
                  >
                    <span>+ Book Shipment</span>
                  </button>
                  <button
                    onClick={() => setCurrentView("claims")}
                    className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                      currentView === 'claims'
                        ? 'bg-slate-800 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                  >
                    Claims History
                  </button>
                </>
              )}

              {user.role === 'courier' && (
                <>
                  <button
                    onClick={() => setCurrentView("dashboard")}
                    className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                      currentView === 'dashboard'
                        ? 'bg-slate-800 text-cyan-400 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                  >
                    {user.courier_name} Fleet Directory
                  </button>
                  <button
                    onClick={() => setCurrentView("scan_hub")}
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                      currentView === 'scan_hub'
                        ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/25'
                        : 'text-cyan-400 hover:bg-cyan-950/40'
                    }`}
                  >
                    <Activity className="w-3.5 h-3.5" />
                    <span>Mobile Scan Terminal</span>
                  </button>
                </>
              )}

              {user.role === 'admin' && (
                <>
                  <button
                    onClick={() => setCurrentView("ops_alerts")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all relative flex items-center space-x-1.5 ${
                      currentView === 'ops_alerts'
                        ? 'bg-slate-800 text-amber-400 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                  >
                    <span>Custody Alerts</span>
                    {alertsCount > 0 && (
                      <span className="px-1.5 py-0.2 text-[10px] font-black bg-amber-500 text-slate-950 rounded-full">
                        {alertsCount}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setCurrentView("ops_claims")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      currentView === 'ops_claims'
                        ? 'bg-slate-800 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                  >
                    Claims Queue
                  </button>
                  <button
                    onClick={() => setCurrentView("ops_scorecard")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      currentView === 'ops_scorecard'
                        ? 'bg-slate-800 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                  >
                    Carrier Scorecards
                  </button>
                  <button
                    onClick={() => setCurrentView("ops_shipments")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      currentView === 'ops_shipments'
                        ? 'bg-slate-800 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                  >
                    Parcels Directory
                  </button>
                  <button
                    onClick={() => setCurrentView("ops_settings")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 ${
                      currentView === 'ops_settings'
                        ? 'bg-slate-800 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Rate Settings</span>
                  </button>
                </>
              )}
            </nav>
          )}

          {/* Right Area: Notifications, Sandbox Role Switcher & User Avatar */}
          <div className="flex items-center space-x-3">
            
            {user ? (
              <>
                {/* Sandbox Demo Quick Switcher Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-medium text-slate-300 transition-colors shadow-sm"
                  >
                    <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></div>
                    <span className="hidden sm:inline font-mono text-[11px] text-slate-400">ROLE:</span>
                    <span className="font-bold text-white capitalize">{user.role}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </button>

                  {showUserMenu && (
                    <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-[#111827] border border-slate-800 shadow-2xl z-50 p-2.5 space-y-2">
                      <div className="px-3 py-2 border-b border-slate-800/80">
                        <div className="font-bold text-xs text-white">{user.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{user.email}</div>
                        {user.courier_name && (
                          <div className="text-[10px] text-cyan-400 font-semibold mt-0.5">Assigned Fleet: {user.courier_name}</div>
                        )}
                      </div>

                      <div className="px-3 pt-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Switch Workspace / Demo Persona
                      </div>

                      <div className="space-y-1">
                        {demoAccounts.map(acc => (
                          <button
                            key={acc.email}
                            onClick={() => {
                              onQuickLogin(acc.email);
                              setShowUserMenu(false);
                            }}
                            className={`w-full text-left p-2 rounded-xl text-xs transition-colors flex items-center justify-between ${
                              user.email === acc.email
                                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                                : 'hover:bg-slate-800/60 text-slate-300'
                            }`}
                          >
                            <div>
                              <div className="font-semibold text-xs">{acc.label}</div>
                              <div className="text-[10px] text-slate-500 font-mono">{acc.tag}</div>
                            </div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                              {acc.role}
                            </span>
                          </button>
                        ))}
                      </div>

                      <div className="pt-2 border-t border-slate-800/80">
                        <button
                          onClick={() => {
                            setShowUserMenu(false);
                            onLogout();
                          }}
                          className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-950/20 transition-colors flex items-center space-x-2"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Direct Logout Button */}
                <button
                  onClick={onLogout}
                  title="Sign Out"
                  className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800/60 rounded-xl transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            ) : (
              <button
                onClick={() => setCurrentView("login")}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all"
              >
                Sign In
              </button>
            )}

          </div>

        </div>
      </div>
    </header>
  );
}
