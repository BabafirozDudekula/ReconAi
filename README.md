# ReconAI — AI Finance Controller

> **Reconcile faster. Understand exceptions. Act with confidence.**

[![Track](https://img.shields.io/badge/TRACK%2004-AI%20Finance%20Controller-6366f1?style=flat-square)](.)
[![Synthetic Data](https://img.shields.io/badge/Data-Synthetic%20Only-10b981?style=flat-square)](.)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](.)

---

> ⚠️ **This project uses synthetic data and is intended as a hackathon prototype.**
> No real customer financial information is used. No real financial transactions are made.

---

## Problem

Finance teams manually compare:
- Payment gateway transactions
- Bank settlement records  
- Invoice records

This leads to: amount mismatches, missing transactions, duplicates, delayed settlements, incorrect invoice mappings, and payment status conflicts — all requiring manual investigation.

## Solution

ReconAI is an AI-powered finance controller that:
1. **Deterministically reconciles** 200+ records across three data sources using business rules
2. **Classifies exceptions** into 10 types automatically
3. **Uses AI** to explain each unresolved exception with confidence scores and recommendations
4. **Records every action** in a full audit trail
5. Gives finance teams a **clear, actionable dashboard** — not a black box

---

## Features

| Feature | Description |
|---|---|
| 🚀 One-click Demo | Load 200+ synthetic records and run full reconciliation in ~1 second |
| 🔍 Deterministic Engine | Business rules matching — no LLM guessing at reconciliation |
| 🤖 AI Exception Analysis | GPT-4o-mini explains each exception with cause, confidence, and action |
| 📊 Live Dashboard | Real-time metrics: match rate, exception value, distribution charts |
| 🗂️ Full Audit Trail | Every action timestamped — finance-grade traceability |
| 📁 CSV Downloads | Download all synthetic datasets |
| ⚡ AI Fallback | Works completely without OpenAI key — rule-based analysis kicks in |

---

## Architecture

```
reconai/
├── frontend/               # React 18 + Vite + Tailwind CSS v4
│   └── src/
│       ├── pages/          # Dashboard, Exceptions, AI Insights, Audit, Data
│       ├── components/     # Navbar, MetricCard, StatusBadge
│       └── services/api.js # Centralized API client
│
├── backend/                # Python 3.11+ + FastAPI
│   ├── main.py             # FastAPI app + all routes
│   ├── database/           # SQLAlchemy + SQLite models
│   ├── reconciliation/     # Deterministic matching engine
│   ├── ai/                 # OpenAI integration + rule-based fallback
│   └── services/           # Orchestration logic
│
├── data/                   # Synthetic CSV datasets
│   ├── payment_gateway.csv  (203 records)
│   ├── bank_settlements.csv (194 records)
│   └── invoices.csv         (206 records)
│
├── generate_data.py        # Synthetic data generator
├── requirements.txt
└── .env.example
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite 8 |
| Styling | Tailwind CSS v4 |
| Charts | Recharts |
| Icons | Lucide React |
| Routing | React Router v7 |
| Backend | Python 3.11+ + FastAPI |
| Database | SQLite via SQLAlchemy |
| Data | Pandas |
| AI | OpenAI API (optional) |

---

## How It Works

### Reconciliation Engine (Deterministic)

Matching priority:
1. Exact `transaction_id` match across gateway + settlement
2. Classify unmatched by exception type using business rules
3. Date lag check (>7 days = DATE_MISMATCH)
4. Amount delta check (>₹1 = AMOUNT_MISMATCH)
5. Invoice cross-check

Exception types classified:
```
MATCHED | AMOUNT_MISMATCH | MISSING_SETTLEMENT | MISSING_TRANSACTION |
DUPLICATE | INVOICE_MISMATCH | DATE_MISMATCH | PAYMENT_FAILED | REFUND | SETTLEMENT_PENDING
```

### AI Analysis (LLM)

When the user clicks "Ask AI" on an exception:
1. Structured context (amounts, statuses, dates) is packaged into a prompt
2. GPT-4o-mini returns: explanation, likely cause, confidence, recommendation, priority
3. If API is unavailable → rule-based fallback with pre-defined expert analysis
4. All results are stored in SQLite and shown in the UI

**AI never performs matching. AI never makes financial decisions. All actions are human-controlled.**

---

## Dataset

| Dataset | Records | Anomalies |
|---|---|---|
| Payment Gateway | 203 | Duplicates, FAILED, REFUNDED statuses |
| Bank Settlements | 194 | Missing settlements, PENDING status, amount differences |
| Invoices | 206 | Invoice amount mismatches |

**Intentional anomaly distribution:**
- 163 clean matches (81.5%)
- 12 amount mismatches
- 8 missing settlements (including TXN1087 showcase)
- 5 missing transactions
- 4 duplicates
- 5 invoice mismatches
- 3 date mismatches
- 4 failed payments
- 2 refunds
- 2 pending settlements

---

## Metrics Produced

```
Match Rate = (Matched / Total) × 100
```

Dashboard shows:
- Total records
- Matched count
- Exception count
- Match rate %
- Total transaction value
- Exception value (₹)
- Resolved value (₹)
- Exception distribution by type

---

## AI Usage

| Component | AI Used? | Why |
|---|---|---|
| Reconciliation matching | ❌ No | Deterministic business rules are faster, transparent, auditable |
| Exception classification | ❌ No | Rule-based — specific, reliable |
| Exception explanation | ✅ Yes | LLM explains nuanced financial scenarios naturally |
| AI summary | ✅ Yes | Natural language dashboard summary |
| Fallback (no API key) | 🔄 Rule-based | Pre-written expert analysis per exception type |

---

## Installation

### Prerequisites
- Python 3.11+
- Node.js 18+

### 1. Clone and set up environment

```bash
git clone https://github.com/YOUR_USERNAME/reconai.git
cd reconai

# Copy environment file
copy .env.example .env

# (Optional) Add your OpenAI API key to .env:
# OPENAI_API_KEY=sk-...
```

### 2. Install backend dependencies

```bash
pip install fastapi "uvicorn[standard]" pandas openai sqlalchemy python-dotenv python-multipart pydantic aiofiles
```

### 3. Generate synthetic data

```bash
python generate_data.py
```

### 4. Start the backend

```bash
uvicorn backend.main:app --reload --port 8000
```

### 5. Install frontend dependencies

```bash
cd frontend
npm install
```

### 6. Start the frontend

```bash
npm run dev
```

### 7. Open the app

Navigate to: **http://localhost:5173**

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | Optional | OpenAI API key. App works without it (rule-based fallback). |
| `OPENAI_MODEL` | Optional | Model to use (default: `gpt-4o-mini`) |
| `FRONTEND_URL` | Optional | Frontend URL for CORS (default: `http://localhost:5173`) |

---

## Demo Instructions

**One-click demo:**
1. Make sure backend is running on port 8000
2. Make sure frontend is running on port 5173
3. Open http://localhost:5173
4. Click **"Load Demo Dataset"**
5. Watch the dashboard populate with 200+ records

**Full showcase flow:**
1. Dashboard → note Match Rate (78-82%) and Exception Value
2. Exceptions → search "TXN1087"
3. Click TXN1087 → see MISSING_SETTLEMENT exception
4. Click "Run AI Analysis" → see AI explanation + confidence
5. Click "Mark as Reviewed" → see button update
6. Navigate to Audit Log → see timestamped entry
7. Navigate to AI Insights → see prioritized exception list

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/reconcile` | Run reconciliation |
| GET | `/api/metrics` | Get dashboard metrics |
| GET | `/api/records` | Get all records (paginated) |
| GET | `/api/exceptions` | Get exceptions (with filters) |
| GET | `/api/exceptions/{id}` | Get exception detail |
| POST | `/api/exceptions/{id}/analyze` | Trigger AI analysis |
| POST | `/api/exceptions/{id}/action` | Mark reviewed/resolved/escalated |
| GET | `/api/audit` | Get audit log |
| GET | `/api/data/download/{dataset}` | Download CSV |

Full API docs at: http://localhost:8000/docs

---

## Future Improvements

- [ ] CSV file upload for real data
- [ ] Multi-run comparison view
- [ ] Email alerts for high-priority exceptions
- [ ] Bulk AI analysis with progress tracking
- [ ] Export exceptions to PDF/Excel
- [ ] Role-based access control
- [ ] Webhook integrations with payment gateways

---

## Screenshots

*Dashboard with live metrics and charts*
*Exception detail with AI analysis*
*Full audit trail*

---

## Git Setup

```bash
git init
git add .
git commit -m "feat: ReconAI — AI Finance Controller (hackathon prototype)"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/reconai.git
git push -u origin main
```

---

## Deployment

**Quick deploy options:**

- **Backend (Railway/Render):** Set `PORT=8000`, add `OPENAI_API_KEY`
- **Frontend (Vercel/Netlify):** Set `VITE_API_URL=https://your-backend.railway.app`
- **Docker:** Add a `docker-compose.yml` for containerized deployment

---

## Team

Built for the AI Finance Controller hackathon track.

---

*This project uses synthetic data only. Not for production financial use.*
