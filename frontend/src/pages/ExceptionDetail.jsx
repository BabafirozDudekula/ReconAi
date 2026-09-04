import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Brain, CheckCircle, XCircle,
  AlertTriangle, Clock, RefreshCw, ChevronRight
} from 'lucide-react';
import { StatusBadge, PriorityBadge, formatCurrency, formatDate } from '../components/StatusBadge';
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

export default function ExceptionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');
  const [actionMsg, setActionMsg] = useState('');

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

  useEffect(() => { loadRecord(); }, [id]);

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
    setError('');
    try {
      await api.takeAction(id, action, `Exception ${action} via ReconAI dashboard`);
      setActionMsg(`Exception marked as ${action}.`);
      await loadRecord();
    } catch (e) {
      setError(e.message);
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
            <div className="flex items-center gap-3 mb-2">
              <span className="font-mono text-2xl font-black text-white">{r.transaction_id}</span>
              <StatusBadge status={r.recon_status} />
              {r.ai_priority && <PriorityBadge priority={r.ai_priority} />}
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

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => handleAction('reviewed')}
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

          <button
            onClick={() => handleAction('resolved')}
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

          <button
            onClick={() => handleAction('escalated')}
            disabled={!!actionLoading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-300 text-sm font-semibold hover:bg-amber-500/30 transition-all disabled:opacity-40"
          >
            {actionLoading === 'escalated' ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <AlertTriangle size={14} />
            )}
            Escalate
          </button>
        </div>

        <p className="mt-4 text-xs text-slate-600">
          All actions are recorded in the audit log. No automatic financial transactions are made.
        </p>
      </div>
    </div>
  );
}
