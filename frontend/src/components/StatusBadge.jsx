/**
 * Status badge configuration for all reconciliation statuses.
 */

export const STATUS_CONFIG = {
  MATCHED:             { label: 'Matched',              cls: 'badge-matched',    priority: 5 },
  AMOUNT_MISMATCH:     { label: 'Amount Mismatch',      cls: 'badge-amount',     priority: 2 },
  MISSING_SETTLEMENT:  { label: 'Missing Settlement',   cls: 'badge-missing',    priority: 1 },
  MISSING_TRANSACTION: { label: 'Missing Transaction',  cls: 'badge-missing',    priority: 1 },
  DUPLICATE:           { label: 'Duplicate',            cls: 'badge-duplicate',  priority: 1 },
  INVOICE_MISMATCH:    { label: 'Invoice Mismatch',     cls: 'badge-invoice',    priority: 3 },
  DATE_MISMATCH:       { label: 'Date Mismatch',        cls: 'badge-date',       priority: 4 },
  PAYMENT_FAILED:      { label: 'Payment Failed',       cls: 'badge-failed',     priority: 2 },
  REFUND:              { label: 'Refund',               cls: 'badge-refund',     priority: 4 },
  SETTLEMENT_PENDING:  { label: 'Settlement Pending',   cls: 'badge-pending',    priority: 3 },
  UNRESOLVED:          { label: 'Unresolved',           cls: 'badge-unresolved', priority: 0 },
};

export const PRIORITY_CONFIG = {
  CRITICAL: { cls: 'badge-missing',   label: 'Critical' },
  HIGH:     { cls: 'badge-failed',    label: 'High'     },
  MEDIUM:   { cls: 'badge-amount',    label: 'Medium'   },
  LOW:      { cls: 'badge-date',      label: 'Low'      },
};

export function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, cls: 'badge-unresolved' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

export function PriorityBadge({ priority }) {
  const cfg = PRIORITY_CONFIG[priority] || { label: priority, cls: 'badge-unresolved' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

export function formatCurrency(amount) {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  // Append 'Z' if the string has no timezone designator so it is parsed as UTC.
  const utcStr = /[Zz]|[+-]\d{2}:?\d{2}$/.test(dateStr) ? dateStr : dateStr + 'Z';
  return new Date(utcStr).toLocaleDateString('en-IN', {
    year: 'numeric', month: 'short', day: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  // Append 'Z' if the string has no timezone designator so it is parsed as UTC.
  const utcStr = /[Zz]|[+-]\d{2}:?\d{2}$/.test(dateStr) ? dateStr : dateStr + 'Z';
  return new Date(utcStr).toLocaleString('en-IN', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  });
}
