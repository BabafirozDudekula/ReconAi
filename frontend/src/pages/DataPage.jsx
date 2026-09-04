import { useState } from 'react';
import { Database, Download, ExternalLink } from 'lucide-react';
import { api } from '../services/api';

const DATASETS = [
  {
    key: 'payment_gateway',
    name: 'Payment Gateway',
    description: 'Gateway transaction records with payment status, method, and reference.',
    fields: ['transaction_id', 'customer_id', 'invoice_id', 'transaction_date', 'amount', 'payment_status', 'payment_method', 'gateway_reference'],
    count: 203,
    color: 'text-indigo-400',
    bg: 'from-indigo-500/20 to-indigo-600/5',
    border: 'border-indigo-500/20',
  },
  {
    key: 'bank_settlements',
    name: 'Bank Settlements',
    description: 'Bank settlement records with settled amounts and settlement status.',
    fields: ['settlement_id', 'transaction_id', 'settlement_date', 'settled_amount', 'settlement_status', 'bank_reference'],
    count: 194,
    color: 'text-emerald-400',
    bg: 'from-emerald-500/20 to-emerald-600/5',
    border: 'border-emerald-500/20',
  },
  {
    key: 'invoices',
    name: 'Invoices',
    description: 'Invoice records with expected amounts and invoice status.',
    fields: ['invoice_id', 'customer_id', 'invoice_amount', 'invoice_date', 'invoice_status'],
    count: 206,
    color: 'text-amber-400',
    bg: 'from-amber-500/20 to-amber-600/5',
    border: 'border-amber-500/20',
  },
];

const ANOMALIES = [
  { type: 'Clean Match',          count: 163, pct: '81.5%', color: '#10b981', desc: 'Fully matched across all 3 sources' },
  { type: 'Amount Mismatch',      count: 12,  pct: '6.0%',  color: '#f59e0b', desc: 'Gateway vs bank settlement difference' },
  { type: 'Missing Settlement',   count: 8,   pct: '4.0%',  color: '#ef4444', desc: 'No bank settlement for gateway success' },
  { type: 'Payment Failed',       count: 4,   pct: '2.0%',  color: '#f87171', desc: 'Gateway FAILED status' },
  { type: 'Invoice Mismatch',     count: 5,   pct: '2.5%',  color: '#3b82f6', desc: 'Invoice amount differs from payment' },
  { type: 'Date Mismatch',        count: 3,   pct: '1.5%',  color: '#14b8a6', desc: 'Settlement 10+ days late' },
  { type: 'Duplicate',            count: 4,   pct: '2.0%',  color: '#a855f7', desc: 'Duplicate gateway reference' },
  { type: 'Missing Transaction',  count: 5,   pct: '2.5%',  color: '#ef4444', desc: 'Settlement with no gateway record' },
  { type: 'Refund',               count: 2,   pct: '1.0%',  color: '#818cf8', desc: 'Refunded transactions' },
  { type: 'Settlement Pending',   count: 2,   pct: '1.0%',  color: '#fbbf24', desc: 'Bank settlement still PENDING' },
];

export default function DataPage() {
  const [selected, setSelected] = useState('payment_gateway');
  const ds = DATASETS.find(d => d.key === selected);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white">Data</h1>
        <p className="text-slate-400 text-sm mt-1">
          Synthetic demo datasets — all data is artificially generated for demonstration purposes
        </p>
      </div>

      {/* Dataset cards */}
      <div className="grid md:grid-cols-3 gap-4">
        {DATASETS.map(d => (
          <div
            key={d.key}
            onClick={() => setSelected(d.key)}
            className={`glass p-5 cursor-pointer transition-all border ${
              selected === d.key ? d.border : 'border-[#2d3154]'
            } hover:border-indigo-500/30`}
          >
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${d.bg} flex items-center justify-center mb-3`}>
              <Database size={18} className={d.color} />
            </div>
            <div className="text-white font-bold mb-1">{d.name}</div>
            <div className="text-xs text-slate-400 mb-3">{d.description}</div>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-black text-white">{d.count}</span>
              <a
                href={api.downloadDataset(d.key)}
                onClick={e => e.stopPropagation()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0f1117] border border-[#2d3154] text-xs text-slate-400 hover:text-white hover:border-indigo-500/30 transition-all"
              >
                <Download size={12} /> CSV
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Selected dataset fields */}
      <div className="glass p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-300">
            {ds?.name} — Fields
          </h3>
          <a
            href={api.downloadDataset(selected)}
            className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            <Download size={12} /> Download CSV <ExternalLink size={12} />
          </a>
        </div>
        <div className="flex flex-wrap gap-2">
          {ds?.fields.map(f => (
            <span key={f} className="px-3 py-1.5 rounded-lg bg-[#0f1117] border border-[#2d3154] font-mono text-xs text-slate-300">
              {f}
            </span>
          ))}
        </div>
      </div>

      {/* Anomaly distribution */}
      <div className="glass p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">
          Intentional Anomaly Distribution
          <span className="ml-2 text-xs text-slate-500 font-normal">200 total records</span>
        </h3>
        <div className="space-y-2.5">
          {ANOMALIES.map(a => (
            <div key={a.type} className="flex items-center gap-3">
              <div className="w-32 text-xs text-slate-400 text-right shrink-0">{a.type}</div>
              <div className="flex-1 h-5 bg-[#0f1117] rounded overflow-hidden">
                <div
                  className="h-full rounded flex items-center pl-2"
                  style={{ width: `${(a.count / 163) * 100}%`, background: a.color + '33', borderRight: `2px solid ${a.color}` }}
                />
              </div>
              <div className="text-xs font-bold text-white w-8 shrink-0">{a.count}</div>
              <div className="text-xs text-slate-500 w-10 shrink-0">{a.pct}</div>
              <div className="text-xs text-slate-600 hidden md:block">{a.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="glass border border-amber-500/20 p-4">
        <p className="text-xs text-amber-400">
          <strong>Important:</strong> All data in this application is synthetic and artificially generated for hackathon demonstration purposes.
          No real customer information, real financial transactions, or real banking data is used.
          This prototype should not be used for actual financial operations.
        </p>
      </div>
    </div>
  );
}
