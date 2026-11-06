import React, { useState, useEffect } from 'react';
import { 
  Shield, ShieldAlert, ArrowLeft, Package, Truck, CheckCircle2, 
  AlertTriangle, Clock, Camera, Zap, Scale, MapPin, DollarSign, 
  FileText, Plus, AlertOctagon, History, Copy, ExternalLink, X, ZoomIn
} from 'lucide-react';
import { shipmentsApi } from '../api';
import PickupModal from './PickupModal';
import CourierScanModal from './CourierScanModal';
import ClaimModal from './ClaimModal';
import { useToast } from './Toast';

export default function ShipmentDetail({ 
  shipmentId, 
  user, 
  onBack, 
  onViewClaim 
}) {
  const { addToast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modals
  const [showPickupModal, setShowPickupModal] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [expandedPhoto, setExpandedPhoto] = useState(null);

  // Supersede state for admin
  const [showSupersedeInput, setShowSupersedeInput] = useState(false);
  const [supersedeNote, setSupersedeNote] = useState('');
  const [supersedeWeight, setSupersedeWeight] = useState('');
  const [superseding, setSuperseding] = useState(false);

  const loadDetail = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await shipmentsApi.get(shipmentId);
      setData(res);
      if (res.pickup) {
        setSupersedeWeight(res.pickup.weight_kg.toString());
      }
    } catch (err) {
      setError(err.message || "Failed to load shipment details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
  }, [shipmentId]);

  const copyTracking = () => {
    navigator.clipboard.writeText(shipmentId);
    addToast(`Tracking number ${shipmentId} copied!`, 'success');
  };

  const handleSupersede = async (e) => {
    e.preventDefault();
    if (!supersedeNote.trim() || !supersedeWeight) return;
    setSuperseding(true);
    try {
      await shipmentsApi.supersedePickup(shipmentId, {
        weight_kg: parseFloat(supersedeWeight),
        dims_cm: data.pickup.dims_cm,
        condition: data.pickup.condition,
        photo_urls: data.pickup.photo_urls,
        audit_note: supersedeNote.trim()
      });
      addToast("Pickup baseline superseded and logged to audit trail.", "success");
      setShowSupersedeInput(false);
      setSupersedeNote('');
      loadDetail();
    } catch (err) {
      alert(err.message || "Failed to supersede pickup");
    } finally {
      setSuperseding(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-20 text-center">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        <div className="text-xs text-slate-400 font-mono">Syncing telemetry data for {shipmentId}...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
        <AlertTriangle className="w-10 h-10 text-rose-400 mx-auto" />
        <h2 className="text-lg font-bold text-white">Record Not Found</h2>
        <p className="text-xs text-slate-400">{error || "Unable to retrieve tracking telemetry."}</p>
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-semibold hover:bg-slate-700"
        >
          Return to Directory
        </button>
      </div>
    );
  }

  const { shipment, pickup, timeline, claim } = data;
  const isLost = shipment.status === 'lost';
  const hasScanGapWarning = shipment.has_scan_gap_warning;

  // Stepper milestones
  const steps = [
    { key: 'booked', label: 'Booked' },
    { key: 'picked_up', label: 'Handover Baseline' },
    { key: 'in_transit', label: 'In Transit' },
    { key: 'hub', label: 'Hub Sorting' },
    { key: 'out_for_delivery', label: 'Out for Delivery' },
    { key: 'delivered', label: 'Delivered' }
  ];

  const currentStepIdx = isLost 
    ? -1 
    : steps.findIndex(s => s.key === shipment.status);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      
      {/* Top Header & Breadcrumb */}
      <div>
        <button
          onClick={onBack}
          className="inline-flex items-center space-x-1.5 text-xs text-slate-400 hover:text-slate-200 mb-3 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Shipments</span>
        </button>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-6 rounded-2xl bg-[#111827] border border-slate-800 shadow-xl">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="text-xl sm:text-2xl font-black text-white font-mono">{shipment.id}</span>
              <button
                onClick={copyTracking}
                title="Copy Tracking ID"
                className="p-1 rounded text-slate-400 hover:text-white transition-colors"
              >
                <Copy className="w-4 h-4" />
              </button>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                shipment.status === 'delivered' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                shipment.status === 'lost' ? 'bg-rose-950 text-rose-400 border border-rose-800 animate-pulse' :
                shipment.status === 'booked' ? 'bg-slate-800 text-slate-300 border border-slate-700' :
                'bg-cyan-950 text-cyan-400 border border-cyan-800'
              }`}>
                {shipment.status.replace('_', ' ')}
              </span>
            </div>
            <div className="text-xs text-slate-400 flex items-center space-x-2">
              <span>Carrier: <strong className="text-white">{shipment.courier_name}</strong></span>
              <span>•</span>
              <span>Booked on {shipment.created_at.slice(0, 10)}</span>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            {!pickup && (user.role === 'seller' || user.role === 'courier' || user.role === 'admin') && (
              <button
                onClick={() => setShowPickupModal(true)}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/30 flex items-center space-x-1.5 transition-all"
              >
                <Camera className="w-4 h-4" />
                <span>Record Pickup Evidence</span>
              </button>
            )}

            {(user.role === 'courier' || user.role === 'admin') && (
              <button
                onClick={() => setShowScanModal(true)}
                className="px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold shadow-md shadow-cyan-500/20 flex items-center space-x-1.5 transition-all"
              >
                <Truck className="w-4 h-4" />
                <span>Log Custody Scan</span>
              </button>
            )}

            {user.role === 'seller' && !claim && (
              <button
                onClick={() => setShowClaimModal(true)}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white text-xs font-bold shadow-md shadow-rose-600/20 flex items-center space-x-1.5 transition-all"
              >
                <ShieldAlert className="w-4 h-4" />
                <span>File Protection Claim</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Visual Stepper Milestone Bar */}
      <div className="p-6 rounded-2xl bg-[#111827] border border-slate-800 shadow-xl overflow-x-auto">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-4">
          Custody Progression Pipeline
        </div>
        <div className="flex items-center justify-between min-w-[550px] relative">
          {/* Background connecting line */}
          <div className="absolute top-4 left-6 right-6 h-0.5 bg-slate-800 -z-0"></div>
          
          {steps.map((st, i) => {
            const isCompleted = currentStepIdx >= i;
            const isCurrent = currentStepIdx === i;

            return (
              <div key={st.key} className="flex flex-col items-center relative z-10">
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all ${
                  isCompleted 
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/30' 
                    : isCurrent
                    ? 'bg-cyan-500 border-cyan-400 text-slate-950 shadow-md shadow-cyan-500/30'
                    : 'bg-[#0B0F19] border-slate-800 text-slate-500'
                }`}>
                  {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                </div>
                <span className={`text-[11px] font-medium mt-2 whitespace-nowrap ${
                  isCurrent ? 'text-cyan-400 font-bold' : isCompleted ? 'text-slate-200' : 'text-slate-500'
                }`}>
                  {st.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Critical Warnings if any */}
      {isLost && (
        <div className="p-5 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-rose-200 flex items-start space-x-3.5 shadow-lg">
          <AlertOctagon className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <strong className="block text-sm font-bold text-rose-300 mb-0.5">Parametric Loss Classification Active</strong>
            Zero movement scans recorded for over 14 consecutive days. Parcel marked lost under Rule C. Any loss claim filed on this shipment will trigger instant auto-approval.
          </div>
        </div>
      )}

      {hasScanGapWarning && !isLost && (
        <div className="p-5 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-amber-200 flex items-start space-x-3.5 shadow-lg">
          <Clock className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <strong className="block text-sm font-bold text-amber-300 mb-0.5">Custody Scan Gap Detected</strong>
            Last recorded scan occurred <strong className="font-mono text-white">{shipment.days_since_last_activity} days ago</strong>. Ops alert queue has flagged this parcel for carrier investigation.
          </div>
        </div>
      )}

      {/* Main Grid: Left Details & Right Custody Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column (5 Cols): Parcel Spec, Evidence Baseline, Claim Card */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Parcel & Policy Specifications Card */}
          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 pb-3 border-b border-slate-800 flex items-center justify-between">
              <span>Parcel Specifications</span>
              <span className="font-mono text-cyan-400">{shipment.category}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block mb-0.5">Declared Cargo Value</span>
                <span className="font-mono font-bold text-white text-sm">${shipment.declared_value.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">Coverage Plan</span>
                <span className={`font-bold flex items-center space-x-1 ${shipment.insured ? 'text-emerald-400' : 'text-slate-400'}`}>
                  <Shield className="w-3.5 h-3.5 shrink-0" />
                  <span>{shipment.insured ? `Protected ($${shipment.premium.toFixed(2)})` : 'Uninsured ($100 cap)'}</span>
                </span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">Handling Standard</span>
                <span className={shipment.fragile ? 'text-amber-400 font-bold' : 'text-slate-300'}>
                  {shipment.fragile ? '⚠️ Fragile Sensitive' : 'Standard Handling'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">Carrier Partner</span>
                <span className="font-semibold text-slate-200">{shipment.courier_name}</span>
              </div>
            </div>

            {/* Address Route Card */}
            <div className="p-3.5 rounded-xl bg-[#0B0F19] border border-slate-800/80 space-y-2 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500">Origin Dispatch</span>
                <div className="text-slate-300 font-medium">{shipment.origin}</div>
              </div>
              <div className="pt-2 border-t border-slate-800/80">
                <span className="text-[10px] uppercase font-bold text-slate-500">Destination & Consignee</span>
                <div className="text-white font-bold">{shipment.recipient}</div>
                <div className="text-slate-400 text-[11px]">{shipment.destination}</div>
              </div>
            </div>
          </div>

          {/* Pickup Evidence Baseline Vault Card */}
          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 pb-3 border-b border-slate-800 flex items-center justify-between">
              <span className="flex items-center space-x-1.5">
                <Camera className="w-4 h-4 text-indigo-400" />
                <span>Pickup Evidence Baseline</span>
              </span>
              {pickup && (
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full">
                  Verified Vault
                </span>
              )}
            </div>

            {pickup ? (
              <div className="space-y-4 text-xs">
                
                {/* Physical measurements */}
                <div className="grid grid-cols-3 gap-2 p-3 bg-[#0B0F19] rounded-xl border border-slate-800 text-center">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Baseline Weight</span>
                    <span className="font-mono font-bold text-white text-sm">{pickup.weight_kg} kg</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Dimensions</span>
                    <span className="font-mono font-bold text-slate-200">{pickup.dims_cm} cm</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Condition</span>
                    <span className="font-bold capitalize text-emerald-400">{pickup.condition.replace('_', ' ')}</span>
                  </div>
                </div>

                {/* Evidence Photo Lightbox Gallery */}
                {pickup.photo_urls && pickup.photo_urls.length > 0 && (
                  <div>
                    <div className="text-[11px] font-semibold text-slate-300 mb-2">
                      Verified Handover Photos ({pickup.photo_urls.length}):
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {pickup.photo_urls.map((url, i) => (
                        <div
                          key={i}
                          onClick={() => setExpandedPhoto(url)}
                          className="aspect-video rounded-xl overflow-hidden border border-slate-800 bg-[#0B0F19] relative cursor-pointer group hover:border-indigo-500/50 transition-all"
                        >
                          <img src={url} alt={`Pickup Photo ${i + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <ZoomIn className="w-4 h-4 text-white" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {pickup.audit_note && (
                  <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-800/50 text-[11px] text-purple-200 leading-relaxed">
                    <strong>Admin Override Note:</strong> {pickup.audit_note}
                  </div>
                )}

                {/* Admin Supersede Action */}
                {user.role === 'admin' && !showSupersedeInput && (
                  <button
                    onClick={() => setShowSupersedeInput(true)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 underline font-semibold block pt-1"
                  >
                    Supersede Baseline Baseline with Audit Note (Admin)
                  </button>
                )}

                {user.role === 'admin' && showSupersedeInput && (
                  <form onSubmit={handleSupersede} className="p-3.5 rounded-xl bg-[#0B0F19] border border-slate-800 space-y-2.5 mt-2">
                    <div className="text-xs font-bold text-purple-300">Admin Supersede Baseline</div>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={supersedeWeight}
                      onChange={(e) => setSupersedeWeight(e.target.value)}
                      placeholder="Corrected Weight (kg)"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono"
                    />
                    <textarea
                      rows={2}
                      required
                      value={supersedeNote}
                      onChange={(e) => setSupersedeNote(e.target.value)}
                      placeholder="Audit justification for superseding pickup baseline..."
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                    />
                    <div className="flex space-x-2 pt-1">
                      <button
                        type="submit"
                        disabled={superseding}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold"
                      >
                        {superseding ? "Recording..." : "Save Audit Correction"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowSupersedeInput(false)}
                        className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-500 space-y-3">
                <Camera className="w-8 h-8 text-slate-700 mx-auto" />
                <div>No pickup check recorded yet.</div>
                {(user.role === 'seller' || user.role === 'courier' || user.role === 'admin') && (
                  <button
                    onClick={() => setShowPickupModal(true)}
                    className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow"
                  >
                    + Record Pickup Baseline Now
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Associated Claim Card if on record */}
          {claim && (
            <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 pb-3 border-b border-slate-800 flex items-center justify-between">
                <span>Associated Protection Claim</span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  claim.status === 'auto_approved' || claim.status === 'approved' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                  claim.status === 'denied' ? 'bg-rose-950 text-rose-400 border border-rose-800' :
                  'bg-amber-950 text-amber-300 border border-amber-800'
                }`}>
                  {claim.status.replace('_', ' ')}
                </span>
              </div>

              <div className="text-xs space-y-3">
                <div className="flex justify-between items-center text-slate-300">
                  <span>Claim Reference:</span>
                  <span className="font-mono font-bold text-white">{claim.id}</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>Claimed Incident:</span>
                  <span className="capitalize font-semibold text-slate-200">{claim.type} in Transit</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>Claimed Amount:</span>
                  <span className="font-mono font-bold text-slate-200">
                    ${claim.claimed_amount != null ? Number(claim.claimed_amount).toFixed(2) : '0.00'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>Approved Coverage:</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {claim.approved_amount != null ? `$${Number(claim.approved_amount).toFixed(2)}` : 'Pending review'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>Decided Date:</span>
                  <span className="font-mono text-slate-400">
                    {claim.decided_at ? claim.decided_at.slice(0, 10) : '—'}
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-800/80 flex justify-between items-baseline">
                  <span className="font-bold text-white">Disbursed Payout:</span>
                  <span className="font-mono font-black text-cyan-400 text-lg">
                    ${claim.payout_now != null ? Number(claim.payout_now).toFixed(2) : '0.00'}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-[#0B0F19] border border-slate-800 text-[11px] text-slate-300 leading-relaxed">
                  <strong className="block text-slate-400 mb-1">Adjudication Ruling:</strong>
                  {claim.reason}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Right Column (7 Cols): Custody Tracking Timeline & Sensor Telemetry */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 pb-3 border-b border-slate-800 flex items-center justify-between">
              <span className="flex items-center space-x-2">
                <Truck className="w-4 h-4 text-cyan-400" />
                <span>Custody Chain Timeline & Telemetry Telemetry</span>
              </span>
              <span className="text-[11px] font-mono text-slate-400">{timeline.length} Scans</span>
            </div>

            {timeline.length === 0 ? (
              <div className="py-16 text-center text-xs text-slate-500">
                No telemetry scans recorded yet.
              </div>
            ) : (
              <div className="relative pl-6 mt-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-800">
                {timeline.map((event, idx) => {
                  const hasShock = event.flags && event.flags.includes("shock");
                  const hasWeightMismatch = event.flags && event.flags.includes("weight_mismatch");
                  const isLostEvent = event.status === "lost";

                  return (
                    <div key={event.id || idx} className="relative group">
                      
                      {/* Node bullet */}
                      <div className={`absolute -left-[27px] top-1.5 w-4 h-4 rounded-full border-2 bg-[#0B0F19] flex items-center justify-center ${
                        isLostEvent ? 'border-rose-500 bg-rose-950' :
                        hasShock ? 'border-amber-400 bg-amber-950' :
                        hasWeightMismatch ? 'border-amber-500 bg-amber-950' :
                        event.status === 'delivered' ? 'border-emerald-400 bg-emerald-950' :
                        'border-cyan-400 bg-cyan-950'
                      }`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${
                          isLostEvent ? 'bg-rose-400' :
                          hasShock ? 'bg-amber-400' :
                          hasWeightMismatch ? 'bg-amber-400' :
                          event.status === 'delivered' ? 'bg-emerald-400' :
                          'bg-cyan-400'
                        }`} />
                      </div>

                      {/* Event Container */}
                      <div className={`p-4 rounded-xl border text-xs transition-all ${
                        hasShock
                          ? 'bg-amber-950/20 border-amber-500/40 shadow-lg shadow-amber-950/20'
                          : hasWeightMismatch
                          ? 'bg-amber-950/20 border-amber-500/40'
                          : isLostEvent
                          ? 'bg-rose-950/30 border-rose-500/40'
                          : 'bg-[#0B0F19] border-slate-800'
                      }`}>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-1.5">
                          <div className="font-bold text-sm text-white flex items-center space-x-2">
                            <span>{event.location}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                              event.status === 'delivered' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                              event.status === 'lost' ? 'bg-rose-950 text-rose-400 border border-rose-800' :
                              'bg-slate-800 text-slate-300'
                            }`}>
                              {event.status.replace('_', ' ')}
                            </span>
                          </div>
                          <span className="font-mono text-[11px] text-slate-400">
                            {event.created_at}
                          </span>
                        </div>

                        {/* Telemetry Sensor Metrics */}
                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 mt-2">
                          {event.shock_g !== null && event.shock_g !== undefined && event.shock_g > 0 && (
                            <div className={`flex items-center space-x-1 font-mono ${
                              hasShock ? 'text-amber-400 font-bold' : 'text-slate-400'
                            }`}>
                              <Zap className="w-3.5 h-3.5" />
                              <span>{event.shock_g.toFixed(1)} g</span>
                            </div>
                          )}

                          {event.weight_kg !== null && event.weight_kg !== undefined && (
                            <div className={`flex items-center space-x-1 font-mono ${
                              hasWeightMismatch ? 'text-amber-400 font-bold' : 'text-slate-400'
                            }`}>
                              <Scale className="w-3.5 h-3.5" />
                              <span>{event.weight_kg.toFixed(2)} kg</span>
                            </div>
                          )}

                          {event.recorded_by_name && (
                            <span className="text-slate-500 text-[10px]">
                              Logged by {event.recorded_by_name}
                            </span>
                          )}
                        </div>

                        {/* Telemetry Alert Flags */}
                        {hasShock && (
                          <div className="mt-2.5 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-semibold flex items-center space-x-1.5">
                            <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span>FLAGGED: Shock impact of {event.shock_g.toFixed(1)}g exceeds 10.0g threshold. Validates damage claim automatically under Rule D.</span>
                          </div>
                        )}

                        {hasWeightMismatch && (
                          <div className="mt-2.5 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-semibold flex items-center space-x-1.5">
                            <Scale className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span>FLAGGED: Delivered weight exceeds &gt;5% variance from handover baseline. Potential tampering or partial loss.</span>
                          </div>
                        )}
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Photo Lightbox Modal */}
      {expandedPhoto && (
        <div 
          onClick={() => setExpandedPhoto(null)} 
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl border border-slate-700 bg-slate-950">
            <img src={expandedPhoto} alt="Evidence Zoom" className="w-full h-full object-contain" />
            <button
              onClick={() => setExpandedPhoto(null)}
              className="absolute top-3 right-3 p-2 rounded-full bg-slate-900/80 text-white hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="absolute bottom-3 left-4 text-xs font-mono text-slate-300 bg-slate-950/80 px-2.5 py-1 rounded-lg">
              Verified Handover Baseline Photo
            </div>
          </div>
        </div>
      )}

      {/* Action Modals */}
      {showPickupModal && (
        <PickupModal
          shipment={shipment}
          onClose={() => setShowPickupModal(false)}
          onPickupRecorded={() => {
            setShowPickupModal(false);
            loadDetail();
          }}
        />
      )}

      {showScanModal && (
        <CourierScanModal
          shipment={shipment}
          onClose={() => setShowScanModal(false)}
          onScanRecorded={() => {
            setShowScanModal(false);
            loadDetail();
          }}
        />
      )}

      {showClaimModal && (
        <ClaimModal
          shipment={shipment}
          onClose={() => setShowClaimModal(false)}
          onClaimFiled={() => {
            setShowClaimModal(false);
            loadDetail();
          }}
        />
      )}

    </div>
  );
}
