import React, { useState } from 'react';
import { Truck, X, Zap, Scale, MapPin, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { shipmentsApi } from '../api';

export default function CourierScanModal({ shipment, onClose, onScanRecorded }) {
  const [status, setStatus] = useState('hub');
  const [location, setLocation] = useState('FastEx Central Sorting Hub #4');
  const [weightKg, setWeightKg] = useState('');
  const [shockG, setShockG] = useState('12.0');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const shockVal = parseFloat(shockG || 0);
  const isHighShock = shockVal >= 10.0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!location.trim()) {
      setError("Location note is required.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await shipmentsApi.recordScan(shipment.id, {
        status: status,
        location: location.trim(),
        weight_kg: weightKg ? parseFloat(weightKg) : null,
        shock_g: shockG !== '' ? parseFloat(shockG) : null
      });
      onScanRecorded(res.scan);
    } catch (err) {
      setError(err.message || "Failed to log courier scan.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Log Courier Custody Scan</h2>
              <div className="text-xs text-cyan-400 font-mono font-medium">{shipment.id}</div>
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
        <form onSubmit={handleSubmit} className="p-5 space-y-4">

          {/* Quick Demo Step 3 Button */}
          <div className="p-2.5 rounded-xl bg-slate-950 border border-cyan-500/30 flex items-center justify-between">
            <span className="text-xs text-slate-300 font-medium">Demo Scenario Step 3:</span>
            <button
              type="button"
              onClick={() => {
                setStatus('hub');
                setLocation('FastEx Central Sorting Hub #4');
                setShockG('12.0');
              }}
              className="px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs font-semibold hover:bg-cyan-500/30 transition-colors"
            >
              ⚡ Set Hub Scan + 12g Shock
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Custody Milestone */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Scan Milestone Status *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { key: 'in_transit', label: 'In Transit' },
                { key: 'hub', label: 'At Hub' },
                { key: 'out_for_delivery', label: 'Out for Deliv' },
                { key: 'delivered', label: 'Delivered' }
              ].map(opt => (
                <button
                  type="button"
                  key={opt.key}
                  onClick={() => setStatus(opt.key)}
                  className={`py-2 px-2 rounded-xl text-xs font-medium border text-center transition-all ${
                    status === opt.key
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Location Note */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Station / Location Note *
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Sorting Center 4, Terminal Bay 12"
                className="w-full pl-9 pr-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Shock Impact Reading */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-200 flex items-center space-x-1.5">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>Shock Sensor Impact (g-force)</span>
              </label>
              <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                isHighShock ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'text-slate-400'
              }`}>
                {shockVal.toFixed(1)} g
              </span>
            </div>

            <input
              type="number"
              step="0.1"
              min="0"
              value={shockG}
              onChange={(e) => setShockG(e.target.value)}
              placeholder="e.g. 12.0"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm font-mono text-slate-100 focus:outline-none focus:border-cyan-500"
            />

            {isHighShock && (
              <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] flex items-center space-x-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                <span>Impact &gt;= 10g triggers automatic "shock" irregularity flag for damage claim proof.</span>
              </div>
            )}
          </div>

          {/* Measured Weight (optional for mismatch check) */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-200 flex items-center space-x-1.5">
                <Scale className="w-4 h-4 text-indigo-400" />
                <span>Scale Weight (Optional / Delivered Check)</span>
              </label>
              <span className="text-[10px] text-slate-400">kg</span>
            </div>

            <input
              type="number"
              step="0.01"
              min="0"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              placeholder="Weight at scan point (kg)"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm font-mono text-slate-100 focus:outline-none focus:border-cyan-500"
            />
            {status === 'delivered' && (
              <div className="text-[11px] text-slate-400">
                If delivered weight differs by &gt; 5% from pickup baseline, a "weight_mismatch" flag will trigger.
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50 flex items-center justify-center space-x-1.5"
            >
              {submitting ? (
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Transmit Scan Telemetry</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}

