import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from 'recharts';
import {
  FileText, CheckCircle, AlertTriangle, TrendingUp,
  DollarSign, RefreshCw, Brain, Play, ExternalLink
} from 'lucide-react';
import MetricCard from '../components/MetricCard';
import { StatusBadge, formatCurrency, formatDateTime } from '../components/StatusBadge';
import { api } from '../services/api';

const PIE_COLORS = ['#6366f1', '#ef4444', '#f59e0b', '#a855f7', '#3b82f6', '#14b8a6', '#10b981', '#fbbf24', '#f87171'];

const CUSTOM_TOOLTIP = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass px-3 py-2 text-xs">
      <div className="text-white font-semibold">{payload[0].name}</div>
      <div className="text-slate-400">{payload[0].value} records</div>
    </div>
  );
};

const BAR_TOOLTIP = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass px-3 py-2 text-xs">
      <div className="text-white font-semibold">{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color }}>{p.name}: {p.value}</div>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState(null);
  const [exceptions, setExceptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [m, exc] = await Promise.all([
        api.getMetrics(),
        api.getExceptions({ pageSize: 5 }),
      ]);
      setMetrics(m);
      setExceptions(exc.items || []);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleRunDemo() {
    setRunning(true);
    try {
      await api.runReconciliation(true);
      await loadData();
    } catch (e) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  }

  // Pie chart data
  const pieData = metrics
    ? [
        { name: 'Matched', value: metrics.matched_count },
        ...metrics.exception_distribution.map(d => ({
          name: d.status.replace(/_/g, ' '),
          value: d.count,
        })),
      ]
    : [];

  // Bar chart data
  const barData = metrics?.exception_distribution?.map(d => ({
    name: d.status.replace(/_/g, ' ').split(' ').map(w => w[0]).join(''),
    fullName: d.status.replace(/_/g, ' '),
    count: d.count,
    value: d.value,
  })) || [];

  if (loading) {
    return (
      <div className="flex flex-col gap-4 animate-fade-in">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="skeleton h-64 rounded-xl" />
          <div className="skeleton h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error && !metrics) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 animate-fade-in">
        <div className="text-5xl">🔍</div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-white mb-2">No Reconciliation Data</h2>
          <p className="text-slate-400 mb-6">Run the demo to load 200+ synthetic records.</p>
          <button
            onClick={handleRunDemo}
            disabled={running}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold hover:opacity-90 transition-all"
          >
            {running ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Running...</>
            ) : (
              <><Play size={16} /> Load Demo Dataset</>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Reconciliation Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">
            Run ID: <span className="text-indigo-300 font-mono">{metrics?.run_id}</span>
            {metrics?.created_at && (
              <span className="text-slate-500 ml-3">• {formatDateTime(metrics.created_at)}</span>
            )}
          </p>
        </div>
        <button
          onClick={handleRunDemo}
          disabled={running}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-indigo-500/30 text-indigo-300 text-sm hover:bg-indigo-500/10 transition-all disabled:opacity-50"
        >
          <RefreshCw size={14} className={running ? 'animate-spin' : ''} />
          {running ? 'Running...' : 'Re-run Demo'}
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm">
          {error}
        </div>
      )}

      {/* Metric cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <MetricCard
          title="Total Records"
          value={metrics?.total_records?.toLocaleString()}
          icon={FileText}
          color="indigo"
          subtitle="Across all sources"
        />
        <MetricCard
          title="Matched"
          value={metrics?.matched_count?.toLocaleString()}
          icon={CheckCircle}
          color="emerald"
          subtitle="Successfully reconciled"
        />
        <MetricCard
          title="Exceptions"
          value={metrics?.exception_count?.toLocaleString()}
          icon={AlertTriangle}
          color="amber"
          subtitle="Require attention"
        />
        <MetricCard
          title="Match Rate"
          value={`${metrics?.match_rate?.toFixed(1)}%`}
          icon={TrendingUp}
          color="violet"
          subtitle="Reconciliation success"
        />
        <MetricCard
          title="Exception Value"
          value={formatCurrency(metrics?.exception_value)}
          icon={DollarSign}
          color="rose"
          subtitle="Unresolved amount"
        />
      </div>

      {/* Charts row */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Donut */}
        <div className="glass p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Reconciliation Status</h3>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                  paddingAngle={2} dataKey="value">
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CUSTOM_TOOLTIP />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-1.5">
              {pieData.slice(0, 6).map((d, i) => (
                <div key={d.name} className="flex items-center gap-2 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="text-slate-400 truncate">{d.name}</span>
                  <span className="ml-auto text-white font-semibold">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bar chart */}
        <div className="glass p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Exception Distribution</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={barData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d3154" />
              <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip content={<BAR_TOOLTIP />} />
              <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* AI Summary */}
      {metrics?.ai_summary && (
        <div className="glass p-5 border border-indigo-500/20">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/10 flex items-center justify-center">
              <Brain size={16} className="text-indigo-400" />
            </div>
            <h3 className="text-sm font-semibold text-indigo-300">AI Finance Summary</h3>
          </div>
          <p className="text-slate-300 text-sm leading-relaxed">{metrics.ai_summary}</p>
        </div>
      )}

      {/* Recent exceptions */}
      <div className="glass p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-300">Recent Exceptions</h3>
          <button
            onClick={() => navigate('/exceptions')}
            className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            View all <ExternalLink size={12} />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs border-b border-[#2d3154]">
                <th className="text-left pb-2 font-medium">Transaction</th>
                <th className="text-left pb-2 font-medium">Customer</th>
                <th className="text-left pb-2 font-medium">Status</th>
                <th className="text-right pb-2 font-medium">Amount</th>
                <th className="text-left pb-2 font-medium pl-4">Date</th>
              </tr>
            </thead>
            <tbody>
              {exceptions.map(ex => (
                <tr
                  key={ex.id}
                  onClick={() => navigate(`/exceptions/${ex.id}`)}
                  className="border-b border-[#2d3154] hover:bg-white/5 cursor-pointer transition-colors"
                >
                  <td className="py-2.5 font-mono text-indigo-300 text-xs">{ex.transaction_id}</td>
                  <td className="py-2.5 text-slate-400 text-xs">{ex.customer_id || '—'}</td>
                  <td className="py-2.5"><StatusBadge status={ex.recon_status} /></td>
                  <td className="py-2.5 text-right text-white font-semibold text-xs">{formatCurrency(ex.gateway_amount)}</td>
                  <td className="py-2.5 text-slate-500 text-xs pl-4">{ex.transaction_date || '—'}</td>
                </tr>
              ))}
              {exceptions.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-slate-500">No exceptions found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
