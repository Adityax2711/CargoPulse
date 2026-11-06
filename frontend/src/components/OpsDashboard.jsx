import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, AlertTriangle, Clock, Ban, CheckCircle2, 
  HelpCircle, BarChart3, Truck, Package, Search, RefreshCw, 
  ChevronRight, X, Sliders, History, DollarSign, Activity, FileText, Check 
} from 'lucide-react';
import { opsApi, claimsApi, shipmentsApi } from '../api';
import { useToast } from './Toast';
import { SettingsPanel } from './SettingsModal';

export default function OpsDashboard({ 
  initialTab = "alerts",
  activeTab: controlledTab,
  onTabChange,
  onSelectShipment 
}) {
  const { addToast } = useToast();
  const [internalTab, setInternalTab] = useState(controlledTab || initialTab);
  const activeTab = controlledTab || internalTab;

  useEffect(() => {
    if (controlledTab) {
      setInternalTab(controlledTab);
    } else if (initialTab) {
      setInternalTab(initialTab);
    }
  }, [controlledTab, initialTab]);

  const handleTabSwitch = (tabId) => {
    setInternalTab(tabId);
    if (onTabChange) {
      onTabChange(tabId);
    }
  };

  // Panel 1: Alerts
  const [alerts, setAlerts] = useState([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [checkingScanGap, setCheckingScanGap] = useState(false);

  // Panel 2: Claims Queue
  const [claims, setClaims] = useState([]);
  const [claimsFilter, setClaimsFilter] = useState('under_review');
  const [loadingClaims, setLoadingClaims] = useState(false);

  // Panel 3: Scorecard
  const [scorecard, setScorecard] = useState([]);
  const [scorecardRange, setScorecardRange] = useState('all');
  const [loadingScorecard, setLoadingScorecard] = useState(false);

  // Panel 4: All Shipments
  const [shipments, setShipments] = useState([]);
  const [shipmentsSearch, setShipmentsSearch] = useState('');
  const [shipmentsStatus, setShipmentsStatus] = useState('');
  const [loadingShipments, setLoadingShipments] = useState(false);

  // Panel 5: Audit Log
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Decision Modal State
  const [decisionModalClaim, setDecisionModalClaim] = useState(null);
  const [decisionType, setDecisionType] = useState('approved');
  const [decisionAmount, setDecisionAmount] = useState('');
  const [decisionReason, setDecisionReason] = useState('');
  const [submittingDecision, setSubmittingDecision] = useState(false);
  const [decisionError, setDecisionError] = useState(null);

  // Load Alerts
  const loadAlerts = async () => {
    setLoadingAlerts(true);
    try {
      const res = await opsApi.getAlerts();
      setAlerts(res.alerts || []);
    } catch (err) {
      console.error("Alerts load error", err);
    } finally {
      setLoadingAlerts(false);
    }
  };

  // Trigger Hourly Scan-gap Check
  const triggerCheck = async () => {
    setCheckingScanGap(true);
    try {
      const res = await opsApi.triggerScanCheck();
      addToast(
        `Audit Complete: Evaluated ${res.result.total_active_evaluated} active parcels. Found ${res.result.newly_marked_lost.length} newly lost, ${res.result.active_warnings.length} active warnings.`,
        'info',
        5000
      );
      loadAlerts();
      loadScorecard();
    } catch (err) {
      addToast("Failed to run check: " + err.message, "error");
    } finally {
      setCheckingScanGap(false);
    }
  };

  // Load Claims
  const loadClaims = async () => {
    setLoadingClaims(true);
    try {
      const res = await claimsApi.list(claimsFilter === 'all' ? '' : claimsFilter);
      setClaims(res.claims || []);
    } catch (err) {
      console.error("Claims load error", err);
    } finally {
      setLoadingClaims(false);
    }
  };

  // Load Scorecard
  const loadScorecard = async () => {
    setLoadingScorecard(true);
    try {
      const res = await opsApi.getScorecard(scorecardRange);
      setScorecard(res.couriers || []);
    } catch (err) {
      console.error("Scorecard load error", err);
    } finally {
      setLoadingScorecard(false);
    }
  };

  // Load Shipments
  const loadShipments = async () => {
    setLoadingShipments(true);
    try {
      const res = await shipmentsApi.list({ q: shipmentsSearch, status: shipmentsStatus });
      setShipments(res.shipments || []);
    } catch (err) {
      console.error("Shipments load error", err);
    } finally {
      setLoadingShipments(false);
    }
  };

  // Load Audit Logs
  const loadAuditLogs = async () => {
    setLoadingAudit(true);
    try {
      const res = await opsApi.getAuditLogs(50);
      setAuditLogs(res.audit_logs || []);
    } catch (err) {
      console.error("Audit load error", err);
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'alerts') loadAlerts();
    else if (activeTab === 'claims') loadClaims();
    else if (activeTab === 'scorecard') loadScorecard();
    else if (activeTab === 'shipments') loadShipments();
    else if (activeTab === 'audit') loadAuditLogs();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'claims') loadClaims();
  }, [claimsFilter]);

  useEffect(() => {
    if (activeTab === 'scorecard') loadScorecard();
  }, [scorecardRange]);

  useEffect(() => {
    if (activeTab === 'shipments') loadShipments();
  }, [shipmentsSearch, shipmentsStatus]);

  // Open Decision Modal
  const openDecisionModal = (claim, defaultDecision = 'approved') => {
    setDecisionModalClaim(claim);
    setDecisionType(defaultDecision);
    setDecisionAmount(claim.claimed_amount.toString());
    setDecisionReason(
      defaultDecision === 'denied' 
        ? 'Inspection confirmed pre-existing manufacturer defect, not transit handling.'
        : defaultDecision === 'arbitration'
        ? 'Telemetry discrepancy disputed. Escalated to terminal station supervisor.'
        : 'Approved following carrier shock impact telemetry verification.'
    );
    setDecisionError(null);
  };

  // Submit Decision
  const handleDecisionSubmit = async (e) => {
    e.preventDefault();
    if (!decisionReason.trim()) {
      setDecisionError("An audit justification reason is required for every decision.");
      return;
    }

    setSubmittingDecision(true);
    setDecisionError(null);
    try {
      await claimsApi.decide(decisionModalClaim.id, {
        decision: decisionType,
        amount: decisionType === 'approved' ? parseFloat(decisionAmount) : null,
        reason: decisionReason.trim()
      });
      addToast(`Claim ${decisionModalClaim.id} updated to ${decisionType}!`, 'success');
      setDecisionModalClaim(null);
      loadClaims();
      loadAuditLogs();
    } catch (err) {
      setDecisionError(err.message || "Failed to record decision.");
    } finally {
      setSubmittingDecision(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 p-6 sm:p-8 rounded-2xl bg-[#111827] border border-slate-800 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-purple-400">
            <span>Ops Command Center</span>
            <span>•</span>
            <span>Platform Governance</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Carrier Accountability & Claims Adjudication
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
            Audit scan gaps, arbitrate disputed high-value loss & damage claims, and benchmark carrier fleet scorecards.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-[#0B0F19] border border-slate-800 shrink-0">
          {[
            { id: 'alerts', label: 'Scan-Gap Alerts', badge: alerts.length },
            { id: 'claims', label: 'Claims Queue' },
            { id: 'scorecard', label: 'Carrier Scorecards' },
            { id: 'shipments', label: 'Parcels Directory' },
            { id: 'settings', label: 'Rate Settings' },
            { id: 'audit', label: 'Audit Trail' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabSwitch(tab.id)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-slate-950 font-black">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ================= PANEL 1: SCAN-GAP ALERTS QUEUE ================= */}
      {activeTab === 'alerts' && (
        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                <Clock className="w-5 h-5 text-amber-400" />
                <span>Custody Inactivity & Parametric Loss Queue</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Evaluates active parcels for missing movement scans. 2+ days triggers a warning; 14+ days triggers parametric lost classification.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={triggerCheck}
                disabled={checkingScanGap}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/20 flex items-center space-x-2 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${checkingScanGap ? 'animate-spin' : ''}`} />
                <span>{checkingScanGap ? "Evaluating Fleet..." : "Run Hourly Custody Check"}</span>
              </button>
              <button
                onClick={loadAlerts}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {loadingAlerts ? (
            <div className="py-16 text-center text-xs text-slate-400">Loading alerts queue...</div>
          ) : alerts.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-500 space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500/50 mx-auto" />
              <div className="text-sm font-semibold text-slate-300">Custody Chain 100% Up-To-Date</div>
              <p className="text-slate-500 max-w-sm mx-auto">No parcels currently flagged for movement scan gaps.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map(alt => {
                const isLost = alt.type === 'lost';
                return (
                  <div
                    key={alt.id}
                    onClick={() => onSelectShipment(alt.shipment_id)}
                    className={`p-4 sm:p-5 rounded-xl border cursor-pointer hover:border-slate-600 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isLost 
                        ? 'bg-rose-950/20 border-rose-500/40 shadow-lg shadow-rose-950/10' 
                        : 'bg-amber-950/20 border-amber-500/30'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          isLost ? 'bg-rose-950 text-rose-300 border border-rose-800' : 'bg-amber-950 text-amber-300 border border-amber-800'
                        }`}>
                          {isLost ? "Parametric Lost" : "Scan Gap Warning"}
                        </span>
                        <span className="font-mono font-bold text-white text-xs">{alt.shipment_id}</span>
                        <span className="text-slate-400 text-xs font-semibold">• {alt.courier_name}</span>
                      </div>
                      <div className="text-xs text-slate-200 font-medium">{alt.message}</div>
                      <div className="text-[11px] text-slate-400">
                        Seller: <strong className="text-slate-300">{alt.seller_name}</strong> • Declared Value: <strong className="text-slate-300">${alt.declared_value.toFixed(2)}</strong> ({alt.insured ? 'Protected' : 'Uninsured'})
                      </div>
                    </div>

                    <div className="flex items-center space-x-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                      <div className="text-right">
                        <div className="font-mono text-xs font-black text-white">{alt.days_elapsed} days</div>
                        <div className="text-[10px] text-slate-500">Inactivity Gap</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================= PANEL 2: CLAIMS ARBITRATION QUEUE ================= */}
      {activeTab === 'claims' && (
        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                <ShieldAlert className="w-5 h-5 text-indigo-400" />
                <span>Claims Arbitration & Adjudication Queue</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Review automated telemetry decisions, adjust claim payouts, and resolve carrier disputes.
              </p>
            </div>

            {/* Filter pills */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {[
                { id: 'under_review', label: 'Under Review' },
                { id: 'fraud_review', label: 'Fraud Velocity' },
                { id: 'arbitration', label: 'Arbitration' },
                { id: 'auto_approved', label: 'Auto-Approved' },
                { id: 'approved', label: 'Approved' },
                { id: 'denied', label: 'Denied' },
                { id: 'all', label: 'All Records' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setClaimsFilter(f.id)}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                    claimsFilter === f.id
                      ? 'bg-indigo-600 text-white font-bold shadow-md'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {loadingClaims ? (
            <div className="py-16 text-center text-xs text-slate-400">Loading claims queue...</div>
          ) : claims.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-500">
              No claims found matching status: <span className="font-semibold text-slate-300">{claimsFilter}</span>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6 sm:mx-0">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="px-4 py-3">Claim Reference</th>
                    <th className="px-4 py-3">Carrier & Type</th>
                    <th className="px-4 py-3">Claimed / Cap</th>
                    <th className="px-4 py-3">Ruling & Telemetry Reason</th>
                    <th className="px-4 py-3">Disbursed</th>
                    <th className="px-4 py-3 text-right">Ops Adjudication</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {claims.map(clm => {
                    const isPending = clm.status === 'under_review' || clm.status === 'fraud_review' || clm.status === 'arbitration';
                    return (
                      <tr key={clm.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="font-mono font-bold text-white">{clm.id}</div>
                          <button
                            onClick={() => onSelectShipment(clm.shipment_id)}
                            className="text-[11px] font-mono text-cyan-400 hover:underline mt-0.5 block"
                          >
                            {clm.shipment_id}
                          </button>
                          <div className="text-[10px] text-slate-500 mt-0.5">{clm.seller_name}</div>
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="font-bold text-slate-200">{clm.courier_name}</div>
                          <span className={`inline-block mt-0.5 px-2 py-0.2 rounded text-[10px] font-bold uppercase ${
                            clm.type === 'damage' ? 'bg-amber-950 text-amber-300 border border-amber-800' : 'bg-rose-950 text-rose-300 border border-rose-800'
                          }`}>
                            {clm.type}
                          </span>
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="font-mono font-bold text-white">
                            ${clm.claimed_amount != null ? Number(clm.claimed_amount).toFixed(2) : '0.00'}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Cap: ${clm.insured && clm.declared_value != null ? Number(clm.declared_value).toFixed(2) : '100.00'}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Approved: {clm.approved_amount != null ? `$${Number(clm.approved_amount).toFixed(2)}` : '—'}
                          </div>
                        </td>

                        <td className="px-4 py-3.5 max-w-xs">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider mb-1 ${
                            clm.status === 'auto_approved' || clm.status === 'approved' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                            clm.status === 'denied' ? 'bg-rose-950 text-rose-400 border border-rose-800' :
                            clm.status === 'fraud_review' ? 'bg-purple-950 text-purple-300 border border-purple-800' :
                            clm.status === 'arbitration' ? 'bg-blue-950 text-blue-300 border border-blue-800' :
                            'bg-amber-950 text-amber-400 border border-amber-800'
                          }`}>
                            {clm.status.replace('_', ' ')}
                          </span>
                          <div className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                            {clm.reason}
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          <span className="font-mono font-bold text-cyan-400 text-sm">
                            ${clm.payout_now != null ? Number(clm.payout_now).toFixed(2) : '0.00'}
                          </span>
                          {clm.status === 'under_review' && clm.payout_now > 0 && (
                            <div className="text-[10px] text-indigo-300">50% Advance</div>
                          )}
                        </td>

                        <td className="px-4 py-3.5 text-right">
                          {isPending ? (
                            <div className="flex items-center justify-end space-x-1.5">
                              <button
                                onClick={() => openDecisionModal(clm, 'approved')}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shadow-sm transition-colors"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => openDecisionModal(clm, 'denied')}
                                className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] shadow-sm transition-colors"
                              >
                                Deny
                              </button>
                              <button
                                onClick={() => openDecisionModal(clm, 'arbitration')}
                                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-[11px] transition-colors"
                              >
                                Arbitrate
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-500 font-mono">
                              {clm.decided_at ? `Settled ${clm.decided_at.slice(0, 10)}` : '—'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ================= PANEL 3: COURIER ACCOUNTABILITY SCORECARD ================= */}
      {activeTab === 'scorecard' && (
        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                <BarChart3 className="w-5 h-5 text-cyan-400" />
                <span>Courier Fleet Handling & Incident Scorecards</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Incidents per 1,000 shipments: ((Lost + Damage Claims) / Shipments) × 1,000. Real-time carrier SLA benchmark.
              </p>
            </div>

            {/* Range Toggle */}
            <div className="flex rounded-xl bg-[#0B0F19] p-1 border border-slate-800 text-xs font-semibold">
              {[
                { id: '30d', label: 'Last 30 Days' },
                { id: '90d', label: 'Last 90 Days' },
                { id: 'all', label: 'All Time' }
              ].map(r => (
                <button
                  key={r.id}
                  onClick={() => setScorecardRange(r.id)}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    scorecardRange === r.id
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {loadingScorecard ? (
            <div className="py-16 text-center text-xs text-slate-400">Computing telemetry scorecards...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {scorecard.map(c => {
                const gradeColor = 
                  c.health_grade === 'A' ? 'text-emerald-400 border-emerald-500/40 bg-emerald-950/30' :
                  c.health_grade === 'B' ? 'text-cyan-400 border-cyan-500/40 bg-cyan-950/30' :
                  c.health_grade === 'C' ? 'text-amber-400 border-amber-500/40 bg-amber-950/30' :
                  'text-rose-400 border-rose-500/40 bg-rose-950/30';

                return (
                  <div key={c.courier_id} className="bg-[#0B0F19] border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                      <div>
                        <h3 className="font-bold text-white text-base">{c.courier_name}</h3>
                        <span className="text-[11px] font-mono text-slate-500">{c.courier_id}</span>
                      </div>
                      <div className={`w-11 h-11 rounded-xl border flex items-center justify-center font-black text-xl ${gradeColor}`}>
                        {c.health_grade}
                      </div>
                    </div>

                    {/* Incident Rate Highlight */}
                    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                      <div className="flex justify-between items-baseline mb-1">
                        <span className="text-xs text-slate-400 font-medium">Incident Rate</span>
                        <span className="font-mono text-xl font-black text-cyan-400">
                          {c.incidents_per_1000}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 mb-2.5">incidents per 1,000 shipments</div>
                      
                      {/* Visual Progress Bar */}
                      <div className="w-full bg-[#0B0F19] h-2 rounded-full overflow-hidden border border-slate-800">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            c.incidents_per_1000 > 50 ? 'bg-rose-500' : c.incidents_per_1000 > 25 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(6, c.incidents_per_1000))}%` }}
                        />
                      </div>
                    </div>

                    {/* Breakdown Metrics */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800/80">
                        <span className="text-[10px] text-slate-500 block">Total Volume</span>
                        <span className="font-mono font-bold text-slate-200">{c.shipments_count}</span>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800/80">
                        <span className="text-[10px] text-slate-500 block">Lost Parcels</span>
                        <span className="font-mono font-bold text-rose-400">{c.lost_count}</span>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800/80">
                        <span className="text-[10px] text-slate-500 block">Damage Claims</span>
                        <span className="font-mono font-bold text-amber-400">{c.damage_claims_count}</span>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800/80">
                        <span className="text-[10px] text-slate-500 block">Avg Decision Time</span>
                        <span className="font-mono font-bold text-slate-200">{c.avg_hours_to_decision}h</span>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================= PANEL 4: ALL SHIPMENTS DIRECTORY ================= */}
      {activeTab === 'shipments' && (
        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-2.5" />
              <input
                type="text"
                value={shipmentsSearch}
                onChange={(e) => setShipmentsSearch(e.target.value)}
                placeholder="Search across all merchant parcels..."
                className="w-full pl-10 pr-4 py-2 bg-[#0B0F19] border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {['', 'booked', 'in_transit', 'hub', 'out_for_delivery', 'delivered', 'lost'].map(st => (
                <button
                  key={st}
                  onClick={() => setShipmentsStatus(st)}
                  className={`px-3 py-1.5 rounded-lg capitalize font-semibold transition-all ${
                    shipmentsStatus === st
                      ? 'bg-indigo-600 text-white font-bold shadow-md'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  {st === '' ? 'All Status' : st.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto -mx-6 sm:mx-0">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3">Shipment ID</th>
                  <th className="px-4 py-3">Seller</th>
                  <th className="px-4 py-3">Carrier</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Declared Value</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {shipments.map(s => (
                  <tr key={s.id} onClick={() => onSelectShipment(s.id)} className="hover:bg-slate-800/40 cursor-pointer transition-colors">
                    <td className="px-4 py-3.5 font-mono font-bold text-white hover:text-cyan-400">{s.id}</td>
                    <td className="px-4 py-3.5 text-slate-300 font-medium">{s.seller_name}</td>
                    <td className="px-4 py-3.5 text-slate-300">{s.courier_name}</td>
                    <td className="px-4 py-3.5">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        s.status === 'delivered' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                        s.status === 'lost' ? 'bg-rose-950 text-rose-400 border border-rose-800' :
                        'bg-cyan-950 text-cyan-400 border border-cyan-800'
                      }`}>
                        {s.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-slate-200 font-bold">${s.declared_value.toFixed(2)}</td>
                    <td className="px-4 py-3.5 text-right">
                      <button className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold">
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= PANEL 5: AUDIT LOG ================= */}
      {activeTab === 'audit' && (
        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                <History className="w-5 h-5 text-indigo-400" />
                <span>Immutable Regulatory Audit Trail</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Every claim ruling, baseline supersede, and setting change is cryptographically tracked with timestamp and actor ID.
              </p>
            </div>
            <button
              onClick={loadAuditLogs}
              className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-x-auto -mx-6 sm:mx-0">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Target Entity</th>
                  <th className="px-4 py-3">Audit Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {auditLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-mono text-slate-400">{log.created_at}</td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-indigo-400 uppercase tracking-wider text-[11px]">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300 font-semibold">{log.actor_name || log.actor_id}</td>
                    <td className="px-4 py-3 font-mono text-slate-300">{log.entity_type}:{log.entity_id}</td>
                    <td className="px-4 py-3 text-slate-400 font-mono text-[11px] max-w-sm truncate">
                      {JSON.stringify(log.details)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= PANEL 6: RATE SETTINGS & CARRIER CONFIG ================= */}
      {activeTab === 'settings' && (
        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="pb-4 border-b border-slate-800">
            <h2 className="text-xl font-bold text-white flex items-center space-x-2.5">
              <Sliders className="w-5 h-5 text-indigo-400" />
              <span>Platform Settings & Carrier Configuration</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Configure parametric loss & shock impact thresholds, standard vs fragile insurance rates, clean record discounts, and courier fleet identities.
            </p>
          </div>
          <SettingsPanel />
        </div>
      )}

      {/* DECISION ACTION MODAL (APPROVE / DENY / ARBITRATE) */}
      {decisionModalClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#111827] border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-base flex items-center space-x-2">
                <span>Adjudicate Claim:</span>
                <span className="font-mono text-cyan-400">{decisionModalClaim.id}</span>
              </h3>
              <button
                onClick={() => setDecisionModalClaim(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {decisionError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{decisionError}</span>
              </div>
            )}

            <form onSubmit={handleDecisionSubmit} className="space-y-4 text-xs">
              
              {/* Decision Type Buttons */}
              <div>
                <label className="block font-semibold text-slate-300 mb-1.5">Action Outcome *</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'approved', label: 'Approve Payout', color: 'border-emerald-500 text-emerald-300 bg-emerald-950/30' },
                    { id: 'denied', label: 'Deny Claim', color: 'border-rose-500 text-rose-300 bg-rose-950/30' },
                    { id: 'arbitration', label: 'Hold in Arbitration', color: 'border-amber-500 text-amber-300 bg-amber-950/30' }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setDecisionType(opt.id)}
                      className={`py-2 px-2 rounded-xl font-bold border text-center transition-all ${
                        decisionType === opt.id ? opt.color : 'bg-[#0B0F19] border-slate-800 text-slate-400'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount adjustment if approved */}
              {decisionType === 'approved' && (
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Adjusted Approved Amount (USD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={decisionAmount}
                    onChange={(e) => setDecisionAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0B0F19] border border-slate-800 rounded-xl font-mono text-white text-xs font-bold"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Claimed: ${decisionModalClaim.claimed_amount.toFixed(2)} • Insured: {decisionModalClaim.insured ? 'Yes' : 'No'}
                  </span>
                </div>
              )}

              {/* Reason */}
              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Audit Justification Reason *
                </label>
                <textarea
                  rows={3}
                  required
                  value={decisionReason}
                  onChange={(e) => setDecisionReason(e.target.value)}
                  placeholder="State the evidence-backed reason for approving, denying, or arbitrating..."
                  className="w-full px-3 py-2 bg-[#0B0F19] border border-slate-800 rounded-xl text-white text-xs"
                />
              </div>

              <div className="pt-2 flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setDecisionModalClaim(null)}
                  className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDecision}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-md"
                >
                  {submittingDecision ? "Saving..." : "Record Decision & Log"}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* ================= PANEL 6: RATE SETTINGS & CARRIER CONFIG ================= */}
      {activeTab === 'settings' && (
        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="pb-4 border-b border-slate-800">
            <h2 className="text-xl font-bold text-white flex items-center space-x-2.5">
              <Sliders className="w-5 h-5 text-indigo-400" />
              <span>Platform Settings & Carrier Configuration</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Configure parametric loss & shock impact thresholds, standard vs fragile insurance rates, clean record discounts, and courier fleet identities.
            </p>
          </div>
          <SettingsPanel />
        </div>
      )}

    </div>
  );
}
