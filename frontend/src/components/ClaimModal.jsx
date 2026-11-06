import React, { useState } from 'react';
import { ShieldCheck, AlertCircle, CheckCircle2, X, DollarSign, Upload, Clock, Ban, HelpCircle } from 'lucide-react';
import { claimsApi, uploadApi } from '../api';

export default function ClaimModal({ shipment, onClose, onClaimFiled }) {
  const [claimType, setClaimType] = useState('damage');
  const [claimedAmount, setClaimedAmount] = useState('600.00');
  const [description, setDescription] = useState(
    'Parcel received with crushed corners and shattered internal display after courier shock impact.'
  );
  const [damagePhotos, setDamagePhotos] = useState(['/uploads/damage_crushed_corner.jpg']);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Result view state after submission
  const [claimResult, setClaimResult] = useState(null);

  const coverageCap = shipment.insured ? shipment.declared_value : 100.0;

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of files) {
        const res = await uploadApi.uploadPhoto(file);
        setDamagePhotos(prev => [...prev, res.url]);
      }
    } catch (err) {
      setError(err.message || "Failed to upload photo");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const amt = parseFloat(claimedAmount);
    if (!amt || amt <= 0) {
      setError("Please specify a valid claimed amount greater than $0.");
      return;
    }

    if (!description.trim() || description.trim().length < 5) {
      setError("Please provide a description of at least 5 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await claimsApi.create({
        shipment_id: shipment.id,
        type: claimType,
        claimed_amount: amt,
        description: description.trim(),
        damage_photo_urls: damagePhotos
      });
      setClaimResult(res.claim);
      onClaimFiled(res.claim);
    } catch (err) {
      setError(err.message || "Failed to file claim.");
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
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-cyan-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {claimResult ? "Claim Decision Outcome" : "File Instant Protection Claim"}
              </h2>
              <div className="text-xs text-slate-400 font-mono font-medium">{shipment.id}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Claim Result View (Shown immediately upon filing) */}
        {claimResult ? (
          <div className="p-6 space-y-5 animate-in fade-in duration-200">
            
            {/* Status Banner */}
            <div className={`p-4 rounded-2xl border text-center ${
              claimResult.status === 'auto_approved' || claimResult.status === 'approved'
                ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                : claimResult.status === 'denied'
                ? 'bg-rose-950/30 border-rose-500/40 text-rose-200'
                : claimResult.status === 'fraud_review'
                ? 'bg-purple-950/30 border-purple-500/40 text-purple-200'
                : 'bg-amber-950/30 border-amber-500/40 text-amber-200'
            }`}>
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-950 border border-current mb-2">
                {claimResult.status === 'auto_approved' || claimResult.status === 'approved' ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                ) : claimResult.status === 'denied' ? (
                  <Ban className="w-6 h-6 text-rose-400" />
                ) : (
                  <Clock className="w-6 h-6 text-amber-400" />
                )}
              </div>
              <h3 className="text-lg font-extrabold uppercase tracking-wide">
                {claimResult.status.replace('_', ' ')}
              </h3>
              <p className="text-xs opacity-90 mt-1 max-w-sm mx-auto">
                {claimResult.reason}
              </p>
            </div>

            {/* Financial Payout Summary */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 grid grid-cols-2 gap-4 text-center">
              <div>
                <span className="text-[11px] text-slate-400 block mb-0.5">Claimed Amount</span>
                <span className="font-mono text-base font-bold text-slate-200">
                  ${claimResult.claimed_amount != null ? parseFloat(claimResult.claimed_amount).toFixed(2) : '0.00'}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block mb-0.5">Approved Amount</span>
                <span className="font-mono text-base font-bold text-emerald-400">
                  {claimResult.approved_amount != null ? `$${parseFloat(claimResult.approved_amount).toFixed(2)}` : 'Pending review'}
                </span>
              </div>
              <div className="col-span-2 pt-3 border-t border-slate-800/80">
                <span className="text-xs font-semibold text-slate-300 block mb-1">
                  Immediate Payout Disbursed Now:
                </span>
                <span className="font-mono text-2xl font-black text-cyan-400">
                  ${claimResult.payout_now != null ? parseFloat(claimResult.payout_now).toFixed(2) : '0.00'}
                </span>
                {claimResult.status === 'under_review' && parseFloat(claimResult.payout_now || 0) > 0 && (
                  <span className="block text-[11px] text-indigo-300 mt-1">
                    ⚡ 50% automatic advance payout released for protected parcel during investigation.
                  </span>
                )}
              </div>
              <div className="col-span-2 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400 px-2">
                <span>Adjudication Date:</span>
                <span className="font-mono text-slate-300">
                  {claimResult.decided_at ? claimResult.decided_at.slice(0, 10) : 'Pending'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all"
            >
              Done & Return to Shipment
            </button>

          </div>
        ) : (
          /* Form View */
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            
            {/* Quick Demo Step 4 Button */}
            <div className="p-2.5 rounded-xl bg-slate-950 border border-indigo-500/30 flex items-center justify-between">
              <span className="text-xs text-slate-300 font-medium">Demo Scenario Step 4:</span>
              <button
                type="button"
                onClick={() => {
                  setClaimType('damage');
                  setClaimedAmount('600.00');
                  setDescription('Internal glass sensor shattered following severe sorting impact.');
                }}
                className="px-2.5 py-1 rounded-lg bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 text-xs font-semibold hover:bg-indigo-600/30 transition-colors"
              >
                ⚡ Set Damage Claim $600
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Type selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Claim Incident Type *
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setClaimType('damage')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-semibold border text-center transition-all ${
                    claimType === 'damage'
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow-md'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Damage in Transit
                </button>
                <button
                  type="button"
                  onClick={() => setClaimType('loss')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-semibold border text-center transition-all ${
                    claimType === 'loss'
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow-md'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Loss / Scan Inactivity
                </button>
              </div>
            </div>

            {/* Claimed Amount */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-300">
                  Claimed Amount (USD) *
                </label>
                <span className="text-[11px] text-slate-400">
                  Max Coverage: <strong className="text-cyan-400 font-mono">${coverageCap.toFixed(2)}</strong>
                </span>
              </div>
              <div className="relative">
                <DollarSign className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  max={coverageCap}
                  required
                  value={claimedAmount}
                  onChange={(e) => setClaimedAmount(e.target.value)}
                  className="w-full pl-8 pr-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Incident Description *
              </label>
              <textarea
                rows={3}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Explain what happened upon delivery or unboxing..."
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Damage Photos */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Damage Photos (Optional)
              </label>
              <div className="flex items-center space-x-2">
                {damagePhotos.map((url, idx) => (
                  <div key={idx} className="relative w-16 h-16 rounded-xl border border-slate-700 overflow-hidden bg-slate-950">
                    <img src={url} alt="Damage" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setDamagePhotos(prev => prev.filter((_, i) => i !== idx))}
                      className="absolute top-0.5 right-0.5 p-0.5 bg-slate-950/80 rounded-full text-rose-400"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <label className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-800 hover:border-indigo-500 bg-slate-950/50 flex flex-col items-center justify-center cursor-pointer transition-colors">
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" disabled={uploading} />
                  {uploading ? (
                    <div className="w-3.5 h-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <Upload className="w-4 h-4 text-slate-500" />
                  )}
                </label>
              </div>
            </div>

            {/* Rules reminder */}
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 space-y-1">
              <div className="font-semibold text-slate-300">Automated Parametric Rules Active:</div>
              <div>• Auto-approval on impact telemetry (&gt;=10g shock / weight mismatch).</div>
              <div>• Auto-approval on parametric loss (&gt;=14 days no scan).</div>
              <div>• 50% advance payout on manual review for protected shipments.</div>
            </div>

            {/* Submit */}
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
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50 flex items-center justify-center space-x-1.5"
              >
                {submitting ? (
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Evaluate & Submit Claim</span>
                  </>
                )}
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
}

