"""
Pydantic schemas for ReconAI API request/response models.
"""
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime


# ── Input schemas ────────────────────────────────────────────────

class ReconcileRequest(BaseModel):
    demo_mode: bool = False
    run_id: Optional[str] = None


class ExceptionActionRequest(BaseModel):
    action: str          # "reviewed" | "resolved" | "escalated"
    reason: Optional[str] = None
    actor: str = "Admin"


# ── Output schemas ───────────────────────────────────────────────

class ExceptionDistribution(BaseModel):
    status: str
    count: int
    value: float


class ReconciliationMetrics(BaseModel):
    run_id: str
    total_gateway: int
    total_settlements: int
    total_invoices: int
    total_records: int
    matched_count: int
    exception_count: int
    match_rate: float
    total_value: float
    exception_value: float
    resolved_value: float
    exception_distribution: List[ExceptionDistribution]
    created_at: Optional[datetime] = None
    ai_summary: Optional[str] = None


class ReconciliationRecordSchema(BaseModel):
    id: int
    run_id: str
    transaction_id: str
    customer_id: Optional[str]
    invoice_id: Optional[str]
    transaction_date: Optional[str]
    gateway_amount: Optional[float]
    settled_amount: Optional[float]
    invoice_amount: Optional[float]
    payment_status: Optional[str]
    payment_method: Optional[str]
    settlement_status: Optional[str]
    settlement_date: Optional[str]
    invoice_status: Optional[str]
    recon_status: str
    match_reason: Optional[str]
    is_exception: bool
    is_reviewed: bool
    is_resolved: bool
    ai_explanation: Optional[str]
    ai_likely_cause: Optional[str]
    ai_confidence: Optional[float]
    ai_recommendation: Optional[str]
    ai_priority: Optional[str]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class AuditLogSchema(BaseModel):
    id: int
    timestamp: datetime
    run_id: Optional[str]
    transaction_id: Optional[str]
    actor: str
    action: str
    previous_status: Optional[str]
    new_status: Optional[str]
    reason: Optional[str]

    class Config:
        from_attributes = True


class AIAnalysisResult(BaseModel):
    transaction_id: str
    exception_type: str
    explanation: str
    likely_cause: str
    confidence: float
    recommendation: str
    priority: str  # LOW | MEDIUM | HIGH | CRITICAL


class ExceptionListResponse(BaseModel):
    total: int
    items: List[ReconciliationRecordSchema]


class AuditLogResponse(BaseModel):
    total: int
    items: List[AuditLogSchema]
