/**
 * ActionCenterPage — Exception Action Center
 * Provides a focused view for triaging exceptions:
 *  - Action-status summary cards
 *  - AI priority breakdown
 *  - Filterable exception table with quick action links
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, AlertTriangle, CheckCircle, ChevronRight,
  ChevronLeft, Search, Filter, TrendingUp, Clock,
  ArrowUpRight, RefreshCw, Layers
} from 'lucide-react';
import { StatusBadge, PriorityBadge, formatCurrency, formatDateTime } from '../components/StatusBadge';
import { api } from '../services/api';

// ── Constants ──────────────────────────────────────────────────
const ACTION_STATUS_TABS = [
  { value: 'ALL',       label: 'All Exceptions', cls: 'text-slate-400'   },
  { value: 'OPEN',      label: 'Open',           cls: 'text-amber-400'   },
  { value: 'REVIEWED',  label: 'Reviewed',       cls: 'text-blue-400'    },
  { value: 'RESOLVED',  label: 'Resolved',       cls: 'text-emerald-400' },
  { value: 'ESCALATED', label: 'Escalated',      cls: 'text-rose-400'    },
];

const PRIORITY_OPTIONS = ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

const ACTION_STATUS_STYLE = {
  OPEN:      { cls: 'bg-amber-500/10 border border-amber-500/30 text-amber-300',       dot: 'bg-amber-400'   },
  REVIEWED:  { cls: 'bg-blue-500/10 border border-blue-500/30 text-blue-300',          dot: 'bg-blue-400'    },
  RESOLVED:  { cls: 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300', dot: 'bg-emerald-400' },
  ESCALATED: { cls: 'bg-rose-500/10 border border-rose-500/30 text-rose-300',          dot: 'bg-rose-400'    },
};

const PRIORITY_BAR_COLORS = {
  CRITICAL: 'bg-red-500',
  HIGH:     'bg-orange-400',
  MEDIUM:   'bg-amber-400',
  LOW:      'bg-teal-400',
};

// ── Sub-components ─────────────────────────────────────────────

function SummaryCard({ label, value, cls, bg, icon: Icon, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border p-4 text-left w-full transition-all hover:scale-[1.02] ${bg}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
        {Icon && <Icon size={14} className={cls} />}
      </div>
      <div className={`text-4xl font-black ${cls}`}>{value}</div>
    </button>
  );
}

function ActionStatusPill({ status }) {
  const cfg = ACTION_STATUS_STYLE[status] || ACTION_STATUS_STYLE['OPEN'];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {status || 'OPEN'}
    </span>
  );
}

// ── Main Page ──────────────────────────────────────────────────
export default function ActionCenterPage() {
  const navigate = useNavigate();

  // Data state
  const [summary, setSummary] = useState(null);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [priorityBreakdown, setPriorityBreakdown] = useState([]);

  // Filter state
  const [actionStatus, setActionStatus] = useState('ALL');
  const [priority, setPriority] = useState('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  // Loading state
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // ── Load data ────────────────────────────────────────────────
  const loadData = useCallback(async (isRefresh) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const [sum, exc] = await Promise.all([
        api.getExceptionSummary(),
        api.getExceptions({
          actionStatus: actionStatus !== 'ALL' ? actionStatus : undefined,
          priority: priority !== 'ALL' ? priority : undefined,
          search: search || undefined,
          page,
          pageSize: PAGE_SIZE,
        }),
      ]);
      setSummary(sum);
      setItems(exc.items || []);
      setTotal(exc.total || 0);

      // Build priority breakdown from full set (no filters)
      if (priority === 'ALL' && actionStatus === 'ALL' && !search && page === 1) {
        const allExc = await api.getExceptions({ pageSize: 200 });
        const pb = {};
        for (const item of allExc.items || []) {
          const p = item.ai_priority || 'UNSET';
          pb[p] = (pb[p] || 0) + 1;
        }
        const order = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'UNSET'];
        setPriorityBreakdown(
          order.filter(k => pb[k]).map(k => ({ priority: k, count: pb[k] }))
        );
      }
    } catch (e) {
      setError(e.message || 'Failed to load data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [actionStatus, priority, search, page]);

  useEffect(() => { loadData(false); }, [loadData]);

  function handleActionStatus(v) { setActionStatus(v); setPage(1); }
  function handlePriority(v)     { setPriority(v);     setPage(1); }
  function handleSearch(e)       { setSearch(e.target.value); setPage(1); }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const maxPriority = Math.max(...priorityBreakdown.map(p => p.count), 1);

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/30 to-purple-600/20 flex items-center justify-center">
              <Shield size={16} className="text-indigo-400" />
            </div>
            <h1 className="text-2xl font-black text-white">Exception Action Center</h1>
          </div>
          <p className="text-slate-400 text-sm pl-10">
            Triage, review, and track exception resolution across all runs.
          </p>
        </div>
        <button
          onClick={() => loadData(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-indigo-500/30 text-indigo-300 text-sm hover:bg-indigo-500/10 transition-all disabled:opacity-50"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      {loading && !summary ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton h-24 rounded-xl" />
          ))}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <SummaryCard
            label="Open"
            value={summary.open}
            cls="text-amber-400"
            bg="bg-amber-500/10 border border-amber-500/20 hover:border-amber-500/40"
            icon={Clock}
            onClick={() => handleActionStatus('OPEN')}
          />
          <SummaryCard
            label="Reviewed"
            value={summary.reviewed}
            cls="text-blue-400"
            bg="bg-blue-500/10 border border-blue-500/20 hover:border-blue-500/40"
            icon={CheckCircle}
            onClick={() => handleActionStatus('REVIEWED')}
          />
          <SummaryCard
            label="Resolved"
            value={summary.resolved}
            cls="text-emerald-400"
            bg="bg-emerald-500/10 border border-emerald-500/20 hover:border-emerald-500/40"
            icon={CheckCircle}
            onClick={() => handleActionStatus('RESOLVED')}
          />
          <SummaryCard
            label="Escalated"
            value={summary.escalated}
            cls="text-rose-400"
            bg="bg-rose-500/10 border border-rose-500/20 hover:border-rose-500/40"
            icon={AlertTriangle}
            onClick={() => handleActionStatus('ESCALATED')}
          />
        </div>
      ) : null}

      {/* Priority Breakdown + Filters Row */}
      <div className="grid md:grid-cols-3 gap-4">

        {/* Priority Breakdown */}
        {priorityBreakdown.length > 0 && (
          <div className="glass p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={14} className="text-violet-400" />
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Priority Breakdown</h3>
            </div>
            <div className="space-y-2.5">
              {priorityBreakdown.map(({ priority: p, count }) => (
                <button
                  key={p}
                  onClick={() => handlePriority(p)}
                  className="w-full flex items-center gap-3 group"
                >
                  <span className="text-xs text-slate-400 w-14 text-left group-hover:text-white transition-colors">
                    {p}
                  </span>
                  <div className="flex-1 h-2 bg-[#0f1117] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${PRIORITY_BAR_COLORS[p] || 'bg-slate-500'}`}
                      style={{ width: `${(count / maxPriority) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-slate-300 w-6 text-right">{count}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-600 mt-3">Click a priority to filter below.</p>
          </div>
        )}

        {/* Filters */}
        <div className={`glass p-4 space-y-3 ${priorityBreakdown.length > 0 ? 'md:col-span-2' : 'md:col-span-3'}`}>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search by Transaction ID, Customer, Invoice..."
              value={search}
              onChange={handleSearch}
              className="w-full pl-9 pr-4 py-2 bg-[#0f1117] border border-[#2d3154] rounded-lg text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <Shield size={13} className="text-slate-500 shrink-0" />
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

          <div className="flex items-center gap-1.5 flex-wrap">
            <Filter size={13} className="text-slate-500 shrink-0" />
            {PRIORITY_OPTIONS.map(p => (
              <button
                key={p}
                onClick={() => handlePriority(p)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  priority === p
                    ? 'bg-indigo-600 text-white'
                    : 'bg-[#1a1d2e] text-slate-400 hover:text-white border border-[#2d3154]'
                }`}
              >
                {p === 'ALL' ? 'All Priorities' : p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Exception Table */}
      <div className="glass overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2d3154] bg-[#1a1d2e]">
          <div className="flex items-center gap-2">
            <Layers size={14} className="text-slate-500" />
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Exceptions</span>
            <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold">
              {total}
            </span>
          </div>
          <button
            onClick={() => navigate('/exceptions')}
            className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Full view <ArrowUpRight size={12} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs border-b border-[#2d3154]">
                <th className="text-left px-4 py-3 font-medium">Transaction ID</th>
                <th className="text-left px-4 py-3 font-medium">Customer</th>
                <th className="text-left px-4 py-3 font-medium">Exception Type</th>
                <th className="text-left px-4 py-3 font-medium">Priority</th>
                <th className="text-right px-4 py-3 font-medium">Amount</th>
                <th className="text-left px-4 py-3 font-medium">Date</th>
                <th className="text-left px-4 py-3 font-medium">Action Status</th>
                <th className="text-left px-4 py-3 font-medium">Actor</th>
                <th className="text-left px-4 py-3 font-medium">Last Action</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(10)].map((_, i) => (
                  <tr key={i} className="border-b border-[#2d3154]">
                    {[...Array(10)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="skeleton h-4 rounded w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-16 text-center">
                    <Shield size={32} className="text-slate-700 mx-auto mb-3" />
                    <p className="text-slate-500">No exceptions found for current filters.</p>
                    <button
                      onClick={() => { setActionStatus('ALL'); setPriority('ALL'); setSearch(''); }}
                      className="mt-2 text-xs text-indigo-400 hover:underline"
                    >
                      Clear filters
                    </button>
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
                      {ex.ai_priority
                        ? <PriorityBadge priority={ex.ai_priority} />
                        : <span className="text-slate-600 text-xs">—</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-right text-white font-semibold text-xs">
                      {formatCurrency(ex.gateway_amount)}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{ex.transaction_date || '—'}</td>
                    <td className="px-4 py-3">
                      <ActionStatusPill status={ex.action_status || 'OPEN'} />
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{ex.action_actor || '—'}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">
                      {ex.action_at ? formatDateTime(ex.action_at) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ChevronRight size={14} className="text-slate-600 group-hover:text-indigo-400 transition-colors" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#2d3154] text-xs text-slate-400">
            <span>
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
            </span>
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

      <p className="text-xs text-slate-700 text-center">
        All counts are calculated from live database records.
        Click any row to open the exception detail page and take action.
      </p>
    </div>
  );
}
