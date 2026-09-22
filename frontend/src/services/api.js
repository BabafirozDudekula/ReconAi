/**
 * ReconAI API service layer.
 * All API calls go through this module.
 * Backend is proxied via Vite at /api → http://localhost:8000
 */

const BASE = '/api';

async function request(path, options = {}) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    return res.json();
  } catch (err) {
    if (err.name === 'TypeError') {
      throw new Error('Cannot connect to backend. Is the server running on port 8000?');
    }
    throw err;
  }
}

// ── Reconciliation ──────────────────────────────────────────────

export const api = {
  health: () => request('/health'),

  runReconciliation: (demoMode = true) =>
    request('/reconcile', {
      method: 'POST',
      body: JSON.stringify({ demo_mode: demoMode }),
    }),

  getMetrics: (runId) =>
    request(`/metrics${runId ? `?run_id=${runId}` : ''}`),

  getRuns: () => request('/runs'),

  // Records
  getRecords: (params = {}) => {
    const q = new URLSearchParams();
    if (params.runId) q.set('run_id', params.runId);
    if (params.status) q.set('status', params.status);
    if (params.search) q.set('search', params.search);
    if (params.page) q.set('page', params.page);
    if (params.pageSize) q.set('page_size', params.pageSize);
    return request(`/records?${q}`);
  },

  // Exceptions
  getExceptions: (params = {}) => {
    const q = new URLSearchParams();
    if (params.runId) q.set('run_id', params.runId);
    if (params.status) q.set('status', params.status);
    if (params.actionStatus) q.set('action_status', params.actionStatus);
    if (params.priority) q.set('priority', params.priority);
    if (params.search) q.set('search', params.search);
    if (params.page) q.set('page', params.page);
    if (params.pageSize) q.set('page_size', params.pageSize);
    return request(`/exceptions?${q}`);
  },

  getExceptionSummary: (runId) =>
    request(`/exceptions/summary${runId ? `?run_id=${runId}` : ''}`),

  getExceptionDetail: (id) => request(`/exceptions/${id}`),

  analyzeException: (id) =>
    request(`/exceptions/${id}/analyze`, { method: 'POST' }),

  takeAction: (id, action, reason = '', actor = 'Admin') =>
    request(`/exceptions/${id}/action`, {
      method: 'POST',
      body: JSON.stringify({ action, reason, actor }),
    }),

  // Audit
  getAuditLog: (params = {}) => {
    const q = new URLSearchParams();
    if (params.runId) q.set('run_id', params.runId);
    if (params.transactionId) q.set('transaction_id', params.transactionId);
    if (params.action) q.set('action', params.action);
    if (params.page) q.set('page', params.page);
    if (params.pageSize) q.set('page_size', params.pageSize);
    return request(`/audit?${q}`);
  },

  getAuditForTransaction: (transactionId, page = 1) =>
    request(`/audit?transaction_id=${encodeURIComponent(transactionId)}&page=${page}&page_size=20`),

  // Downloads
  downloadDataset: (name) => `${BASE}/data/download/${name}`,

  // Upload user data
  getUploadSchema: () => request('/upload/schema'),

  uploadFiles: async (gatewayFile, settlementsFile, invoicesFile) => {
    const form = new FormData();
    form.append('gateway_file', gatewayFile);
    form.append('settlements_file', settlementsFile);
    form.append('invoices_file', invoicesFile);
    try {
      const res = await fetch(`${BASE}/upload`, { method: 'POST', body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        // Surface validation errors clearly
        if (err.detail?.errors) throw new Error(err.detail.errors.join('\n'));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      return res.json();
    } catch (err) {
      if (err.name === 'TypeError') {
        throw new Error('Cannot connect to backend. Is the server running on port 8000?');
      }
      throw err;
    }
  },
};
