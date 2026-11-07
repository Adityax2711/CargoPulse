import React, { useState } from 'react';
import { 
  Shield, Lock, Mail, User, Building, ArrowRight, 
  AlertCircle, CheckCircle2, TrendingUp, Zap, Clock, ShieldCheck, ChevronDown, ChevronUp,
  Eye, EyeOff, KeyRound
} from 'lucide-react';
import { authApi } from '../api';
import { BrandIcon, BrandLockup } from './BrandLogo';

export default function AuthView({ onAuthSuccess, onQuickLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'admin',
    courier_name: 'FastEx'
  });
  const [loading, setLoading] = useState(false);
  const [errorObj, setErrorObj] = useState(null);
  const [autoCreating, setAutoCreating] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showDemoDrawer, setShowDemoDrawer] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorObj(null);
    setLoading(true);

    try {
      let res;
      if (isLogin) {
        res = await authApi.login(formData.email, formData.password);
      } else {
        res = await authApi.signup({
          name: formData.name || formData.email.split('@')[0],
          email: formData.email,
          password: formData.password,
          role: formData.role,
          courier_name: formData.role === 'courier' ? formData.courier_name : null
        });
      }
      onAuthSuccess(res.token, res.user);
    } catch (err) {
      setErrorObj({
        message: err.message || "Authentication failed. Please verify credentials.",
        code: err.code
      });
    } finally {
      setLoading(false);
    }
  };

  const handleQuickReset = async () => {
    if (!formData.password || formData.password.length < 6) {
      setErrorObj({
        message: "Please enter a password with at least 6 characters in the field below.",
        code: "INVALID_PASSWORD"
      });
      return;
    }
    setResetting(true);
    setErrorObj(null);
    try {
      const res = await authApi.resetPassword(formData.email, formData.password);
      onAuthSuccess(res.token, res.user);
    } catch (err) {
      setErrorObj({
        message: err.message || "Failed to update password.",
        code: err.code
      });
    } finally {
      setResetting(false);
    }
  };

  const handleQuickRegister = async () => {
    setAutoCreating(true);
    setErrorObj(null);
    try {
      const res = await authApi.signup({
        name: formData.name || formData.email.split('@')[0] || "User",
        email: formData.email,
        password: formData.password,
        role: "admin",
        courier_name: null
      });
      onAuthSuccess(res.token, res.user);
    } catch (err) {
      setErrorObj({
        message: err.message || "Failed to create account.",
        code: err.code
      });
    } finally {
      setAutoCreating(false);
    }
  };

  const demoPresets = [
    { label: "Apex Electronics", role: "Seller (Pro)", email: "apex@seller.com", note: "Clean ratio (<2%) • 20% discount" },
    { label: "Nova Retail", role: "Seller (Standard)", email: "nova@seller.com", note: "Standard seller portfolio" },
    { label: "FastEx Dispatch", role: "Courier Staff", email: "staff@fastex.com", note: "FastEx mobile scan terminal" },
    { label: "Sarah Connor", role: "Ops Director", email: "admin@shipguard.com", note: "Claims adjudication & scorecards" }
  ];

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col lg:flex-row bg-[#0B0F19]">
      
      {/* Left Column: Enterprise Value Proposition (Desktop) */}
      <div className="hidden lg:flex lg:w-1/2 p-12 xl:p-16 flex-col justify-between border-r border-slate-800/80 bg-gradient-to-b from-[#0F172A] via-[#0B0F19] to-[#080B11] relative overflow-hidden bg-grid-pattern">
        
        {/* Top Branding */}
        <div className="relative z-10">
          <div className="mb-8">
            <BrandLockup name="CargoPulse" tagline="AUTONOMOUS TRANSIT TELEMETRY & CLAIMS" size="lg" />
          </div>

          <div className="inline-flex items-center space-x-2.5 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-800/50 text-cyan-300 text-xs font-semibold mb-6">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
            <span>Autonomous Logistics Protection Protocol</span>
          </div>

          <h2 className="text-3xl xl:text-4xl font-extrabold text-white tracking-tight leading-tight">
            The telemetry-driven risk & claims infrastructure for modern shipping.
          </h2>

          <p className="text-slate-400 text-sm xl:text-base mt-4 leading-relaxed max-w-lg">
            Traditional couriers leave packages in 40-day dispute black holes. Our platform binds sellers and carriers to immutable telemetry baselines, shock & weight delta monitoring, and instant parametric payouts.
          </p>

          {/* Key Value Metric Tiles */}
          <div className="grid grid-cols-3 gap-4 mt-8 max-w-lg">
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="text-2xl font-black font-mono text-cyan-400">0.4%</div>
              <div className="text-[11px] text-slate-400 font-medium mt-1">Starting protection rate</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="text-2xl font-black font-mono text-emerald-400">&lt; 5 min</div>
              <div className="text-[11px] text-slate-400 font-medium mt-1">Parametric claim resolution</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="text-2xl font-black font-mono text-amber-400">100%</div>
              <div className="text-[11px] text-slate-400 font-medium mt-1">Immutable audit verification</div>
            </div>
          </div>
        </div>


        {/* Footer info */}
        <div className="relative z-10 pt-6 text-[11px] text-slate-500 flex items-center justify-between border-t border-slate-800/60 max-w-lg">
          <span>Integrated with FastEx • SwiftPost • CityLink</span>
          <span>SOC-2 & Parametric Compliant</span>
        </div>

      </div>

      {/* Right Column: Clean Enterprise Sign In Card */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-6">
          
          {/* Mobile Header Banner (Visible only on small screens) */}
          <div className="lg:hidden text-center mb-6">
            <div className="flex justify-center mb-3">
              <BrandIcon className="w-12 h-12" />
            </div>
            <h1 className="text-xl font-black text-white tracking-tight">
              Cargo<span className="bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">Pulse</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">Autonomous transit telemetry & instant claims</p>
          </div>

          {/* Main Auth Container */}
          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-7 sm:p-8 shadow-2xl space-y-6">
            
            {/* Form Title & Subtitle */}
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white tracking-tight">
                {isLogin ? "Sign in to your account" : "Create your organization account"}
              </h2>
              <p className="text-xs text-slate-400">
                {isLogin 
                  ? "Access your dashboard, manage custody telemetry, or file claims."
                  : "Set up seller, courier, or admin operations in seconds."}
              </p>
            </div>

            {/* Tab Switcher */}
            <div className="flex rounded-xl bg-[#0B0F19] p-1 border border-slate-800 text-xs font-semibold">
              <button
                type="button"
                onClick={() => { setIsLogin(true); setErrorObj(null); }}
                className={`flex-1 py-2 rounded-lg transition-all ${
                  isLogin 
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { 
                  setIsLogin(false); 
                  setErrorObj(null);
                  setFormData(prev => ({ ...prev, name: prev.name || (prev.email ? prev.email.split('@')[0] : '') }));
                }}
                className={`flex-1 py-2 rounded-lg transition-all ${
                  !isLogin 
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Create Account
              </button>
            </div>

            {/* Error / User Not Found Notice */}
            {errorObj && (
              <div className={`p-4 rounded-xl border text-xs space-y-3 ${
                errorObj.code === 'USER_NOT_FOUND' 
                  ? 'bg-indigo-950/40 border-indigo-500/40 text-indigo-200' 
                  : errorObj.code === 'INVALID_PASSWORD'
                  ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}>
                <div className="flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-current" />
                  <span className="leading-relaxed">{errorObj.message}</span>
                </div>

                {/* Helpful instant action for INVALID_PASSWORD */}
                {errorObj.code === 'INVALID_PASSWORD' && (
                  <div className="pt-2 border-t border-amber-800/60 flex flex-col gap-2">
                    <button
                      type="button"
                      disabled={loading || resetting}
                      onClick={async () => {
                        setFormData(prev => ({ ...prev, password: 'password123' }));
                        setErrorObj(null);
                        setLoading(true);
                        try {
                          const res = await authApi.login(formData.email, 'password123');
                          onAuthSuccess(res.token, res.user);
                        } catch (err) {
                          setErrorObj({
                            message: err.message || "Failed to sign in with password123.",
                            code: err.code
                          });
                        } finally {
                          setLoading(false);
                        }
                      }}
                      className="w-full py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center space-x-1.5"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-cyan-300" />
                      <span>Sign In with default demo password (password123)</span>
                    </button>

                    <button
                      type="button"
                      disabled={resetting || loading}
                      onClick={handleQuickReset}
                      className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-medium text-xs transition-all flex items-center justify-center space-x-1.5"
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      <span>{resetting ? "Updating password..." : "Or update password to currently entered text & Sign In"}</span>
                    </button>
                  </div>
                )}

                {/* Helpful instant action for USER_NOT_FOUND */}
                {errorObj.code === 'USER_NOT_FOUND' && (
                  <div className="pt-2 border-t border-indigo-800/60 flex flex-col gap-2">
                    <button
                      type="button"
                      disabled={autoCreating}
                      onClick={handleQuickRegister}
                      className="w-full py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center space-x-1.5"
                    >
                      <Zap className="w-3.5 h-3.5 text-cyan-300" />
                      <span>{autoCreating ? "Registering..." : `Register "${formData.email}" with this password`}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsLogin(false);
                        setFormData(prev => ({ ...prev, name: prev.name || prev.email.split('@')[0] }));
                        setErrorObj(null);
                      }}
                      className="text-xs text-indigo-300 hover:underline text-center"
                    >
                      Or customize role & details on Create Account tab
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Auth Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {!isLogin && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Organization or Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Apex Global Logistics"
                      className="w-full pl-10 pr-3.5 py-2.5 bg-[#0B0F19] border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Business Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="name@company.com"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-[#0B0F19] border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    Password
                  </label>
                  {isLogin && (
                    <button
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({ ...prev, password: 'password123' }));
                        setErrorObj(null);
                      }}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                    >
                      Fill demo password (password123)
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-10 py-2.5 bg-[#0B0F19] border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 transition-colors p-0.5"
                    tabIndex="-1"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {!isLogin && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Operational Role
                    </label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-[#0B0F19] border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="admin">Platform Ops Admin (Full Adjudication & Scorecards)</option>
                      <option value="seller">Merchant / Seller (Book shipments & file claims)</option>
                      <option value="courier">Courier Driver / Station Staff (Custody scans)</option>
                    </select>
                  </div>

                  {formData.role === 'courier' && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Courier Fleet Partner
                      </label>
                      <select
                        value={formData.courier_name}
                        onChange={(e) => setFormData({ ...formData, courier_name: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-[#0B0F19] border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="FastEx">FastEx</option>
                        <option value="SwiftPost">SwiftPost</option>
                        <option value="CityLink">CityLink</option>
                      </select>
                    </div>
                  )}
                </>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/25 flex items-center justify-center space-x-2 transition-all disabled:opacity-50 mt-2"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span>{isLogin ? "Authenticate to Platform" : "Create & Initialize Account"}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

            </form>

          </div>

          {/* Sleek Enterprise Demo Sandbox Toggle Drawer */}
          <div className="rounded-xl border border-slate-800 bg-[#0F172A]/70 overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => setShowDemoDrawer(!showDemoDrawer)}
              className="w-full px-4 py-3 flex items-center justify-between text-slate-400 hover:text-slate-200 transition-colors"
            >
              <div className="flex items-center space-x-2 font-medium">
                <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                <span>Testing Sandbox: 1-Click Demo Credentials</span>
              </div>
              {showDemoDrawer ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showDemoDrawer && (
              <div className="p-3 pt-0 border-t border-slate-800/60 grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                {demoPresets.map((preset) => (
                  <button
                    key={preset.email}
                    type="button"
                    onClick={() => onQuickLogin(preset.email)}
                    className="p-2.5 rounded-lg bg-[#0B0F19] hover:bg-indigo-950/30 border border-slate-800 hover:border-indigo-500/40 text-left transition-all group"
                  >
                    <div className="flex items-center justify-between font-bold text-slate-200 text-xs group-hover:text-cyan-400">
                      <span>{preset.label}</span>
                      <span className="text-[10px] text-slate-500 font-normal">{preset.role}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">{preset.email}</div>
                    <div className="text-[10px] text-indigo-400 mt-1">{preset.note}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

    </div>
  );
}
