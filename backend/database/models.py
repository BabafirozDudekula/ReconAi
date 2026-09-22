"""
SQLAlchemy ORM models for ReconAI.
"""
from datetime import datetime
from sqlalchemy import Column, String, Float, Integer, DateTime, Text, Boolean
from backend.database.db import Base


class ReconciliationRun(Base):
    __tablename__ = "reconciliation_runs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(String, unique=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    total_gateway = Column(Integer, default=0)
    total_settlements = Column(Integer, default=0)
    total_invoices = Column(Integer, default=0)
    total_records = Column(Integer, default=0)
    matched_count = Column(Integer, default=0)
    exception_count = Column(Integer, default=0)
    match_rate = Column(Float, default=0.0)
    total_value = Column(Float, default=0.0)
    exception_value = Column(Float, default=0.0)
    resolved_value = Column(Float, default=0.0)
    status = Column(String, default="COMPLETED")
    ai_summary = Column(Text, nullable=True)


class ReconciliationRecord(Base):
    __tablename__ = "reconciliation_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(String, index=True)
    transaction_id = Column(String, index=True)
    customer_id = Column(String, nullable=True)
    invoice_id = Column(String, nullable=True)
    transaction_date = Column(String, nullable=True)
    gateway_amount = Column(Float, nullable=True)
    settled_amount = Column(Float, nullable=True)
    invoice_amount = Column(Float, nullable=True)
    payment_status = Column(String, nullable=True)
    payment_method = Column(String, nullable=True)
    settlement_status = Column(String, nullable=True)
    settlement_date = Column(String, nullable=True)
    invoice_status = Column(String, nullable=True)
    recon_status = Column(String, default="UNRESOLVED")   # MATCHED / exception type
    match_reason = Column(Text, nullable=True)
    is_exception = Column(Boolean, default=False)
    is_reviewed = Column(Boolean, default=False)
    is_resolved = Column(Boolean, default=False)
    ai_explanation = Column(Text, nullable=True)
    ai_likely_cause = Column(Text, nullable=True)
    ai_confidence = Column(Float, nullable=True)
    ai_recommendation = Column(Text, nullable=True)
    ai_priority = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    # ── Action tracking (added via safe migration in db.py) ──────────
    action_status = Column(String, default="OPEN", nullable=True)   # OPEN | REVIEWED | RESOLVED | ESCALATED
    action_actor = Column(String, nullable=True)
    action_reason = Column(Text, nullable=True)
    action_at = Column(DateTime, nullable=True)


class AuditLog(Base):
    __tablename__ = "audit_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    run_id = Column(String, nullable=True)
    transaction_id = Column(String, nullable=True, index=True)
    actor = Column(String, default="Admin")
    action = Column(String)
    previous_status = Column(String, nullable=True)
    new_status = Column(String, nullable=True)
    reason = Column(Text, nullable=True)
