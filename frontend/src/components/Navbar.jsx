import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, GitMerge, AlertTriangle,
  Brain, ClipboardList, Database, Zap, Shield
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/dashboard',      icon: LayoutDashboard, label: 'Dashboard'      },
  { to: '/reconciliation', icon: GitMerge,        label: 'Reconciliation' },
  { to: '/exceptions',     icon: AlertTriangle,   label: 'Exceptions'     },
  { to: '/action-center',  icon: Shield,          label: 'Action Center'  },
  { to: '/ai-insights',    icon: Brain,           label: 'AI Insights'    },
  { to: '/audit',          icon: ClipboardList,   label: 'Audit Log'      },
  { to: '/data',           icon: Database,        label: 'Data'           },
];

export default function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center px-6 glass border-b border-[#2d3154]">
      {/* Logo */}
      <NavLink to="/" className="flex items-center gap-2 mr-10 no-underline">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
          <Zap size={16} className="text-white" />
        </div>
        <span className="text-white font-bold text-lg tracking-tight">
          Recon<span className="text-indigo-400">AI</span>
        </span>
      </NavLink>

      {/* Nav links */}
      <div className="flex items-center gap-1">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 no-underline
              ${isActive
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`
            }
          >
            <Icon size={15} />
            {label}
          </NavLink>
        ))}
      </div>

      {/* Right side indicator */}
      <div className="ml-auto flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Live
        </div>
      </div>
    </nav>
  );
}
