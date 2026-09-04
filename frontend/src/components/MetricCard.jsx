import { TrendingUp, TrendingDown } from 'lucide-react';

export default function MetricCard({ title, value, subtitle, icon: Icon, color = 'indigo', trend }) {
  const colorMap = {
    indigo:  { bg: 'from-indigo-500/20 to-indigo-600/10',  icon: 'text-indigo-400',  border: 'border-indigo-500/20' },
    emerald: { bg: 'from-emerald-500/20 to-emerald-600/10',icon: 'text-emerald-400', border: 'border-emerald-500/20' },
    amber:   { bg: 'from-amber-500/20 to-amber-600/10',    icon: 'text-amber-400',   border: 'border-amber-500/20'  },
    rose:    { bg: 'from-rose-500/20 to-rose-600/10',      icon: 'text-rose-400',    border: 'border-rose-500/20'   },
    violet:  { bg: 'from-violet-500/20 to-violet-600/10',  icon: 'text-violet-400',  border: 'border-violet-500/20' },
    blue:    { bg: 'from-blue-500/20 to-blue-600/10',      icon: 'text-blue-400',    border: 'border-blue-500/20'   },
    cyan:    { bg: 'from-cyan-500/20 to-cyan-600/10',      icon: 'text-cyan-400',    border: 'border-cyan-500/20'   },
  };

  const c = colorMap[color] || colorMap.indigo;

  return (
    <div className={`glass border ${c.border} p-5 animate-fade-in transition-all duration-200 hover:border-opacity-60 hover:scale-[1.01]`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${c.bg} flex items-center justify-center`}>
          {Icon && <Icon size={18} className={c.icon} />}
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-xs ${trend >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>

      <div className="text-2xl font-bold text-white tracking-tight">{value}</div>
      <div className="text-sm font-medium text-slate-400 mt-0.5">{title}</div>
      {subtitle && <div className="text-xs text-slate-500 mt-1">{subtitle}</div>}
    </div>
  );
}
