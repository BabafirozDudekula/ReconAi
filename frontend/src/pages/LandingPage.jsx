import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Zap, Shield, Brain, ClipboardCheck, ArrowRight, Play, Download } from 'lucide-react';
import { api } from '../services/api';

const FEATURES = [
  {
    icon: Zap,
    title: 'Automated Reconciliation',
    desc: 'Deterministic matching engine reconciles payment gateway, bank, and invoice records in seconds — across 200+ transactions.',
    color: 'text-indigo-400',
    bg: 'from-indigo-500/20 to-indigo-600/5',
  },
  {
    icon: Brain,
    title: 'AI Exception Analysis',
    desc: 'LLM-powered analysis explains each unresolved exception — with likely cause, confidence score, and recommended action.',
    color: 'text-violet-400',
    bg: 'from-violet-500/20 to-violet-600/5',
  },
  {
    icon: ClipboardCheck,
    title: 'Complete Audit Trail',
    desc: 'Every decision, AI analysis, and human action is recorded with timestamps — full traceability for finance operations.',
    color: 'text-emerald-400',
    bg: 'from-emerald-500/20 to-emerald-600/5',
  },
];

const METRICS_PREVIEW = [
  { label: 'Match Rate', value: '~81%' },
  { label: 'Records', value: '200+' },
  { label: 'Exception Types', value: '10' },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLoadDemo() {
    setLoading(true);
    setError('');
    try {
      await api.runReconciliation(true);
      navigate('/dashboard');
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-semibold mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
          TRACK 04 — AI FINANCE CONTROLLER
        </div>

        {/* Logo */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 animate-pulse-ring">
            <Zap size={28} className="text-white" />
          </div>
          <div className="text-left">
            <h1 className="text-4xl font-black text-white tracking-tight">
              Recon<span className="text-indigo-400">AI</span>
            </h1>
            <p className="text-slate-400 text-sm">AI Finance Controller</p>
          </div>
        </div>

        {/* Headline */}
        <h2 className="text-5xl md:text-6xl font-black text-white max-w-3xl leading-tight mb-6">
          Your{' '}
          <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            AI Finance
          </span>{' '}
          Controller
        </h2>

        <p className="text-xl text-slate-400 max-w-2xl mb-4">
          Automatically reconcile transactions, detect financial exceptions, and understand what needs attention.
        </p>
        <p className="text-sm text-slate-500 italic mb-10">
          "Reconcile faster. Understand exceptions. Act with confidence."
        </p>

        {/* Preview metrics */}
        <div className="flex items-center gap-8 mb-10">
          {METRICS_PREVIEW.map(m => (
            <div key={m.label} className="text-center">
              <div className="text-3xl font-black text-white">{m.value}</div>
              <div className="text-xs text-slate-500 mt-1">{m.label}</div>
            </div>
          ))}
        </div>

        {/* CTAs */}
        <div className="flex items-center gap-4 flex-wrap justify-center">
          <button
            onClick={handleLoadDemo}
            disabled={loading}
            className="flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-base shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-105 transition-all duration-200 disabled:opacity-60 disabled:scale-100"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Running Reconciliation...
              </>
            ) : (
              <>
                <Play size={18} />
                Load Demo Dataset
              </>
            )}
          </button>

          <button
            onClick={() => { if (!loading) navigate('/dashboard'); }}
            className="flex items-center gap-2 px-8 py-4 rounded-xl border border-indigo-500/30 text-indigo-300 font-semibold hover:bg-indigo-500/10 transition-all duration-200"
          >
            <ArrowRight size={18} />
            View Dashboard
          </button>
        </div>

        {error && (
          <div className="mt-6 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm max-w-md">
            {error}
          </div>
        )}

        {/* Synthetic data disclaimer */}
        <p className="mt-8 text-xs text-slate-600 flex items-center gap-1.5">
          <Shield size={12} />
          This application uses synthetic demo data only. No real financial information.
        </p>
      </section>

      {/* Features */}
      <section className="px-6 py-16 max-w-5xl mx-auto w-full">
        <h3 className="text-center text-2xl font-bold text-white mb-10">
          How it works
        </h3>
        <div className="grid md:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div key={f.title} className="glass p-6 hover:border-indigo-500/30 transition-all duration-200">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${f.bg} flex items-center justify-center mb-4`}>
                <f.icon size={20} className={f.color} />
              </div>
              <h4 className="text-white font-bold mb-2">{f.title}</h4>
              <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Flow visualization */}
      <section className="px-6 pb-16 max-w-5xl mx-auto w-full">
        <div className="glass p-6">
          <h3 className="text-center text-sm font-semibold text-slate-400 mb-6 uppercase tracking-widest">
            Demo Flow
          </h3>
          <div className="flex items-center justify-center gap-2 flex-wrap text-sm text-center">
            {['Data', 'Reconciliation', 'Measured Result', 'Exception', 'AI Explanation', 'Action', 'Audit Trail'].map((step, i, arr) => (
              <div key={step} className="flex items-center gap-2">
                <div className="px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-medium text-xs whitespace-nowrap">
                  {step}
                </div>
                {i < arr.length - 1 && (
                  <ArrowRight size={14} className="text-slate-600 shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
