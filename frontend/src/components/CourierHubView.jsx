import React, { useState, useEffect } from 'react';
import { Truck, Scan, Search, Package, MapPin, Zap, ChevronRight, CheckCircle2 } from 'lucide-react';
import { shipmentsApi } from '../api';
import CourierScanModal from './CourierScanModal';

export default function CourierHubView({ user, onSelectShipment }) {
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeScanShipment, setActiveScanShipment] = useState(null);

  const loadShipments = async () => {
    try {
      setLoading(true);
      const res = await shipmentsApi.list({ q: search });
      setShipments(res.shipments || []);
    } catch (err) {
      console.error("Courier shipments error", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShipments();
  }, [search]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      
      {/* Courier Station Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-cyan-400 mb-1">
            <span>Courier Dispatch Terminal</span>
            <span>•</span>
            <span>{user.courier_name}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white">
            Mobile Scanning & Custody Log
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Logged in as {user.name}. You have authorization to transmit telemetry scans for {user.courier_name} parcels.
          </p>
        </div>

        <div className="text-xs font-mono px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 shrink-0">
          Carrier: <strong className="text-cyan-400">{user.courier_name}</strong>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Scan barcode or type parcel ID (e.g. SHP-)..."
          className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 shadow-md"
        />
      </div>

      {/* Deliveries List */}
      <div className="space-y-3">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
          Assigned Deliveries ({shipments.length})
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading deliveries...</div>
        ) : shipments.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500 bg-slate-900/60 rounded-2xl border border-slate-800 p-6">
            No parcels found for {user.courier_name}.
          </div>
        ) : (
          shipments.map(s => (
            <div
              key={s.id}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all"
            >
              <div
                className="cursor-pointer space-y-1 flex-1"
                onClick={() => onSelectShipment(s.id)}
              >
                <div className="flex items-center space-x-2">
                  <span className="font-mono font-bold text-sm text-white hover:text-cyan-400">{s.id}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    s.status === 'delivered' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                    s.status === 'lost' ? 'bg-rose-950 text-rose-400 border border-rose-800' :
                    'bg-cyan-950 text-cyan-300 border border-cyan-800'
                  }`}>
                    {s.status.replace('_', ' ')}
                  </span>
                  {s.fragile && (
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                      FRAGILE
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-300 font-medium">To: {s.recipient}</div>
                <div className="text-[11px] text-slate-500">{s.destination}</div>
              </div>

              <div className="flex items-center space-x-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                <button
                  onClick={() => setActiveScanShipment(s)}
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md shadow-cyan-500/20 flex items-center space-x-1.5 transition-all"
                >
                  <Scan className="w-4 h-4" />
                  <span>Scan Parcel</span>
                </button>
                <button
                  onClick={() => onSelectShipment(s.id)}
                  className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {activeScanShipment && (
        <CourierScanModal
          shipment={activeScanShipment}
          onClose={() => setActiveScanShipment(null)}
          onScanRecorded={() => {
            setActiveScanShipment(null);
            loadShipments();
          }}
        />
      )}

    </div>
  );
}

