import { useState, useEffect, useCallback } from 'react';
import { ClipboardList, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDateTime } from '../components/StatusBadge';
import { api } from '../services/api';

const ACTION_COLORS = {
  RECONCILIATION_RUN: 'text-indigo-400',
  AI_ANALYSIS:        'text-violet-400',
  REVIEWED:           'text-blue-400',
  RESOLVED:           'text-emerald-400',
  ESCALATED:          'text-amber-400',
};

export default function AuditLogPage() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 30;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAuditLog({
        transactionId: search || undefined,
        page,
        pageSize: PAGE_SIZE,
      });
      setItems(res.items || []);
      setTotal(res.total || 0);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">Audit Log</h1>
          <p className="text-slate-400 text-sm mt-1">
            Complete trace of all system and user actions — {total} entries
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="glass p-4 flex items-center gap-3">
        <Search size={14} className="text-slate-500" />
        <input
          type="text"
          placeholder="Search by Transaction ID..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="flex-1 bg-transparent text-sm text-slate-300 placeholder-slate-600 focus:outline-none"
        />
      </div>

      {/* Table */}
      <div className="glass overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs border-b border-[#2d3154] bg-[#1a1d2e]">
                <th className="text-left px-4 py-3 font-medium">Timestamp</th>
                <th className="text-left px-4 py-3 font-medium">Actor</th>
                <th className="text-left px-4 py-3 font-medium">Action</th>
                <th className="text-left px-4 py-3 font-medium">Transaction ID</th>
                <th className="text-left px-4 py-3 font-medium">Previous Status</th>
                <th className="text-left px-4 py-3 font-medium">New Status</th>
                <th className="text-left px-4 py-3 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(15)].map((_, i) => (
                  <tr key={i} className="border-b border-[#2d3154]">
                    {[...Array(7)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="skeleton h-4 rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <ClipboardList size={32} className="text-slate-700 mx-auto mb-3" />
                    <p className="text-slate-500">No audit entries yet. Run the demo to see activity.</p>
                  </td>
                </tr>
              ) : (
                items.map(entry => (
                  <tr key={entry.id} className="border-b border-[#2d3154] hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {formatDateTime(entry.timestamp)}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-300">{entry.actor}</td>
                    <td className="px-4 py-3 text-xs">
                      <span className={`font-mono font-semibold ${ACTION_COLORS[entry.action] || 'text-slate-400'}`}>
                        {entry.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-indigo-300">
                      {entry.transaction_id || '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {entry.previous_status || '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300">
                      {entry.new_status || '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 max-w-xs truncate" title={entry.reason}>
                      {entry.reason || '—'}
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
                className="p-1 rounded hover:bg-white/5 disabled:opacity-30">
                <ChevronLeft size={14} />
              </button>
              <span>Page {page} of {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="p-1 rounded hover:bg-white/5 disabled:opacity-30">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
