import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, AlertTriangle, ChevronLeft, ChevronRight, Shield } from 'lucide-react';
import { StatusBadge, PriorityBadge, formatCurrency } from '../components/StatusBadge';
import { api } from '../services/api';

const EXCEPTION_TYPES = [
  'ALL',
  'AMOUNT_MISMATCH',
  'MISSING_SETTLEMENT',
  'MISSING_TRANSACTION',
  'DUPLICATE',
  'INVOICE_MISMATCH',
  'DATE_MISMATCH',
  'PAYMENT_FAILED',
  'REFUND',
  'SETTLEMENT_PENDING',
  'UNRESOLVED',
];

const ACTION_STATUS_TABS = [
  { value: 'ALL',       label: 'All',       cls: 'text-slate-400'  },
  { value: 'OPEN',      label: 'Open',      cls: 'text-amber-400'  },
  { value: 'REVIEWED',  label: 'Reviewed',  cls: 'text-blue-400'   },
  { value: 'RESOLVED',  label: 'Resolved',  cls: 'text-emerald-400'},
  { value: 'ESCALATED', label: 'Escalated', cls: 'text-rose-400'   },
];

const PRIORITY_OPTIONS = ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

const ACTION_STATUS_BADGE = {
  OPEN:      { cls: 'text-amber-400',   label: 'Open'      },
  REVIEWED:  { cls: 'text-blue-400',    label: 'Reviewed'  },
  RESOLVED:  { cls: 'text-emerald-400', label: 'Resolved'  },
  ESCALATED: { cls: 'text-rose-400',    label: 'Escalated' },
};

function ActionStatusPill({ status }) {
  const cfg = ACTION_STATUS_BADGE[status] || ACTION_STATUS_BADGE['OPEN'];
  return <span className={`text-xs font-semibold ${cfg.cls}`}>{cfg.label}</span>;
}

export default function ExceptionsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [actionStatus, setActionStatus] = useState('ALL');
  const [priority, setPriority] = useState('ALL');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, sum] = await Promise.all([
        api.getExceptions({
          status,
          actionStatus,
          priority,
          search,
          page,
          pageSize: PAGE_SIZE,
        }),
        api.getExceptionSummary(),
      ]);
      setItems(res.items || []);
      setTotal(res.total || 0);
      setSummary(sum);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [status, actionStatus, priority, search, page]);

  useEffect(() => { load(); }, [load]);

  function handleSearch(e) { setSearch(e.target.value); setPage(1); }
  function handleStatus(s) { setStatus(s); setPage(1); }
  function handleActionStatus(s) { setActionStatus(s); setPage(1); }
  function handlePriority(p) { setPriority(p); setPage(1); }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Exceptions</h1>
          <p className="text-slate-400 text-sm mt-1">
            {total} exception{total !== 1 ? 's' : ''} found
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <AlertTriangle size={14} className="text-amber-400" />
          Click any row for details &amp; AI analysis
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Total',     value: summary.total_exceptions, cls: 'text-slate-300'  },
            { label: 'Open',      value: summary.open,             cls: 'text-amber-400'  },
            { label: 'Reviewed',  value: summary.reviewed,         cls: 'text-blue-400'   },
            { label: 'Resolved',  value: summary.resolved,         cls: 'text-emerald-400'},
            { label: 'Escalated', value: summary.escalated,        cls: 'text-rose-400'   },
          ].map(({ label, value, cls }) => (
            <div key={label} className="glass p-3 text-center">
              <div className={`text-2xl font-black ${cls}`}>{value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="glass p-4 space-y-3">
        {/* Row 1: search + priority */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search by Transaction ID, Customer, Invoice..."
              value={search}
              onChange={handleSearch}
              className="w-full pl-9 pr-4 py-2 bg-[#0f1117] border border-[#2d3154] rounded-lg text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 shrink-0">Priority:</span>
            <select
              value={priority}
              onChange={e => handlePriority(e.target.value)}
              className="px-2 py-1.5 rounded-md text-xs bg-[#1a1d2e] text-slate-300 border border-[#2d3154] focus:outline-none focus:border-indigo-500/50"
            >
              {PRIORITY_OPTIONS.map(p => (
                <option key={p} value={p}>{p === 'ALL' ? 'All Priorities' : p}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2: action status tabs */}
        <div className="flex items-center gap-1 flex-wrap">
          <Shield size={13} className="text-slate-500 shrink-0 mr-1" />
          {ACTION_STATUS_TABS.map(({ value, label, cls }) => (
            <button
              key={value}
              onClick={() => handleActionStatus(value)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                actionStatus === value
                  ? 'bg-indigo-600 text-white'
                  : `bg-[#1a1d2e] ${cls} hover:bg-white/5 border border-[#2d3154]`
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Row 3: exception type filter */}
        <div className="flex items-center gap-1 flex-wrap">
          <Filter size={13} className="text-slate-500 shrink-0 mr-1" />
          {EXCEPTION_TYPES.slice(0, 5).map(s => (
            <button
              key={s}
              onClick={() => handleStatus(s)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                status === s
                  ? 'bg-indigo-600 text-white'
                  : 'bg-[#1a1d2e] text-slate-400 hover:text-white border border-[#2d3154]'
              }`}
            >
              {s === 'ALL' ? 'All Types' : s.replace(/_/g, ' ')}
            </button>
          ))}
          <select
            value={EXCEPTION_TYPES.slice(5).includes(status) ? status : ''}
            onChange={e => e.target.value && handleStatus(e.target.value)}
            className="px-2 py-1 rounded-md text-xs bg-[#1a1d2e] text-slate-400 border border-[#2d3154] focus:outline-none"
          >
            <option value="">More types...</option>
            {EXCEPTION_TYPES.slice(5).map(s => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="glass overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs border-b border-[#2d3154] bg-[#1a1d2e]">
                <th className="text-left px-4 py-3 font-medium">Transaction ID</th>
                <th className="text-left px-4 py-3 font-medium">Customer</th>
                <th className="text-left px-4 py-3 font-medium">Exception Type</th>
                <th className="text-left px-4 py-3 font-medium">Priority</th>
                <th className="text-right px-4 py-3 font-medium">Amount</th>
                <th className="text-left px-4 py-3 font-medium">Date</th>
                <th className="text-left px-4 py-3 font-medium">Action Status</th>
                <th className="text-left px-4 py-3 font-medium">Actor</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(10)].map((_, i) => (
                  <tr key={i} className="border-b border-[#2d3154]">
                    {[...Array(8)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="skeleton h-4 rounded w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    No exceptions found for current filters.
                  </td>
                </tr>
              ) : (
                items.map(ex => (
                  <tr
                    key={ex.id}
                    onClick={() => navigate(`/exceptions/${ex.id}`)}
                    className="border-b border-[#2d3154] hover:bg-indigo-500/5 cursor-pointer transition-colors group"
                  >
                    <td className="px-4 py-3 font-mono text-indigo-300 text-xs group-hover:text-indigo-200">
                      {ex.transaction_id}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{ex.customer_id || '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={ex.recon_status} /></td>
                    <td className="px-4 py-3">
                      {ex.ai_priority ? <PriorityBadge priority={ex.ai_priority} /> : <span className="text-slate-600 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-white font-semibold text-xs">
                      {formatCurrency(ex.gateway_amount)}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{ex.transaction_date || '—'}</td>
                    <td className="px-4 py-3 text-xs">
                      <ActionStatusPill status={ex.action_status || 'OPEN'} />
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{ex.action_actor || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#2d3154] text-xs text-slate-400">
            <span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1 rounded hover:bg-white/5 disabled:opacity-30"
              >
                <ChevronLeft size={14} />
              </button>
              <span>Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1 rounded hover:bg-white/5 disabled:opacity-30"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
