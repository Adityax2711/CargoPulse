import React, { useState, useEffect } from 'react';
import { Sliders, X, CheckCircle2, AlertTriangle, Truck, Save } from 'lucide-react';
import { settingsApi, couriersApi } from '../api';

export function SettingsPanel({ onSaveSuccess }) {
  const [settings, setSettings] = useState({});
  const [couriers, setCouriers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingCourier, setEditingCourier] = useState(null);
  const [courierNameInput, setCourierNameInput] = useState('');
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [sRes, cRes] = await Promise.all([
        settingsApi.get(),
        couriersApi.list()
      ]);
      setSettings(sRes.settings || {});
      setCouriers(cRes.couriers || []);
    } catch (err) {
      setError(err.message || "Failed to load settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSettingChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await settingsApi.update(settings);
      setMessage("Pricing rates, thresholds, and liability caps updated successfully!");
      if (onSaveSuccess) onSaveSuccess();
    } catch (err) {
      setError(err.message || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateCourier = async (courierId) => {
    if (!courierNameInput.trim()) return;
    try {
      await couriersApi.update(courierId, courierNameInput.trim());
      setEditingCourier(null);
      setCourierNameInput('');
      loadData();
    } catch (err) {
      alert(err.message || "Failed to update courier");
    }
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-slate-400 text-xs">
        Loading platform settings and courier fleets...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {message && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Courier Management Section */}
      <div className="space-y-3">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400 pb-2 border-b border-slate-800 flex items-center space-x-2">
          <Truck className="w-4 h-4 text-cyan-400" />
          <span>Courier Fleet Companies</span>
        </div>

        <div className="space-y-2">
          {couriers.map(c => (
            <div key={c.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
              <div>
                {editingCourier === c.id ? (
                  <input
                    type="text"
                    value={courierNameInput}
                    onChange={(e) => setCourierNameInput(e.target.value)}
                    className="px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-xs"
                  />
                ) : (
                  <span className="font-bold text-slate-200 text-sm">{c.name}</span>
                )}
                <div className="text-[10px] font-mono text-slate-500">{c.id}</div>
              </div>

              <div>
                {editingCourier === c.id ? (
                  <div className="flex space-x-1.5">
                    <button
                      onClick={() => handleUpdateCourier(c.id)}
                      className="px-2.5 py-1 rounded bg-indigo-600 text-white font-bold"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingCourier(null)}
                      className="px-2.5 py-1 rounded bg-slate-800 text-slate-300"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setEditingCourier(c.id);
                      setCourierNameInput(c.name);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition-colors"
                  >
                    Edit Name
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pricing & Rules Settings Form */}
      <form onSubmit={handleSaveSettings} className="space-y-4">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400 pb-2 border-b border-slate-800 flex items-center space-x-2">
          <Sliders className="w-4 h-4 text-indigo-400" />
          <span>Pricing Formulae & Parametric Thresholds</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Standard Goods Rate (e.g. 0.004 = 0.4%)</label>
            <input
              type="text"
              value={settings.standard_rate || ''}
              onChange={(e) => handleSettingChange('standard_rate', e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-mono text-slate-100"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Fragile Goods Rate (e.g. 0.008 = 0.8%)</label>
            <input
              type="text"
              value={settings.fragile_rate || ''}
              onChange={(e) => handleSettingChange('fragile_rate', e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-mono text-slate-100"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Clean Record Discount (0.20 = 20%)</label>
            <input
              type="text"
              value={settings.clean_discount || ''}
              onChange={(e) => handleSettingChange('clean_discount', e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-mono text-slate-100"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Minimum Premium Floor (USD)</label>
            <input
              type="text"
              value={settings.min_premium || ''}
              onChange={(e) => handleSettingChange('min_premium', e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-mono text-slate-100"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Default Courier Liability Cap (USD)</label>
            <input
              type="text"
              value={settings.liability_cap || ''}
              onChange={(e) => handleSettingChange('liability_cap', e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-mono text-slate-100"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Scan Gap Warning Threshold (Days)</label>
            <input
              type="text"
              value={settings.warn_days || ''}
              onChange={(e) => handleSettingChange('warn_days', e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-mono text-slate-100"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Parametric Lost Threshold (Days)</label>
            <input
              type="text"
              value={settings.lost_days || ''}
              onChange={(e) => handleSettingChange('lost_days', e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-mono text-slate-100"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Shock Flag Trigger (g-force)</label>
            <input
              type="text"
              value={settings.shock_threshold_g || ''}
              onChange={(e) => handleSettingChange('shock_threshold_g', e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-mono text-slate-100"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Delivered Weight Tolerance (%)</label>
            <input
              type="text"
              value={settings.weight_tolerance_pct || ''}
              onChange={(e) => handleSettingChange('weight_tolerance_pct', e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-mono text-slate-100"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Expedited Claim Limit (USD)</label>
            <input
              type="text"
              value={settings.auto_approve_limit || ''}
              onChange={(e) => handleSettingChange('auto_approve_limit', e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-mono text-slate-100"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Under-Review Advance Payout (0.50 = 50%)</label>
            <input
              type="text"
              value={settings.advance_pct || ''}
              onChange={(e) => handleSettingChange('advance_pct', e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-mono text-slate-100"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-slate-800 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/30 flex items-center space-x-1.5 transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? "Saving Changes..." : "Save Parametric Settings"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

export default function SettingsModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-cyan-400">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Platform Settings & Carrier Management</h2>
              <div className="text-xs text-slate-400">Configurable Parametric Rules & Pricing Controls</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[80vh] overflow-y-auto">
          <SettingsPanel onSaveSuccess={onClose} />
        </div>

      </div>
    </div>
  );
}

