import React, { useState, useEffect } from 'react';
import { 
  Package, Shield, AlertTriangle, Plus, Search, Filter, 
  ChevronRight, Camera, Clock, CheckCircle2, DollarSign, ShieldCheck, 
  Copy, Download, ExternalLink, ArrowRight, Zap, Scale
} from 'lucide-react';
import { shipmentsApi, claimsApi } from '../api';
import { useToast } from './Toast';

export default function SellerDashboard({ user, onBookNew, onSelectShipment, onFileClaim }) {
  const { addToast } = useToast();
  const [shipments, setShipments] = useState([]);
  const [claims, setClaims] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [carrierFilter, setCarrierFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [shpRes, claimsRes] = await Promise.all([
        shipmentsApi.list({ q: searchQuery, status: statusFilter }),
        claimsApi.list()
      ]);
      setShipments(shpRes.shipments || []);
      setClaims(claimsRes.claims || []);
    } catch (err) {
      setError(err.message || "Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [searchQuery, statusFilter]);

  const copyTracking = (e, id) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    addToast(`Tracking number ${id} copied to clipboard!`, 'success');
  };

  // Export CSV of Manifest
  const exportManifestCSV = () => {
    if (!shipments.length) return;
    const headers = "ID,Recipient,Carrier,Status,Value,Insured,Premium,Origin,Destination,Date\n";
    const rows = shipments.map(s => 
      `"${s.id}","${s.recipient}","${s.courier_name}","${s.status}",${s.declared_value},${s.insured ? 'YES' : 'NO'},${s.premium},"${s.origin}","${s.destination}","${s.created_at}"`
    ).join("\n");
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ShipGuard_Manifest_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    addToast("Shipment manifest exported successfully.", "info");
  };

  // Filtered by carrier
  const displayedShipments = carrierFilter === 'ALL' 
    ? shipments 
    : shipments.filter(s => s.courier_name.toLowerCase().includes(carrierFilter.toLowerCase()));

  // Metrics
  const totalShipments = shipments.length;
  const activeShipments = shipments.filter(s => s.status !== 'delivered' && s.status !== 'lost').length;
  const lostShipments = shipments.filter(s => s.status === 'lost').length;
  const warningShipments = shipments.filter(s => s.has_scan_gap_warning);
  const totalClaims = claims.length;
  const claimsRatio = totalShipments > 0 ? (totalClaims / totalShipments) : 0;
  const qualifiesCleanDiscount = claimsRatio < 0.02;

  const totalProtectedValue = shipments.reduce((sum, s) => sum + (s.insured ? s.declared_value : 0), 0);
  const totalDisbursed = claims.reduce((sum, c) => sum + (c.payout_now || 0), 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Top Enterprise Greeting & Primary CTA Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 p-6 sm:p-8 rounded-2xl bg-[#111827] border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="space-y-1 relative z-10">
          <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-indigo-400">
            <span>Enterprise Merchant Console</span>
            <span>•</span>
            <span className="text-slate-300 font-bold">{user.name}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Protected Parcels & Custody Telemetry
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
            Real-time multi-carrier custody oversight, automated shock and weight telemetry verification, and parametric claims settlement.
          </p>
        </div>

        <div className="flex items-center gap-3 relative z-10 shrink-0">
          <button
            onClick={exportManifestCSV}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700/80 transition-colors flex items-center space-x-2"
          >
            <Download className="w-4 h-4 text-slate-400" />
            <span>Export Manifest</span>
          </button>
          
          <button
            onClick={onBookNew}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/25 flex items-center space-x-2 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Book Protected Parcel</span>
          </button>
        </div>
      </div>

      {/* High-Priority Inactivity Scan Gap Alert */}
      {warningShipments.length > 0 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-950/30 border border-amber-500/40 text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-start sm:items-center space-x-3 text-xs">
            <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <span className="font-bold text-amber-300 text-sm">
                Custody Movement Warning ({warningShipments.length} Active Parcels):
              </span>{" "}
              <span>Parcels {warningShipments.map(s => s.id).slice(0, 3).join(', ')} have not recorded a carrier scan in &gt; 48 hours.</span>
            </div>
          </div>
          <button
            onClick={() => setStatusFilter('')}
            className="text-xs text-amber-400 hover:text-amber-300 font-bold underline shrink-0"
          >
            Filter Inactive Parcels
          </button>
        </div>
      )}

      {/* Executive Metric Cards Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Active In Transit */}
        <div className="p-5 rounded-2xl bg-[#111827] border border-slate-800/80 shadow-md">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>In-Transit Active</span>
            <Package className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-white">
            {activeShipments}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>Total on record: {totalShipments}</span>
            {lostShipments > 0 && <span className="text-rose-400 font-bold">{lostShipments} lost</span>}
          </div>
        </div>

        {/* Protected Value Under Guarantee */}
        <div className="p-5 rounded-2xl bg-[#111827] border border-slate-800/80 shadow-md">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Protected Cargo Value</span>
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-white">
            ${totalProtectedValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-indigo-300 mt-1">
            Backed by parametric guarantees
          </div>
        </div>

        {/* Claims Disbursed */}
        <div className="p-5 rounded-2xl bg-[#111827] border border-slate-800/80 shadow-md">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Total Claims Settled</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-400">
            ${totalDisbursed.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {totalClaims} filed ({claims.filter(c => c.status === 'auto_approved' || c.status === 'approved').length} approved)
          </div>
        </div>

        {/* Merchant Risk Ratio & 20% Discount */}
        <div className="p-5 rounded-2xl bg-[#111827] border border-slate-800/80 shadow-md">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Merchant Risk Grade</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-lg sm:text-xl font-black font-mono text-emerald-400 flex items-center space-x-1.5">
            <span>{qualifiesCleanDiscount ? "Clean • 20% Off" : "Standard Rate"}</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
            <span>Ratio: <strong className="font-mono text-white">{(claimsRatio * 100).toFixed(1)}%</strong></span>
            <span className="text-[10px] text-slate-500">&lt;2.0% threshold</span>
          </div>
        </div>

      </div>

      {/* Main Shipments Directory Table */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
        
        {/* Controls: Search, Carrier Filter, Status Chips */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-800/80">
          
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 flex-1 max-w-xl">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by tracking ID, recipient, or route..."
                className="w-full pl-10 pr-4 py-2 bg-[#0B0F19] border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Carrier Filter Dropdown */}
            <select
              value={carrierFilter}
              onChange={(e) => setCarrierFilter(e.target.value)}
              className="px-3 py-2 bg-[#0B0F19] border border-slate-800 rounded-xl text-xs text-slate-300 font-medium focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">All Carriers</option>
              <option value="FastEx">FastEx</option>
              <option value="SwiftPost">SwiftPost</option>
              <option value="CityLink">CityLink</option>
            </select>
          </div>

          {/* Status Filters */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {['', 'booked', 'in_transit', 'hub', 'out_for_delivery', 'delivered', 'lost'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all capitalize ${
                  statusFilter === st
                    ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                {st === '' ? 'All Status' : st.replace('_', ' ')}
              </button>
            ))}
          </div>

        </div>

        {/* Data Table */}
        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            Loading custody records...
          </div>
        ) : displayedShipments.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-500 space-y-3">
            <Package className="w-10 h-10 text-slate-700 mx-auto" />
            <div className="text-sm font-semibold text-slate-300">No shipments found</div>
            <p className="max-w-sm mx-auto text-slate-500 text-xs">
              {searchQuery || statusFilter || carrierFilter !== 'ALL'
                ? "Try adjusting your search filters or carrier selection."
                : "Book your first protected parcel to experience real-time custody telemetry."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6 sm:mx-0">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3">Tracking / ID</th>
                  <th className="px-4 py-3">Carrier & Route</th>
                  <th className="px-4 py-3">Custody Status</th>
                  <th className="px-4 py-3">Valuation & Plan</th>
                  <th className="px-4 py-3">Pickup Baseline</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {displayedShipments.map((shp) => {
                  const hasWarning = shp.has_scan_gap_warning;
                  return (
                    <tr
                      key={shp.id}
                      onClick={() => onSelectShipment(shp.id)}
                      className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                    >
                      {/* Tracking ID & Recipient */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-white group-hover:text-cyan-400 transition-colors">
                            {shp.id}
                          </span>
                          <button
                            onClick={(e) => copyTracking(e, shp.id)}
                            title="Copy Tracking ID"
                            className="p-1 rounded text-slate-500 hover:text-white transition-colors"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          {hasWarning && (
                            <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" title="Scan Inactivity Warning" />
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 truncate max-w-xs">{shp.recipient}</div>
                      </td>

                      {/* Carrier & Route */}
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-200 flex items-center space-x-1.5">
                          <span className={`w-2 h-2 rounded-full ${
                            shp.courier_name.includes('FastEx') ? 'bg-cyan-400' :
                            shp.courier_name.includes('SwiftPost') ? 'bg-amber-400' : 'bg-emerald-400'
                          }`}></span>
                          <span>{shp.courier_name}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 truncate max-w-xs mt-0.5">
                          {shp.origin.split(',')[0]} → {shp.destination.split(',')[0]}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          shp.status === 'delivered' ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/80' :
                          shp.status === 'lost' ? 'bg-rose-950/80 text-rose-400 border border-rose-800/80' :
                          shp.status === 'booked' ? 'bg-slate-800 text-slate-300 border border-slate-700' :
                          'bg-cyan-950/80 text-cyan-400 border border-cyan-800/80'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            shp.status === 'delivered' ? 'bg-emerald-400' :
                            shp.status === 'lost' ? 'bg-rose-400' :
                            shp.status === 'booked' ? 'bg-slate-400' : 'bg-cyan-400'
                          }`} />
                          <span>{shp.status.replace('_', ' ')}</span>
                        </span>
                      </td>

                      {/* Value & Coverage Plan */}
                      <td className="px-4 py-3.5">
                        <div className="font-mono font-bold text-slate-200">${shp.declared_value.toFixed(2)}</div>
                        <div className="text-[11px] flex items-center space-x-1 mt-0.5">
                          {shp.insured ? (
                            <span className="text-emerald-400 font-semibold flex items-center space-x-0.5">
                              <Shield className="w-3 h-3" />
                              <span>Protected (${shp.premium.toFixed(2)})</span>
                            </span>
                          ) : (
                            <span className="text-slate-500">Uninsured ($100 cap)</span>
                          )}
                        </div>
                      </td>

                      {/* Pickup Evidence Baseline */}
                      <td className="px-4 py-3.5">
                        {shp.pickup_id ? (
                          <div className="flex items-center space-x-1.5 text-emerald-400 text-[11px] font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span>{shp.pickup_weight_kg} kg verified</span>
                          </div>
                        ) : (
                          <span className="text-slate-500 text-[11px] italic">Handover check pending</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectShipment(shp.id);
                            }}
                            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
                          >
                            Track
                          </button>
                          <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-300 transition-colors" />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>

    </div>
  );
}
