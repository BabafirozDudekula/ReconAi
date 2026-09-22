import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Brain, CheckCircle, XCircle,
  AlertTriangle, Clock, RefreshCw, ChevronRight,
  Shield, User, MessageSquare, History
} from 'lucide-react';
import { StatusBadge, PriorityBadge, formatCurrency, formatDate, formatDateTime } from '../components/StatusBadge';
import { api } from '../services/api';

function SourceCard({ title, found, amount, status, extra = [] }) {
  return (
    <div className={`rounded-xl border p-4 ${found ? 'border-[#2d3154] bg-[#1a1d2e]' : 'border-red-500/20 bg-red-500/5'}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{title}</span>
        {found ? (
          <CheckCircle size={14} className="text-emerald-400" />
        ) : (
          <XCircle size={14} className="text-red-400" />
        )}
      </div>
      {found ? (
        <>
          {amount != null && (
            <div className="text-2xl font-bold text-white">{formatCurrency(amount)}</div>
          )}
          {status && (
            <div className="mt-1.5 text-xs text-slate-400">Status: <span className="text-slate-200 font-semibold">{status}</span></div>
          )}
          {extra.map(([k, v]) => v ? (
            <div key={k} className="mt-1 text-xs text-slate-500">{k}: <span className="text-slate-300">{v}</span></div>
          ) : null)}
        </>
      ) : (
        <div className="text-sm text-red-400 font-semibold mt-1">No record found</div>
      )}
    </div>
  );
}

function ConfidenceMeter({ value }) {
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-[#0f1117] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-sm font-bold" style={{ color }}>{pct}%</span>
    </div>
  );
}

const ACTION_STATUS_STYLE = {
  OPEN:      { cls: 'bg-amber-500/10 border-amber-500/30 text-amber-300',   label: 'Open'      },
  REVIEWED:  { cls: 'bg-blue-500/10 border-blue-500/30 text-blue-300',      label: 'Reviewed'  },
  RESOLVED:  { cls: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300', label: 'Resolved' },
  ESCALATED: { cls: 'bg-rose-500/10 border-rose-500/30 text-rose-300',      label: 'Escalated' },
};

function ActionStatusChip({ status }) {
  const cfg = ACTION_STATUS_STYLE[status] || ACTION_STATUS_STYLE['OPEN'];
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold ${cfg.cls}`}>
      <Shield size={11} />
      {cfg.label}
    </span>
  );
}

const AUDIT_ACTION_COLORS = {
  RECONCILIATION_RUN: 'text-indigo-400',
  AI_ANALYSIS:        'text-violet-400',
  REVIEWED:           'text-blue-400',
  RESOLVED:           'text-emerald-400',
  ESCALATED:          'text-rose-400',
};

export default function ExceptionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');
  const [actionMsg, setActionMsg] = useState('');
  // Action form state
  const [actionActor, setActionActor] = useState('Admin');
  const [actionReason, setActionReason] = useState('');
  const [showReasonFor, setShowReasonFor] = useState(''); // which button is expanded
  // Audit history
  const [auditHistory, setAuditHistory] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  async function loadRecord() {
    try {
      const r = await api.getExceptionDetail(id);
      setRecord(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadAuditHistory(txnId) {
    setAuditLoading(true);
    try {
      const res = await api.getAuditForTransaction(txnId);
      setAuditHistory(res.items || []);
    } catch {
      setAuditHistory([]);
    } finally {
      setAuditLoading(false);
    }
  }

  useEffect(() => { loadRecord(); }, [id]);

  useEffect(() => {
    if (showHistory && record?.transaction_id) {
      loadAuditHistory(record.transaction_id);
    }
  }, [showHistory, record?.transaction_id]);

  async function handleAnalyze() {
    setAnalyzing(true);
    setError('');
    try {
      await api.analyzeException(id);
      await loadRecord();
    } catch (e) {
      setError(e.message);
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleAction(action) {
    setActionLoading(action);
    setActionMsg('');
    setError('');
    try {
      await api.takeAction(id, action, actionReason.trim() || undefined, actionActor.trim() || 'Admin');
      setActionMsg(`Exception marked as ${action}.`);
      setShowReasonFor('');
      setActionReason('');
      await loadRecord();
      // Refresh history if visible
      if (showHistory && record?.transaction_id) {
        loadAuditHistory(record.transaction_id);
      }
    } catch (e) {
      setError(e.message || 'Action failed. Please try again.');
    } finally {
      setActionLoading('');
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in max-w-4xl mx-auto">
        <div className="skeleton h-8 w-48 rounded" />
        <div className="skeleton h-48 rounded-xl" />
        <div className="skeleton h-48 rounded-xl" />
      </div>
    );
  }

  if (error && !record) {
    return (
      <div className="text-center py-20">
        <p className="text-red-400 mb-4">{error}</p>
        <button onClick={() => navigate('/exceptions')} className="text-indigo-400 hover:underline">
          ← Back to exceptions
        </button>
      </div>
    );
  }

  const r = record;
  const hasAI = r.ai_explanation;
  const currentActionStatus = r.action_status || 'OPEN';

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-fade-in">
      {/* Back nav */}
      <button
        onClick={() => navigate('/exceptions')}
        className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition-colors"
      >
        <ArrowLeft size={14} /> Back to Exceptions
      </button>

      {/* Header card */}
      <div className="glass p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <span className="font-mono text-2xl font-black text-white">{r.transaction_id}</span>
              <StatusBadge status={r.recon_status} />
              {r.ai_priority && <PriorityBadge priority={r.ai_priority} />}
              <ActionStatusChip status={currentActionStatus} />
            </div>
            <div className="flex items-center gap-6 text-xs text-slate-400 flex-wrap">
              <span>Customer: <span className="text-slate-200">{r.customer_id || '—'}</span></span>
              <span>Invoice: <span className="text-slate-200">{r.invoice_id || '—'}</span></span>
              <span>Date: <span className="text-slate-200">{r.transaction_date || '—'}</span></span>
              <span>Method: <span className="text-slate-200">{r.payment_method || '—'}</span></span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-black text-white">{formatCurrency(r.gateway_amount)}</div>
            <div className="text-xs text-slate-500 mt-1">Gateway Amount</div>
          </div>
        </div>

        {/* Action metadata */}
        {currentActionStatus !== 'OPEN' && r.action_actor && (
          <div className="mt-4 pt-4 border-t border-[#2d3154] flex flex-wrap gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <User size={11} className="text-slate-500" />
              Actor: <span className="text-slate-200 ml-1">{r.action_actor}</span>
            </span>
            {r.action_reason && (
              <span className="flex items-center gap-1.5">
                <MessageSquare size={11} className="text-slate-500" />
                Reason: <span className="text-slate-200 ml-1">{r.action_reason}</span>
              </span>
            )}
            {r.action_at && (
              <span className="flex items-center gap-1.5">
                <Clock size={11} className="text-slate-500" />
                At: <span className="text-slate-200 ml-1">{formatDateTime(r.action_at)}</span>
              </span>
            )}
          </div>
        )}

        {/* Match reason */}
        {r.match_reason && (
          <div className="mt-4 pt-4 border-t border-[#2d3154]">
            <p className="text-xs text-slate-400 flex items-center gap-1.5">
              <ChevronRight size={12} className="text-indigo-400" />
              <span className="text-indigo-400 font-semibold">System reasoning:</span>{' '}
              {r.match_reason}
            </p>
          </div>
        )}
      </div>

      {/* Source comparison */}
      <div>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Source Comparison
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SourceCard
            title="Payment Gateway"
            found={r.gateway_amount != null}
            amount={r.gateway_amount}
            status={r.payment_status}
            extra={[['Method', r.payment_method], ['Date', r.transaction_date]]}
          />
          <SourceCard
            title="Bank Settlement"
            found={r.settled_amount != null}
            amount={r.settled_amount}
            status={r.settlement_status}
            extra={[['Settlement Date', r.settlement_date]]}
          />
          <SourceCard
            title="Invoice"
            found={r.invoice_amount != null}
            amount={r.invoice_amount}
            status={r.invoice_status}
            extra={[['Invoice ID', r.invoice_id]]}
          />
        </div>
      </div>

      {/* AI Analysis */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
            AI Analysis
          </h2>
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-semibold hover:bg-indigo-500/30 transition-all disabled:opacity-50"
          >
            {analyzing ? (
              <><RefreshCw size={12} className="animate-spin" /> Analyzing...</>
            ) : (
              <><Brain size={12} /> {hasAI ? 'Re-analyze' : 'Ask AI'}</>
            )}
          </button>
        </div>

        {hasAI ? (
          <div className="glass border border-indigo-500/20 p-5 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-slate-500 mb-1.5 uppercase tracking-wider">Explanation</div>
                <p className="text-slate-300 text-sm leading-relaxed">{r.ai_explanation}</p>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1.5 uppercase tracking-wider">Likely Cause</div>
                <p className="text-slate-300 text-sm leading-relaxed">{r.ai_likely_cause}</p>
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-500 mb-1.5 uppercase tracking-wider">Confidence</div>
              <ConfidenceMeter value={r.ai_confidence || 0} />
            </div>

            <div>
              <div className="text-xs text-slate-500 mb-1.5 uppercase tracking-wider">Recommended Action</div>
              <div className="flex items-start gap-2 p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                <AlertTriangle size={14} className="text-indigo-400 mt-0.5 shrink-0" />
                <p className="text-sm text-indigo-200">{r.ai_recommendation}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Clock size={12} />
              <span>Priority: <PriorityBadge priority={r.ai_priority} /></span>
            </div>
          </div>
        ) : (
          <div className="glass border border-dashed border-[#2d3154] p-8 text-center">
            <Brain size={32} className="text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500 text-sm mb-4">
              AI analysis not yet run for this exception.
            </p>
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 transition-all disabled:opacity-50"
            >
              {analyzing ? 'Analyzing...' : 'Run AI Analysis'}
            </button>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="glass p-5">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Actions</h2>

        {actionMsg && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm">
            {actionMsg}
          </div>
        )}
        {error && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Actor input */}
        <div className="mb-4 flex items-center gap-3">
          <User size={13} className="text-slate-500 shrink-0" />
          <label className="text-xs text-slate-500 shrink-0">Acting as:</label>
          <input
            type="text"
            value={actionActor}
            onChange={e => setActionActor(e.target.value)}
            maxLength={100}
            placeholder="Your name or role"
            className="flex-1 max-w-xs px-3 py-1.5 bg-[#0f1117] border border-[#2d3154] rounded-lg text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
          />
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3">
          {/* Reviewed */}
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setShowReasonFor(showReasonFor === 'reviewed' ? '' : 'reviewed')}
              disabled={!!actionLoading || r.is_reviewed}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-300 text-sm font-semibold hover:bg-blue-500/30 transition-all disabled:opacity-40"
            >
              {actionLoading === 'reviewed' ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <CheckCircle size={14} />
              )}
              {r.is_reviewed ? 'Reviewed ✓' : 'Mark as Reviewed'}
            </button>
          </div>

          {/* Resolved */}
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setShowReasonFor(showReasonFor === 'resolved' ? '' : 'resolved')}
              disabled={!!actionLoading || r.is_resolved}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-sm font-semibold hover:bg-emerald-500/30 transition-all disabled:opacity-40"
            >
              {actionLoading === 'resolved' ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <CheckCircle size={14} />
              )}
              {r.is_resolved ? 'Resolved ✓' : 'Resolve Exception'}
            </button>
          </div>

          {/* Escalated */}
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setShowReasonFor(showReasonFor === 'escalated' ? '' : 'escalated')}
              disabled={!!actionLoading || currentActionStatus === 'ESCALATED'}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-300 text-sm font-semibold hover:bg-amber-500/30 transition-all disabled:opacity-40"
            >
              {actionLoading === 'escalated' ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <AlertTriangle size={14} />
              )}
              {currentActionStatus === 'ESCALATED' ? 'Escalated ✓' : 'Escalate'}
            </button>
          </div>
        </div>

        {/* Inline reason form */}
        {showReasonFor && (
          <div className="mt-4 p-4 rounded-lg bg-[#1a1d2e] border border-[#2d3154] space-y-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <MessageSquare size={12} />
              <span>Add a reason (optional) for <span className="font-semibold text-slate-200 capitalize">{showReasonFor}</span></span>
            </div>
            <textarea
              value={actionReason}
              onChange={e => setActionReason(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="e.g. Confirmed with bank — duplicate settlement detected..."
              className="w-full px-3 py-2 bg-[#0f1117] border border-[#2d3154] rounded-lg text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 resize-none"
            />
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleAction(showReasonFor)}
                disabled={!!actionLoading}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {actionLoading === showReasonFor && <RefreshCw size={13} className="animate-spin" />}
                Confirm {showReasonFor.charAt(0).toUpperCase() + showReasonFor.slice(1)}
              </button>
              <button
                onClick={() => { setShowReasonFor(''); setActionReason(''); }}
                className="px-3 py-2 rounded-lg text-slate-400 text-sm hover:text-white transition-colors"
              >
                Cancel
              </button>
              <span className="text-xs text-slate-600 ml-auto">{actionReason.length}/500</span>
            </div>
          </div>
        )}

        <p className="mt-4 text-xs text-slate-600">
          All actions are recorded in the audit log. No automatic financial transactions are made.
        </p>
      </div>

      {/* Audit History */}
      <div className="glass p-5">
        <button
          onClick={() => setShowHistory(h => !h)}
          className="flex items-center gap-2 w-full text-left"
        >
          <History size={14} className="text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex-1">
            Audit History
          </h2>
          <span className="text-xs text-slate-500">{showHistory ? '▲ Hide' : '▼ Show'}</span>
        </button>

        {showHistory && (
          <div className="mt-4">
            {auditLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="skeleton h-10 rounded" />
                ))}
              </div>
            ) : auditHistory.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No audit entries for this transaction.</p>
            ) : (
              <div className="space-y-2">
                {auditHistory.map(entry => (
                  <div key={entry.id} className="flex items-start gap-3 p-3 rounded-lg bg-[#1a1d2e] border border-[#2d3154] text-xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-mono font-semibold ${AUDIT_ACTION_COLORS[entry.action] || 'text-slate-400'}`}>
                          {entry.action}
                        </span>
                        <span className="text-slate-500">by</span>
                        <span className="text-slate-300 font-semibold">{entry.actor}</span>
                        <span className="text-slate-600 ml-auto whitespace-nowrap">{formatDateTime(entry.timestamp)}</span>
                      </div>
                      {entry.reason && (
                        <p className="text-slate-500 mt-1 truncate" title={entry.reason}>{entry.reason}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
