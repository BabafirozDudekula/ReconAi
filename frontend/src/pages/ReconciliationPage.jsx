import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, RefreshCw, FileText, CheckCircle, AlertTriangle, Upload, Download } from 'lucide-react';
import { StatusBadge, formatCurrency } from '../components/StatusBadge';
import { api } from '../services/api';

export default function ReconciliationPage() {
  const navigate = useNavigate();
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [metrics, setMetrics] = useState(null);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 30;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [r, m] = await Promise.all([
        api.getRecords({ status: statusFilter === 'ALL' ? undefined : statusFilter, search, page, pageSize: PAGE_SIZE }),
        api.getMetrics().catch(() => null),
      ]);
      setRecords(r.items || []);
      setTotal(r.total || 0);
      setMetrics(m);
      setError('');
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, page]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleRun() {
    setRunning(true);
    setError('');
    try {
      await api.runReconciliation(true);
      setPage(1);
      await loadData();
    } catch (e) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">Reconciliation</h1>
          <p className="text-slate-400 text-sm mt-1">
            {total.toLocaleString()} total records
            {metrics && ` • ${metrics.matched_count} matched • ${metrics.exception_count} exceptions`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={api.downloadDataset('payment_gateway')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#2d3154] text-slate-400 text-xs hover:text-white hover:border-indigo-500/30 transition-all"
          >
            <Download size={13} /> Sample CSVs
          </a>
          <button
            onClick={handleRun}
            disabled={running}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-bold hover:opacity-90 transition-all disabled:opacity-60"
          >
            {running ? (
              <><RefreshCw size={14} className="animate-spin" /> Running...</>
            ) : (
              <><Play size={14} /> Run Demo Reconciliation</>
            )}
          </button>
        </div>
      </div>

      {/* Demo info banner */}
      <div className="glass border border-indigo-500/20 p-4 flex items-start gap-3">
        <Upload size={16} className="text-indigo-400 mt-0.5 shrink-0" />
        <div>
          <div className="text-sm font-semibold text-indigo-300 mb-0.5">Demo Mode</div>
          <p className="text-xs text-slate-400">
            This prototype uses{' '}
            <strong className="text-slate-300">synthetic data</strong>{' '}
            (203 gateway records, 194 settlements, 206 invoices) with intentional anomalies.{' '}
            Click <strong className="text-indigo-300">Run Demo Reconciliation</strong> to process.
          </p>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Search Transaction ID / Customer / Invoice..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="px-3 py-2 bg-[#1a1d2e] border border-[#2d3154] rounded-lg text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 flex-1 min-w-48"
        />
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-lg bg-[#1a1d2e] text-slate-300 border border-[#2d3154] text-sm focus:outline-none"
        >
          <option value="ALL">All Statuses</option>
          <option value="MATCHED">Matched</option>
          <option value="AMOUNT_MISMATCH">Amount Mismatch</option>
          <option value="MISSING_SETTLEMENT">Missing Settlement</option>
          <option value="MISSING_TRANSACTION">Missing Transaction</option>
          <option value="DUPLICATE">Duplicate</option>
          <option value="INVOICE_MISMATCH">Invoice Mismatch</option>
          <option value="DATE_MISMATCH">Date Mismatch</option>
          <option value="PAYMENT_FAILED">Payment Failed</option>
          <option value="REFUND">Refund</option>
          <option value="SETTLEMENT_PENDING">Settlement Pending</option>
        </select>
      </div>

      {/* Records table */}
      <div className="glass overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs border-b border-[#2d3154] bg-[#1a1d2e]">
                <th className="text-left px-4 py-3 font-medium">Transaction ID</th>
                <th className="text-left px-4 py-3 font-medium">Customer</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-right px-4 py-3 font-medium">GW Amount</th>
                <th className="text-right px-4 py-3 font-medium">Settled</th>
                <th className="text-right px-4 py-3 font-medium">Invoice</th>
                <th className="text-left px-4 py-3 font-medium">Date</th>
                <th className="text-left px-4 py-3 font-medium">Match Reason</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(15)].map((_, i) => (
                  <tr key={i} className="border-b border-[#2d3154]">
                    {[...Array(8)].map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="skeleton h-4 rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <FileText size={32} className="text-slate-700 mx-auto mb-3" />
                    <p className="text-slate-500 mb-3">No records found. Run the demo reconciliation first.</p>
                    <button onClick={handleRun} disabled={running}
                      className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-500">
                      Run Demo
                    </button>
                  </td>
                </tr>
              ) : (
                records.map(r => (
                  <tr
                    key={r.id}
                    onClick={() => r.is_exception && navigate(`/exceptions/${r.id}`)}
                    className={`border-b border-[#2d3154] transition-colors ${
                      r.is_exception ? 'cursor-pointer hover:bg-amber-500/5' : 'cursor-default'
                    }`}
                  >
                    <td className="px-4 py-2.5 font-mono text-xs text-indigo-300">{r.transaction_id}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-400">{r.customer_id || '—'}</td>
                    <td className="px-4 py-2.5"><StatusBadge status={r.recon_status} /></td>
                    <td className="px-4 py-2.5 text-right text-xs text-white font-semibold">
                      {formatCurrency(r.gateway_amount)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs">
                      <span className={
                        r.settled_amount != null && r.gateway_amount != null &&
                        Math.abs(r.settled_amount - r.gateway_amount) > 1
                          ? 'text-amber-400 font-semibold'
                          : 'text-slate-400'
                      }>
                        {formatCurrency(r.settled_amount)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs text-slate-400">
                      {formatCurrency(r.invoice_amount)}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{r.transaction_date || '—'}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500 max-w-xs truncate" title={r.match_reason}>
                      {r.match_reason ? r.match_reason.slice(0, 60) + (r.match_reason.length > 60 ? '…' : '') : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#2d3154] text-xs text-slate-400">
            <span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-2 py-1 rounded border border-[#2d3154] hover:bg-white/5 disabled:opacity-30">Prev</button>
              <span>Page {page} of {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-2 py-1 rounded border border-[#2d3154] hover:bg-white/5 disabled:opacity-30">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
