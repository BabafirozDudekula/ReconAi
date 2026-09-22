"""
ReconAI — AI Finance Controller
FastAPI backend entrypoint.

Run with: uvicorn backend.main:app --reload --port 8000
"""

import os
import logging
from datetime import datetime
from typing import Optional, List
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException, Query, UploadFile, File
import tempfile, shutil, io
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

load_dotenv()

from backend.database.db import get_db, init_db
from backend.database.models import (
    ReconciliationRecord,
    ReconciliationRun,
    AuditLog,
)
from backend.models.schemas import (
    ReconcileRequest,
    ExceptionActionRequest,
    ReconciliationMetrics,
    ExceptionDistribution,
    ReconciliationRecordSchema,
    AuditLogSchema,
    ExceptionListResponse,
    AuditLogResponse,
    AIAnalysisResult,
    ExceptionSummary,
)
from backend.services.reconciliation_service import (
    run_demo_reconciliation,
    get_latest_run_id,
)
from backend.ai.analyzer import analyze_exception, EXCEPTION_PRIORITY

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── App lifespan ─────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    logger.info("ReconAI backend started. Database initialized.")
    yield

app = FastAPI(
    title="ReconAI — AI Finance Controller",
    description="Automated reconciliation engine with AI exception analysis.",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ─────────────────────────────────────────────────────────
frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_url, "http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ════════════════════════════════════════════════════════════════
# HEALTH
# ════════════════════════════════════════════════════════════════

@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "service": "ReconAI Backend",
        "timestamp": datetime.utcnow().isoformat(),
        "ai_enabled": bool(os.environ.get("OPENAI_API_KEY", "").strip()),
    }


# ════════════════════════════════════════════════════════════════
# RECONCILIATION
# ════════════════════════════════════════════════════════════════

@app.post("/api/reconcile")
def reconcile(req: ReconcileRequest, db: Session = Depends(get_db)):
    """Run reconciliation. demo_mode=true uses bundled synthetic data."""
    if not req.demo_mode:
        raise HTTPException(
            status_code=400,
            detail="Only demo_mode is supported in this prototype. Set demo_mode=true.",
        )
    try:
        run_id = run_demo_reconciliation(db, run_id=req.run_id)
        return {"status": "completed", "run_id": run_id}
    except Exception as e:
        logger.error(f"Reconciliation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Reconciliation failed: {str(e)}")


# ── Required CSV columns ──────────────────────────────────────────
REQUIRED_COLUMNS = {
    "gateway": {"transaction_id", "customer_id", "invoice_id",
                "transaction_date", "amount", "payment_status",
                "payment_method", "gateway_reference"},
    "settlements": {"settlement_id", "transaction_id", "settlement_date",
                    "settled_amount", "settlement_status", "bank_reference"},
    "invoices": {"invoice_id", "customer_id", "invoice_amount",
                 "invoice_date", "invoice_status"},
}


@app.post("/api/upload")
async def upload_and_reconcile(
    gateway_file: UploadFile = File(..., description="Payment gateway CSV"),
    settlements_file: UploadFile = File(..., description="Bank settlements CSV"),
    invoices_file: UploadFile = File(..., description="Invoices CSV"),
    db: Session = Depends(get_db),
):
    """
    Accept three CSV files from the user, validate their columns,
    run reconciliation, and return the run_id.
    """
    import pandas as pd

    uploads = {
        "gateway": gateway_file,
        "settlements": settlements_file,
        "invoices": invoices_file,
    }
    dataframes = {}
    errors = []

    for name, upload in uploads.items():
        # Validate file type
        if not (upload.filename or "").lower().endswith(".csv"):
            errors.append(f"{name}: file must be a .csv (got '{upload.filename}')")
            continue

        # Read content
        try:
            content = await upload.read()
            df = pd.read_csv(io.BytesIO(content), dtype=str)
        except Exception as e:
            errors.append(f"{name}: could not parse CSV — {e}")
            continue

        if df.empty:
            errors.append(f"{name}: file is empty")
            continue

        # Normalise column names (lowercase, strip whitespace)
        df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

        # Check required columns
        missing = REQUIRED_COLUMNS[name] - set(df.columns)
        if missing:
            errors.append(
                f"{name}: missing required columns: {sorted(missing)}"
            )
            continue

        dataframes[name] = df
        logger.info(f"Uploaded {name}: {len(df)} rows, columns={list(df.columns)}")

    if errors:
        raise HTTPException(
            status_code=422,
            detail={
                "message": "CSV validation failed. Fix the issues below and re-upload.",
                "errors": errors,
            },
        )

    # Run reconciliation on uploaded data
    try:
        from backend.reconciliation.engine import run_reconciliation, calculate_metrics
        from backend.ai.analyzer import generate_ai_summary, EXCEPTION_PRIORITY
        from backend.services.reconciliation_service import (
            run_demo_reconciliation as _run_demo,
        )
        import uuid

        run_id = f"RUN-{uuid.uuid4().hex[:8].upper()}"

        gw_df = dataframes["gateway"]
        bs_df = dataframes["settlements"]
        inv_df = dataframes["invoices"]

        records = run_reconciliation(gw_df, bs_df, inv_df)
        metrics = calculate_metrics(records)

        exceptions = [r for r in records if r["recon_status"] != "MATCHED"]
        priority_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
        exceptions_sorted = sorted(
            exceptions,
            key=lambda r: priority_order.get(
                EXCEPTION_PRIORITY.get(r["recon_status"], "MEDIUM"), 2
            ),
        )
        ai_summary = generate_ai_summary(metrics, exceptions_sorted[:3])

        # Persist
        from backend.database.models import ReconciliationRun, ReconciliationRecord, AuditLog
        run_record = ReconciliationRun(
            run_id=run_id,
            created_at=datetime.utcnow(),
            total_gateway=len(gw_df),
            total_settlements=len(bs_df),
            total_invoices=len(inv_df),
            total_records=metrics["total_records"],
            matched_count=metrics["matched_count"],
            exception_count=metrics["exception_count"],
            match_rate=metrics["match_rate"],
            total_value=metrics["total_value"],
            exception_value=metrics["exception_value"],
            resolved_value=0.0,
            status="COMPLETED",
            ai_summary=ai_summary,
        )
        db.add(run_record)

        for rec in records:
            db.add(ReconciliationRecord(
                run_id=run_id,
                transaction_id=rec["transaction_id"],
                customer_id=rec.get("customer_id"),
                invoice_id=rec.get("invoice_id"),
                transaction_date=rec.get("transaction_date"),
                gateway_amount=rec.get("gateway_amount"),
                settled_amount=rec.get("settled_amount"),
                invoice_amount=rec.get("invoice_amount"),
                payment_status=rec.get("payment_status"),
                payment_method=rec.get("payment_method"),
                settlement_status=rec.get("settlement_status"),
                settlement_date=rec.get("settlement_date"),
                invoice_status=rec.get("invoice_status"),
                recon_status=rec["recon_status"],
                match_reason=rec.get("match_reason"),
                is_exception=rec.get("is_exception", False),
                is_reviewed=False,
                is_resolved=False,
            ))

        db.add(AuditLog(
            timestamp=datetime.utcnow(),
            run_id=run_id,
            transaction_id=None,
            actor="User",
            action="RECONCILIATION_RUN",
            previous_status=None,
            new_status="COMPLETED",
            reason=(
                f"User-uploaded reconciliation completed. "
                f"Gateway: {len(gw_df)} rows, Settlements: {len(bs_df)} rows, "
                f"Invoices: {len(inv_df)} rows. "
                f"{metrics['matched_count']} matched, {metrics['exception_count']} exceptions. "
                f"Match rate: {metrics['match_rate']}%."
            ),
        ))
        db.commit()

        return {
            "status": "completed",
            "run_id": run_id,
            "metrics": {
                "total_records": metrics["total_records"],
                "matched_count": metrics["matched_count"],
                "exception_count": metrics["exception_count"],
                "match_rate": metrics["match_rate"],
            },
        }

    except Exception as e:
        logger.error(f"Upload reconciliation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Reconciliation failed: {str(e)}")


@app.get("/api/upload/schema")
def get_upload_schema():
    """Return required column schemas for each CSV file — used by the upload UI."""
    return {
        "gateway": {
            "filename_hint": "payment_gateway.csv",
            "required_columns": sorted(REQUIRED_COLUMNS["gateway"]),
            "example_row": {
                "transaction_id": "TXN1001",
                "customer_id": "CUST001",
                "invoice_id": "INV1001",
                "transaction_date": "2026-08-01",
                "amount": "2500",
                "payment_status": "SUCCESS",
                "payment_method": "UPI",
                "gateway_reference": "GW1001",
            },
        },
        "settlements": {
            "filename_hint": "bank_settlements.csv",
            "required_columns": sorted(REQUIRED_COLUMNS["settlements"]),
            "example_row": {
                "settlement_id": "SET1001",
                "transaction_id": "TXN1001",
                "settlement_date": "2026-08-02",
                "settled_amount": "2500",
                "settlement_status": "SETTLED",
                "bank_reference": "BNK1001",
            },
        },
        "invoices": {
            "filename_hint": "invoices.csv",
            "required_columns": sorted(REQUIRED_COLUMNS["invoices"]),
            "example_row": {
                "invoice_id": "INV1001",
                "customer_id": "CUST001",
                "invoice_amount": "2500",
                "invoice_date": "2026-07-30",
                "invoice_status": "PAID",
            },
        },
    }


@app.get("/api/metrics", response_model=ReconciliationMetrics)
def get_metrics(run_id: Optional[str] = None, db: Session = Depends(get_db)):
    """Get dashboard metrics for a reconciliation run."""
    if not run_id:
        run_id = get_latest_run_id(db)
    if not run_id:
        raise HTTPException(status_code=404, detail="No reconciliation runs found. Run demo first.")

    run = db.query(ReconciliationRun).filter(ReconciliationRun.run_id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found.")

    # Build exception distribution dynamically
    records = db.query(ReconciliationRecord).filter(
        ReconciliationRecord.run_id == run_id,
        ReconciliationRecord.recon_status != "MATCHED",
    ).all()

    dist_map = {}
    for r in records:
        status = r.recon_status
        if status not in dist_map:
            dist_map[status] = {"count": 0, "value": 0.0}
        dist_map[status]["count"] += 1
        dist_map[status]["value"] += r.gateway_amount or 0

    distribution = [
        ExceptionDistribution(status=k, count=v["count"], value=round(v["value"], 2))
        for k, v in sorted(dist_map.items(), key=lambda x: -x[1]["count"])
    ]

    # Recalculate resolved value
    resolved_value = sum(
        r.gateway_amount or 0
        for r in db.query(ReconciliationRecord).filter(
            ReconciliationRecord.run_id == run_id,
            ReconciliationRecord.is_resolved == True,
        ).all()
    )

    return ReconciliationMetrics(
        run_id=run.run_id,
        total_gateway=run.total_gateway,
        total_settlements=run.total_settlements,
        total_invoices=run.total_invoices,
        total_records=run.total_records,
        matched_count=run.matched_count,
        exception_count=run.exception_count,
        match_rate=run.match_rate,
        total_value=run.total_value,
        exception_value=run.exception_value,
        resolved_value=round(resolved_value, 2),
        exception_distribution=distribution,
        created_at=run.created_at,
        ai_summary=run.ai_summary,
    )


# ════════════════════════════════════════════════════════════════
# RECORDS & EXCEPTIONS
# ════════════════════════════════════════════════════════════════

@app.get("/api/records", response_model=ExceptionListResponse)
def get_records(
    run_id: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Get all reconciliation records with optional filtering."""
    if not run_id:
        run_id = get_latest_run_id(db)
    if not run_id:
        return ExceptionListResponse(total=0, items=[])

    query = db.query(ReconciliationRecord).filter(
        ReconciliationRecord.run_id == run_id
    )

    if status and status != "ALL":
        query = query.filter(ReconciliationRecord.recon_status == status)

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (ReconciliationRecord.transaction_id.ilike(search_term))
            | (ReconciliationRecord.customer_id.ilike(search_term))
            | (ReconciliationRecord.invoice_id.ilike(search_term))
        )

    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()

    return ExceptionListResponse(total=total, items=[ReconciliationRecordSchema.model_validate(r) for r in items])


@app.get("/api/exceptions/summary", response_model=ExceptionSummary)
def get_exception_summary(run_id: Optional[str] = None, db: Session = Depends(get_db)):
    """Return action-status breakdown counts for exceptions.
    When run_id is provided, scopes to that run.
    When run_id is omitted (Action Center default), counts across ALL runs.
    """
    base = db.query(ReconciliationRecord).filter(
        ReconciliationRecord.recon_status != "MATCHED",
    )
    if run_id:
        base = base.filter(ReconciliationRecord.run_id == run_id)

    total = base.count()
    if total == 0:
        return ExceptionSummary(total_exceptions=0, open=0, reviewed=0, resolved=0, escalated=0)

    def _count(action_val: str) -> int:
        return base.filter(ReconciliationRecord.action_status == action_val).count()

    # Records that have no action_status yet default to OPEN
    open_count = base.filter(
        (ReconciliationRecord.action_status == "OPEN")
        | (ReconciliationRecord.action_status == None)  # noqa: E711
    ).count()

    return ExceptionSummary(
        total_exceptions=total,
        open=open_count,
        reviewed=_count("REVIEWED"),
        resolved=_count("RESOLVED"),
        escalated=_count("ESCALATED"),
    )


@app.get("/api/exceptions", response_model=ExceptionListResponse)
def get_exceptions(
    run_id: Optional[str] = None,
    status: Optional[str] = None,
    action_status: Optional[str] = None,
    priority: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Get exception records only (non-MATCHED) with optional filtering.
    When run_id is omitted, returns exceptions across ALL runs (for Action Center).
    When run_id is provided, scopes to that run only.
    """
    query = db.query(ReconciliationRecord).filter(
        ReconciliationRecord.recon_status != "MATCHED",
    )
    if run_id:
        query = query.filter(ReconciliationRecord.run_id == run_id)

    if status and status != "ALL":
        query = query.filter(ReconciliationRecord.recon_status == status)

    if action_status and action_status != "ALL":
        if action_status == "OPEN":
            # treat NULL action_status as OPEN for backward compatibility
            query = query.filter(
                (ReconciliationRecord.action_status == "OPEN")
                | (ReconciliationRecord.action_status == None)  # noqa: E711
            )
        else:
            query = query.filter(ReconciliationRecord.action_status == action_status)

    if priority and priority != "ALL":
        query = query.filter(ReconciliationRecord.ai_priority == priority)

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (ReconciliationRecord.transaction_id.ilike(search_term))
            | (ReconciliationRecord.customer_id.ilike(search_term))
            | (ReconciliationRecord.invoice_id.ilike(search_term))
        )

    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()

    return ExceptionListResponse(total=total, items=[ReconciliationRecordSchema.model_validate(r) for r in items])


@app.get("/api/exceptions/{record_id}", response_model=ReconciliationRecordSchema)
def get_exception_detail(record_id: int, db: Session = Depends(get_db)):
    """Get full detail for a single exception record."""
    record = db.query(ReconciliationRecord).filter(
        ReconciliationRecord.id == record_id
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found.")
    return ReconciliationRecordSchema.model_validate(record)


@app.post("/api/exceptions/{record_id}/analyze", response_model=AIAnalysisResult)
def analyze_exception_record(record_id: int, db: Session = Depends(get_db)):
    """Trigger AI analysis for an exception."""
    record = db.query(ReconciliationRecord).filter(
        ReconciliationRecord.id == record_id
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found.")

    record_dict = {
        "transaction_id": record.transaction_id,
        "recon_status": record.recon_status,
        "customer_id": record.customer_id,
        "invoice_id": record.invoice_id,
        "transaction_date": record.transaction_date,
        "payment_status": record.payment_status,
        "payment_method": record.payment_method,
        "gateway_amount": record.gateway_amount,
        "settled_amount": record.settled_amount,
        "settlement_status": record.settlement_status,
        "settlement_date": record.settlement_date,
        "invoice_amount": record.invoice_amount,
        "invoice_status": record.invoice_status,
        "match_reason": record.match_reason,
    }

    analysis = analyze_exception(record_dict)

    # Persist AI results
    record.ai_explanation = analysis["explanation"]
    record.ai_likely_cause = analysis["likely_cause"]
    record.ai_confidence = analysis["confidence"]
    record.ai_recommendation = analysis["recommendation"]
    record.ai_priority = analysis["priority"]
    record.updated_at = datetime.utcnow()
    db.commit()

    # Audit log
    db.add(AuditLog(
        timestamp=datetime.utcnow(),
        run_id=record.run_id,
        transaction_id=record.transaction_id,
        actor="System",
        action="AI_ANALYSIS",
        previous_status=record.recon_status,
        new_status=record.recon_status,
        reason=f"AI analysis completed via {analysis.get('source', 'ai')}. "
               f"Priority: {analysis['priority']}. Confidence: {analysis['confidence']:.0%}.",
    ))
    db.commit()

    return AIAnalysisResult(
        transaction_id=record.transaction_id,
        exception_type=record.recon_status,
        explanation=analysis["explanation"],
        likely_cause=analysis["likely_cause"],
        confidence=analysis["confidence"],
        recommendation=analysis["recommendation"],
        priority=analysis["priority"],
    )


@app.post("/api/exceptions/{record_id}/action")
def take_exception_action(
    record_id: int,
    req: ExceptionActionRequest,
    db: Session = Depends(get_db),
):
    """Mark an exception as reviewed, resolved, or escalated."""
    record = db.query(ReconciliationRecord).filter(
        ReconciliationRecord.id == record_id
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found.")

    previous_action_status = record.action_status or "OPEN"
    previous_recon_status = record.recon_status
    action = req.action  # already validated + lowercased by schema

    # Map action → action_status and keep boolean flags in sync
    if action == "reviewed":
        record.is_reviewed = True
        record.action_status = "REVIEWED"
        new_status = f"{record.recon_status} (Reviewed)"
    elif action == "resolved":
        record.is_reviewed = True
        record.is_resolved = True
        record.action_status = "RESOLVED"
        new_status = f"{record.recon_status} (Resolved)"
    elif action == "escalated":
        record.action_status = "ESCALATED"
        new_status = f"{record.recon_status} (Escalated)"
    else:
        # Guarded by schema validator — should not reach here
        raise HTTPException(status_code=400, detail=f"Unknown action: {req.action}")

    record.action_actor = req.actor
    record.action_reason = req.reason or f"Exception {action} by {req.actor}."
    record.action_at = datetime.utcnow()
    record.updated_at = datetime.utcnow()

    # Audit log
    db.add(AuditLog(
        timestamp=datetime.utcnow(),
        run_id=record.run_id,
        transaction_id=record.transaction_id,
        actor=req.actor,
        action=action.upper(),
        previous_status=previous_action_status,
        new_status=record.action_status,
        reason=record.action_reason,
    ))

    db.commit()
    return {
        "status": "ok",
        "action": action,
        "action_status": record.action_status,
        "transaction_id": record.transaction_id,
    }


# ════════════════════════════════════════════════════════════════
# AUDIT LOG
# ════════════════════════════════════════════════════════════════

@app.get("/api/audit", response_model=AuditLogResponse)
def get_audit_log(
    run_id: Optional[str] = None,
    transaction_id: Optional[str] = None,
    action: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Get paginated audit log entries with optional filters."""
    query = db.query(AuditLog).order_by(AuditLog.timestamp.desc())

    if run_id:
        query = query.filter(AuditLog.run_id == run_id)
    if transaction_id:
        query = query.filter(AuditLog.transaction_id == transaction_id)
    if action and action != "ALL":
        query = query.filter(AuditLog.action == action.upper())

    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()

    return AuditLogResponse(
        total=total,
        items=[AuditLogSchema.model_validate(item) for item in items],
    )


# ════════════════════════════════════════════════════════════════
# DATA DOWNLOADS
# ════════════════════════════════════════════════════════════════

@app.get("/api/data/download/{dataset}")
def download_dataset(dataset: str):
    """Download a sample CSV dataset."""
    allowed = {"payment_gateway", "bank_settlements", "invoices"}
    if dataset not in allowed:
        raise HTTPException(status_code=404, detail="Dataset not found.")

    base = os.path.join(os.path.dirname(__file__), "..", "data")
    path = os.path.abspath(os.path.join(base, f"{dataset}.csv"))

    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found on server.")

    return FileResponse(
        path,
        media_type="text/csv",
        filename=f"{dataset}.csv",
    )


@app.get("/api/runs")
def get_runs(db: Session = Depends(get_db)):
    """List all reconciliation runs."""
    runs = db.query(ReconciliationRun).order_by(ReconciliationRun.created_at.desc()).limit(10).all()
    return [
        {
            "run_id": r.run_id,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "total_records": r.total_records,
            "matched_count": r.matched_count,
            "exception_count": r.exception_count,
            "match_rate": r.match_rate,
            "status": r.status,
        }
        for r in runs
    ]
