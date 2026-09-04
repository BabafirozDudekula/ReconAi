"""
Reconciliation orchestration service.
Ties together the engine, database writes, and AI summary generation.
"""

import uuid
import logging
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session

from backend.reconciliation.engine import (
    load_demo_data,
    run_reconciliation,
    calculate_metrics,
)
from backend.ai.analyzer import generate_ai_summary, EXCEPTION_PRIORITY
from backend.database.models import ReconciliationRun, ReconciliationRecord, AuditLog

logger = logging.getLogger(__name__)


def run_demo_reconciliation(db: Session, run_id: Optional[str] = None) -> str:
    """
    Execute full demo reconciliation pipeline:
    1. Load synthetic datasets
    2. Run deterministic engine
    3. Persist results to DB
    4. Generate AI summary
    5. Create audit log entry

    Returns the run_id.
    """
    run_id = run_id or f"RUN-{uuid.uuid4().hex[:8].upper()}"

    # Clear previous run if exists
    db.query(ReconciliationRecord).filter(
        ReconciliationRecord.run_id == run_id
    ).delete()
    db.query(ReconciliationRun).filter(
        ReconciliationRun.run_id == run_id
    ).delete()

    # Load data
    gw_df, bs_df, inv_df = load_demo_data()

    # Run engine
    records = run_reconciliation(gw_df, bs_df, inv_df)

    # Calculate metrics
    metrics = calculate_metrics(records)

    # Get top priority exceptions for AI summary
    exceptions = [r for r in records if r["recon_status"] != "MATCHED"]
    # Sort by priority (CRITICAL > HIGH > MEDIUM > LOW)
    priority_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
    exceptions_sorted = sorted(
        exceptions,
        key=lambda r: priority_order.get(
            EXCEPTION_PRIORITY.get(r["recon_status"], "MEDIUM"), 2
        ),
    )

    # Generate AI summary
    ai_summary = generate_ai_summary(metrics, exceptions_sorted[:3])

    # Persist run metadata
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

    # Persist individual records
    for rec in records:
        db_rec = ReconciliationRecord(
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
        )
        db.add(db_rec)

    # Audit log entry for the run
    db.add(AuditLog(
        timestamp=datetime.utcnow(),
        run_id=run_id,
        transaction_id=None,
        actor="System",
        action="RECONCILIATION_RUN",
        previous_status=None,
        new_status="COMPLETED",
        reason=f"Demo reconciliation completed. {metrics['matched_count']} matched, "
               f"{metrics['exception_count']} exceptions. Match rate: {metrics['match_rate']}%.",
    ))

    db.commit()
    logger.info(f"Reconciliation run {run_id} completed: {metrics}")
    return run_id


def get_latest_run_id(db: Session) -> Optional[str]:
    """Get the most recently created reconciliation run."""
    run = (
        db.query(ReconciliationRun)
        .order_by(ReconciliationRun.created_at.desc())
        .first()
    )
    return run.run_id if run else None
