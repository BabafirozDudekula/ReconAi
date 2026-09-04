import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Brain, TrendingUp, AlertTriangle, ChevronRight,
  RefreshCw, Zap
} from 'lucide-react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell
} from 'recharts';
import { StatusBadge, PriorityBadge, formatCurrency } from '../components/StatusBadge';
import { api } from '../services/api';

const PRIORITY_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const PRIORITY_COLORS = { CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#f59e0b', LOW: '#14b8a6' };

export default function AIInsightsPage() {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState(null);
  const [exceptions, setExceptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);

  const loadData = useCallback(async () => {
    try {
      const [m, exc] = await Promise.all([
        api.getMetrics(),
        api.getExceptions({ pageSize: 50 }),
      ]);
      setMetrics(m);
      setExceptions(exc.items || []);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Exceptions sorted by priority
  const prioritized = [...exceptions]
    .filter(e => e.ai_priority)
    .sort((a, b) =>
      (PRIORITY_ORDER[a.ai_priority] ?? 9) - (PRIORITY_ORDER[b.ai_priority] ?? 9)
    );

  const withoutAI = exceptions.filter(e => !e.ai_explanation);

  async function analyzeAll() {
    setAnalyzing(true);
    setProgress(0);
    const targets = withoutAI.slice(0, 10); // analyze top 10
    for (let i = 0; i < targets.length; i++) {
      try {
        await api.analyzeException(targets[i].id);
      } catch {}
      setProgress(Math.round(((i + 1) / targets.length) * 100));
    }
    await loadData();
    setAnalyzing(false);
  }

  // Radar data for exception types
  const radarData = metrics?.exception_distribution?.map(d => ({
    subject: d.status.replace(/_/g, ' ').replace(' MISMATCH', '').replace(' SETTLEMENT', ''),
    count: d.count,
  })) || [];

  // Value at risk bar
  const valueData = metrics?.exception_distribution
    ?.filter(d => d.value > 0)
    ?.map(d => ({
      name: d.status.replace(/_/g, ' ').split(' ').slice(0, 2).join(' '),
      value: d.value,
    })) || [];

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="skeleton h-8 w-48 rounded" />
        <div className="grid md:grid-cols-2 gap-4">
          <div className="skeleton h-64 rounded-xl" />
          <div className="skeleton h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">AI Insights</h1>
          <p className="text-slate-400 text-sm mt-1">
            {prioritized.length} of {exceptions.length} exceptions analyzed by AI
          </p>
        </div>
        {withoutAI.length > 0 && (
          <button
            onClick={analyzeAll}
            disabled={analyzing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-bold hover:opacity-90 disabled:opacity-60"
          >
            {analyzing ? (
              <><RefreshCw size={14} className="animate-spin" /> Analyzing ({progress}%)</>
            ) : (
              <><Zap size={14} /> Analyze Top 10 Exceptions</>
            )}
          </button>
        )}
      </div>

      {/* AI Summary */}
      {metrics?.ai_summary && (
        <div className="glass border border-indigo-500/20 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Brain size={18} className="text-indigo-400" />
            <span className="text-sm font-semibold text-indigo-300">AI Finance Summary</span>
          </div>
          <p className="text-slate-300 leading-relaxed">{metrics.ai_summary}</p>
        </div>
      )}

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Radar */}
        {radarData.length > 0 && (
          <div className="glass p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-4">Exception Risk Profile</h3>
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#2d3154" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 10 }} />
                <Radar dataKey="count" fill="#6366f1" fillOpacity={0.3} stroke="#6366f1" strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Value at risk */}
        {valueData.length > 0 && (
          <div className="glass p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-4">Value at Risk by Category</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={valueData} margin={{ left: -10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d3154" />
                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 9 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }}
                  tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={v => formatCurrency(v)}
                  contentStyle={{ background: '#1a1d2e', border: '1px solid #2d3154', borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {valueData.map((_, i) => (
                    <Cell key={i} fill={['#ef4444', '#f59e0b', '#a855f7', '#3b82f6', '#14b8a6'][i % 5]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Prioritized exceptions */}
      <div className="glass p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">
          Prioritized Exceptions
          <span className="ml-2 text-xs text-slate-500 font-normal">Sorted by AI priority</span>
        </h3>

        {prioritized.length === 0 ? (
          <div className="text-center py-8">
            <Brain size={32} className="text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 text-sm mb-3">No AI-analyzed exceptions yet.</p>
            <p className="text-slate-600 text-xs">Go to an exception and click "Ask AI" to get analysis.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {prioritized.map(ex => (
              <div
                key={ex.id}
                onClick={() => navigate(`/exceptions/${ex.id}`)}
                className="flex items-center gap-4 p-3 rounded-lg bg-[#1a1d2e] border border-[#2d3154] cursor-pointer hover:border-indigo-500/30 transition-all group"
              >
                <div className="w-1 h-12 rounded-full shrink-0"
                  style={{ background: PRIORITY_COLORS[ex.ai_priority] || '#6b7280' }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs text-indigo-300">{ex.transaction_id}</span>
                    <StatusBadge status={ex.recon_status} />
                    <PriorityBadge priority={ex.ai_priority} />
                  </div>
                  <p className="text-xs text-slate-400 truncate">{ex.ai_explanation}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-white">{formatCurrency(ex.gateway_amount)}</div>
                  <div className="text-xs text-slate-500">
                    {ex.ai_confidence ? `${Math.round(ex.ai_confidence * 100)}% confidence` : ''}
                  </div>
                </div>
                <ChevronRight size={14} className="text-slate-600 group-hover:text-slate-400 shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Unanalyzed */}
      {withoutAI.length > 0 && (
        <div className="glass p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-amber-400" />
            <h3 className="text-sm font-semibold text-slate-300">
              {withoutAI.length} exceptions not yet analyzed
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {withoutAI.slice(0, 12).map(ex => (
              <button
                key={ex.id}
                onClick={() => navigate(`/exceptions/${ex.id}`)}
                className="px-2.5 py-1 rounded-lg bg-[#1a1d2e] border border-[#2d3154] text-xs font-mono text-slate-400 hover:border-indigo-500/30 hover:text-indigo-300 transition-all"
              >
                {ex.transaction_id}
              </button>
            ))}
            {withoutAI.length > 12 && (
              <span className="px-2.5 py-1 text-xs text-slate-600">+{withoutAI.length - 12} more</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
