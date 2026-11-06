import React, { useState } from 'react';
import { Camera, X, Upload, CheckCircle2, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { shipmentsApi, uploadApi } from '../api';

export default function PickupModal({ shipment, onClose, onPickupRecorded }) {
  const [weightKg, setWeightKg] = useState('2.00');
  const [dimsCm, setDimsCm] = useState('30x20x15');
  const [condition, setCondition] = useState('good');
  const [photoUrls, setPhotoUrls] = useState([
    '/uploads/parcel_box_front.jpg',
    '/uploads/parcel_box_label.jpg'
  ]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    if (photoUrls.length + files.length > 3) {
      setError("Maximum 3 photos allowed for pickup check.");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      for (const file of files) {
        const res = await uploadApi.uploadPhoto(file);
        setPhotoUrls(prev => [...prev, res.url].slice(0, 3));
      }
    } catch (err) {
      setError(err.message || "Failed to upload photo.");
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (index) => {
    setPhotoUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const w = parseFloat(weightKg);
    if (!w || w <= 0) {
      setError("Weight must be greater than 0 kg.");
      return;
    }

    if (photoUrls.length < 1 || photoUrls.length > 3) {
      setError("Must provide between 1 and 3 photos as baseline evidence.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await shipmentsApi.recordPickup(shipment.id, {
        weight_kg: w,
        dims_cm: dimsCm.trim(),
        condition: condition,
        photo_urls: photoUrls
      });
      onPickupRecorded(res.pickup);
    } catch (err) {
      setError(err.message || "Failed to record pickup evidence.");
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
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Record Pickup Baseline</h2>
              <div className="text-xs text-slate-400 font-mono">{shipment.id}</div>
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
          
          <div className="p-3 rounded-xl bg-indigo-950/30 border border-indigo-800/40 text-xs text-indigo-200">
            <span className="font-bold">Baseline Evidence:</span> This pickup measurement sets the immutable weight and condition baseline for automatic claim resolution and shock discrepancy checks.
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Weight & Dims */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Measured Weight (kg) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                placeholder="e.g. 2.00"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Dimensions (LxWxH cm) *
              </label>
              <input
                type="text"
                required
                value={dimsCm}
                onChange={(e) => setDimsCm(e.target.value)}
                placeholder="30x20x15"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Condition Select */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Outer Box Condition *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'good', label: 'Good (Flawless)', color: 'text-emerald-400 border-emerald-500/30' },
                { key: 'minor_marks', label: 'Minor Scuffs', color: 'text-amber-400 border-amber-500/30' },
                { key: 'damaged', label: 'Pre-Damaged', color: 'text-rose-400 border-rose-500/30' }
              ].map(opt => (
                <button
                  type="button"
                  key={opt.key}
                  onClick={() => setCondition(opt.key)}
                  className={`py-2 px-2 rounded-xl text-xs font-medium border text-center transition-all ${
                    condition === opt.key
                      ? `bg-slate-800 ${opt.color} font-bold ring-1 ring-inset ring-current`
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Photo Gallery & Uploader */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Evidence Photos (1 to 3 required) *
              </label>
              <span className="text-[11px] font-mono text-slate-400">
                {photoUrls.length}/3 photos attached
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2.5 mb-2">
              {photoUrls.map((url, i) => (
                <div key={i} className="relative aspect-video rounded-xl overflow-hidden border border-slate-700 bg-slate-950 group">
                  <img src={url} alt={`Evidence ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="absolute top-1 right-1 p-1 rounded-full bg-slate-900/80 text-rose-400 hover:bg-rose-950 border border-slate-700 opacity-90 transition-opacity"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <div className="absolute bottom-1 left-1.5 text-[9px] font-mono bg-slate-950/80 px-1 py-0.5 rounded text-slate-300">
                    Photo {i + 1}
                  </div>
                </div>
              ))}

              {photoUrls.length < 3 && (
                <label className="relative aspect-video rounded-xl border-2 border-dashed border-slate-800 hover:border-indigo-500/50 bg-slate-950/50 flex flex-col items-center justify-center cursor-pointer transition-all hover:bg-indigo-950/10">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={uploading}
                  />
                  {uploading ? (
                    <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 text-slate-500 mb-1" />
                      <span className="text-[10px] text-slate-400 font-medium">Add Photo</span>
                    </>
                  )}
                </label>
              )}
            </div>

            {/* Quick Demo Pre-fill Button if none */}
            {photoUrls.length === 0 && (
              <button
                type="button"
                onClick={() => setPhotoUrls(['/uploads/parcel_box_front.jpg', '/uploads/parcel_box_label.jpg'])}
                className="text-xs text-indigo-400 hover:text-indigo-300 underline"
              >
                + Quick-attach 2 Verified Demo Photos (Matching Demo Step 2)
              </button>
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
              disabled={submitting || uploading}
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50 flex items-center justify-center space-x-1.5"
            >
              {submitting ? (
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Lock In Baseline Evidence</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}

