import React, { useState, useEffect } from 'react';
import { 
  Shield, ShieldAlert, Sparkles, AlertTriangle, CheckCircle, Package, 
  ArrowLeft, ArrowRight, Truck, Check, HelpCircle, Lock, Info 
} from 'lucide-react';
import { shipmentsApi, couriersApi, quoteApi } from '../api';
import { useToast } from './Toast';

const DEFAULT_COURIERS = [
  { id: 'CR-FASTEX', name: 'FastEx' },
  { id: 'CR-SWIFTPOST', name: 'SwiftPost' },
  { id: 'CR-CITYLINK', name: 'CityLink' }
];

export default function BookingForm({ user, onShipmentCreated, onCancel }) {
  const { addToast } = useToast();
  const [couriers, setCouriers] = useState(DEFAULT_COURIERS);
  const [formData, setFormData] = useState({
    courier_id: 'CR-FASTEX',
    origin: '742 Evergreen Terrace, Springfield, IL 62704',
    destination: '123 Ocean Drive, Miami Beach, FL 33139',
    recipient: 'Dr. Alexander Wright (Quantum Labs)',
    category: 'Electronics',
    fragile: true,
    declared_value: 800.0,
    insured: true
  });

  const [quote, setQuote] = useState(null);
  const [advice, setAdvice] = useState([]);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Load couriers
  useEffect(() => {
    async function loadCouriers() {
      try {
        const res = await couriersApi.list();
        if (res.couriers && res.couriers.length > 0) {
          setCouriers(res.couriers);
          setFormData(prev => ({
            ...prev,
            courier_id: prev.courier_id && res.couriers.some(c => c.id === prev.courier_id)
              ? prev.courier_id
              : res.couriers[0].id
          }));
        }
      } catch (err) {
        console.error("Failed to load couriers from server, retaining default fleets", err);
      }
    }
    loadCouriers();
  }, []);

  // Update quote & packaging advice
  useEffect(() => {
    let active = true;
    async function updateQuote() {
      if (!formData.declared_value || formData.declared_value <= 0) return;
      setLoadingQuote(true);
      try {
        const res = await quoteApi.getQuote({
          declared_value: parseFloat(formData.declared_value),
          fragile: formData.fragile,
          category: formData.category,
          seller_id: user?.id
        });
        if (active) {
          setQuote(res.quote);
          setAdvice(res.packaging_advice);
        }
      } catch (err) {
        console.error("Quote error", err);
      } finally {
        if (active) setLoadingQuote(false);
      }
    }
    updateQuote();
    return () => { active = false; };
  }, [formData.declared_value, formData.fragile, formData.category, user?.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await shipmentsApi.create({
        courier_id: formData.courier_id,
        origin: formData.origin.trim(),
        destination: formData.destination.trim(),
        recipient: formData.recipient.trim(),
        category: formData.category,
        fragile: formData.fragile,
        declared_value: parseFloat(formData.declared_value),
        insured: formData.insured
      });
      addToast(`Shipment ${res.shipment.id} successfully booked!`, 'success');
      onShipmentCreated(res.shipment);
    } catch (err) {
      setError(err.message || "Failed to book shipment. Check all fields.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      
      {/* Top Header & Breadcrumb */}
      <div>
        <button
          onClick={onCancel}
          className="inline-flex items-center space-x-1.5 text-xs text-slate-400 hover:text-slate-200 mb-3 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Dashboard</span>
        </button>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Book Protected Shipment
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Select carrier dispatch, review dynamic packaging compliance, and activate parametric protection.
            </p>
          </div>
          <div className="flex items-center space-x-2 text-xs text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl shrink-0">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>Parametric Guarantee Active</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main 2-Column Booking Layout */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Form Controls (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Section 1: Carrier & Route */}
          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 pb-2 border-b border-slate-800 flex items-center justify-between">
              <span className="flex items-center space-x-2">
                <Truck className="w-4 h-4 text-cyan-400" />
                <span>1. Carrier Dispatch & Addresses</span>
              </span>
              <span className="text-[11px] text-slate-500">Step 1 of 3</span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-slate-300">
                  Assigned Carrier Network *
                </label>
                <span className="text-[11px] text-indigo-400 font-medium">
                  Selected: {couriers.find(c => c.id === formData.courier_id)?.name || "FastEx"}
                </span>
              </div>

              {/* 1-Click Interactive Carrier Cards (Always visible, responsive) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                {couriers.map(c => {
                  const isSelected = formData.courier_id === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, courier_id: c.id }))}
                      className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-600/20 border-indigo-500 shadow-md shadow-indigo-500/10'
                          : 'bg-[#0B0F19] border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="w-8 h-8 rounded-lg bg-slate-800/80 border border-slate-700/80 flex items-center justify-center text-cyan-400">
                          <Truck className="w-4 h-4" />
                        </div>
                        {isSelected ? (
                          <div className="w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center shadow-sm">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full border border-slate-700 bg-slate-900"></div>
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-sm text-white">{c.name}</div>
                        <div className="text-[11px] text-slate-400 mt-1 flex items-center space-x-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          <span>Integrated Telemetry</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Explicitly styled dropdown selector for accessibility */}
              <select
                value={formData.courier_id}
                onChange={(e) => setFormData(prev => ({ ...prev, courier_id: e.target.value }))}
                required
                className="w-full px-3.5 py-2.5 bg-[#0B0F19] border border-slate-800 rounded-xl text-xs text-white font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
                style={{ backgroundColor: '#0B0F19', color: '#ffffff' }}
              >
                {couriers.length === 0 ? (
                  <option value="CR-FASTEX" style={{ backgroundColor: '#111827', color: '#ffffff' }}>
                    FastEx — Direct Integrated Telemetry
                  </option>
                ) : (
                  couriers.map(c => (
                    <option 
                      key={c.id} 
                      value={c.id}
                      style={{ backgroundColor: '#111827', color: '#ffffff' }}
                    >
                      {c.name} — Direct Integrated Telemetry
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Origin Facility / Address *</label>
                <input
                  type="text"
                  required
                  value={formData.origin}
                  onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
                  placeholder="Street, City, State, ZIP"
                  className="w-full px-3.5 py-2.5 bg-[#0B0F19] border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Destination Address *</label>
                <input
                  type="text"
                  required
                  value={formData.destination}
                  onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                  placeholder="Street, City, State, ZIP"
                  className="w-full px-3.5 py-2.5 bg-[#0B0F19] border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Recipient Name / Attention *</label>
              <input
                type="text"
                required
                value={formData.recipient}
                onChange={(e) => setFormData({ ...formData, recipient: e.target.value })}
                placeholder="Individual or company receiving the shipment"
                className="w-full px-3.5 py-2.5 bg-[#0B0F19] border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Section 2: Parcel Specs & Valuation */}
          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 pb-2 border-b border-slate-800 flex items-center justify-between">
              <span className="flex items-center space-x-2">
                <Package className="w-4 h-4 text-indigo-400" />
                <span>2. Parcel Classification & Valuation</span>
              </span>
              <span className="text-[11px] text-slate-500">Step 2 of 3</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Commodity Category *</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-[#0B0F19] border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                >
                  <option value="Electronics">Electronics & Computing</option>
                  <option value="Precision Instruments">Precision Instruments & Optics</option>
                  <option value="Cosmetics & Liquids">Cosmetics & Liquids</option>
                  <option value="Apparel & Shoes">Apparel & Textiles</option>
                  <option value="Home & Kitchen">Home & Ceramics</option>
                  <option value="General Merchandise">General Merchandise</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Declared Value (USD) *</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-slate-500 font-bold">$</span>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    value={formData.declared_value}
                    onChange={(e) => setFormData({ ...formData, declared_value: e.target.value })}
                    className="w-full pl-8 pr-3.5 py-2.5 bg-[#0B0F19] border border-slate-800 rounded-xl text-xs font-mono font-bold text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Fragility Toggle */}
            <div className="p-4 rounded-xl bg-[#0B0F19] border border-slate-800 flex items-center justify-between">
              <div>
                <div className="font-bold text-xs text-slate-200">Fragile or Sensitive Cargo Handling</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Applies 0.8% coverage rate. Mandates shock sensing and dual-side FRAGILE stickers.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, fragile: !formData.fragile })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  formData.fragile ? 'bg-amber-500' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.fragile ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Protection Plan Toggle */}
            <div className={`p-4 rounded-xl border transition-all ${
              formData.insured 
                ? 'bg-indigo-950/20 border-indigo-500/40 shadow-md' 
                : 'bg-[#0B0F19] border-slate-800'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-xs text-white flex items-center space-x-2">
                      <span>CargoPulse Parametric Protection</span>
                      <span className="text-[10px] px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                        Zero Deductible
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Full coverage up to declared ${parseFloat(formData.declared_value || 0).toFixed(2)}. Uninsured parcels capped at default $100.
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, insured: !formData.insured })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    formData.insured ? 'bg-cyan-500' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-slate-950 transition-transform ${
                      formData.insured ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-xl shadow-indigo-600/25 flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
          >
            {submitting ? (
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
            ) : (
              <>
                <span>
                  Confirm & Dispatch Booking ({formData.insured ? `$${quote?.final_premium?.toFixed(2) || '0.00'} Premium` : 'Uninsured'})
                </span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

        </div>

        {/* Right Column: Policy Invoice Summary & Real-Time Packaging Advice (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Policy Invoice Summary Card */}
          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 pb-3 border-b border-slate-800 flex items-center justify-between">
              <span>Protection Invoice & Coverage</span>
              {loadingQuote && <span className="text-[10px] text-cyan-400 animate-pulse">Recalculating...</span>}
            </div>

            {quote ? (
              <div className="space-y-3 text-xs">
                
                <div className="flex justify-between items-center text-slate-300">
                  <span>Declared Cargo Value:</span>
                  <span className="font-mono font-bold text-white">${quote.declared_value.toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-center text-slate-300">
                  <span>
                    Premium Rate ({formData.fragile ? '0.8% Fragile' : '0.4% Standard'}):
                  </span>
                  <span className="font-mono text-slate-200">${quote.base_premium.toFixed(2)}</span>
                </div>

                {quote.qualifies_clean_discount ? (
                  <div className="flex justify-between items-center text-emerald-400 bg-emerald-950/20 p-2 rounded-lg border border-emerald-800/40 font-medium">
                    <span className="flex items-center space-x-1">
                      <Check className="w-3.5 h-3.5" />
                      <span>Clean Seller Discount ({quote.discount_percent}% Off):</span>
                    </span>
                    <span className="font-mono font-bold">-${quote.discount_amount.toFixed(2)}</span>
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-500 italic">
                    Seller claims ratio exceeds 2% discount threshold.
                  </div>
                )}

                <div className="pt-2 border-t border-slate-800 flex justify-between items-baseline">
                  <span className="font-bold text-white text-sm">Net Protection Premium:</span>
                  <span className="font-mono font-black text-cyan-400 text-xl">
                    {formData.insured ? `$${quote.final_premium.toFixed(2)}` : '$0.00'}
                  </span>
                </div>

                {/* Coverage Cap Comparison */}
                <div className="p-3.5 rounded-xl bg-[#0B0F19] border border-slate-800/80 space-y-1 mt-2 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Policy Liability Limit:</span>
                    <strong className="text-slate-200 font-mono">
                      {formData.insured ? `$${quote.coverage_if_insured.toFixed(2)} (Full Value)` : `$${quote.courier_liability_cap.toFixed(2)} (Carrier Default Cap)`}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Deductible:</span>
                    <strong className="text-emerald-400 font-mono">$0.00 (Zero Deductible)</strong>
                  </div>
                </div>

              </div>
            ) : (
              <div className="py-6 text-center text-xs text-slate-500">
                Enter declared value to calculate rate.
              </div>
            )}
          </div>

          {/* Dynamic Prevention Guidance Advisor */}
          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 pb-3 border-b border-slate-800 flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span>Prevention Packaging Guidance</span>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              CargoPulse generates mandatory handling packaging specifications dynamically to minimize transit shock:
            </p>

            <div className="space-y-2.5">
              {advice.map((item, idx) => {
                const isCrit = item.level === 'critical';
                const isHV = item.level === 'high_value';
                return (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border text-xs transition-all ${
                      isCrit
                        ? 'bg-amber-950/20 border-amber-500/40 text-amber-200'
                        : isHV
                        ? 'bg-cyan-950/20 border-cyan-500/40 text-cyan-200'
                        : 'bg-[#0B0F19] border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="font-bold flex items-center space-x-1.5 mb-1">
                      {isCrit ? <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" /> : <Shield className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
                      <span>{item.title}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 leading-relaxed">
                      {item.detail}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

      </form>

    </div>
  );
}
