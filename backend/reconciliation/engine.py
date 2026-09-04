"""
Deterministic reconciliation engine for ReconAI.

Matching priority:
  1. Exact transaction_id match across gateway + settlement
  2. Classify exceptions by type using business rules
  3. Never use LLM for basic matching — deterministic only

Exception types produced:
  MATCHED
  AMOUNT_MISMATCH
  MISSING_SETTLEMENT
  MISSING_TRANSACTION
  DUPLICATE
  INVOICE_MISMATCH
  DATE_MISMATCH
  PAYMENT_FAILED
  REFUND
  SETTLEMENT_PENDING
  UNRESOLVED
"""

import os
import pandas as pd
from typing import Dict, List, Tuple
from datetime import datetime

# Settlement date lag threshold (days) — beyond this = DATE_MISMATCH
DATE_LAG_THRESHOLD = 7


def load_demo_data() -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Load the synthetic CSV datasets bundled with the project."""
    base = os.path.join(os.path.dirname(__file__), "..", "..", "data")
    base = os.path.abspath(base)

    gw = pd.read_csv(os.path.join(base, "payment_gateway.csv"), dtype=str)
    bs = pd.read_csv(os.path.join(base, "bank_settlements.csv"), dtype=str)
    inv = pd.read_csv(os.path.join(base, "invoices.csv"), dtype=str)

    return gw, bs, inv


def _safe_float(val) -> float | None:
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


def _parse_date(val) -> datetime | None:
    if pd.isna(val) or str(val).strip() == "":
        return None
    try:
        return pd.to_datetime(val).to_pydatetime()
    except Exception:
        return None


def run_reconciliation(
    gw_df: pd.DataFrame,
    bs_df: pd.DataFrame,
    inv_df: pd.DataFrame,
) -> List[Dict]:
    """
    Core deterministic reconciliation logic.
    Returns a list of record dicts ready for DB insertion.
    """
    records = []

    # ── Pre-process ────────────────────────────────────────────────
    # Index settlements and invoices by transaction_id / invoice_id
    bs_index: Dict[str, dict] = {}
    for _, row in bs_df.iterrows():
        txn_id = str(row.get("transaction_id", "")).strip()
        if txn_id:
            bs_index[txn_id] = row.to_dict()

    inv_index: Dict[str, dict] = {}
    for _, row in inv_df.iterrows():
        inv_id = str(row.get("invoice_id", "")).strip()
        if inv_id:
            inv_index[inv_id] = row.to_dict()

    # Track seen gateway_references to detect duplicates
    seen_gw_refs: Dict[str, str] = {}  # gw_ref -> first txn_id
    gw_txn_ids = set(str(r).strip() for r in gw_df["transaction_id"])

    # ── Detect duplicate gateway references ────────────────────────
    dup_gw_refs = set()
    for _, row in gw_df.iterrows():
        gw_ref = str(row.get("gateway_reference", "")).strip()
        txn_id = str(row.get("transaction_id", "")).strip()
        if gw_ref in seen_gw_refs and seen_gw_refs[gw_ref] != txn_id:
            dup_gw_refs.add(gw_ref)
        else:
            seen_gw_refs[gw_ref] = txn_id

    # ── Process each gateway record ────────────────────────────────
    processed_settlements = set()

    for _, gw_row in gw_df.iterrows():
        txn_id = str(gw_row.get("transaction_id", "")).strip()
        customer_id = str(gw_row.get("customer_id", "")).strip()
        invoice_id = str(gw_row.get("invoice_id", "")).strip()
        txn_date_str = str(gw_row.get("transaction_date", "")).strip()
        gateway_amount = _safe_float(gw_row.get("amount"))
        payment_status = str(gw_row.get("payment_status", "")).strip().upper()
        payment_method = str(gw_row.get("payment_method", "")).strip()
        gw_ref = str(gw_row.get("gateway_reference", "")).strip()

        # Base record dict
        rec = {
            "transaction_id": txn_id,
            "customer_id": customer_id,
            "invoice_id": invoice_id,
            "transaction_date": txn_date_str,
            "gateway_amount": gateway_amount,
            "settled_amount": None,
            "invoice_amount": None,
            "payment_status": payment_status,
            "payment_method": payment_method,
            "settlement_status": None,
            "settlement_date": None,
            "invoice_status": None,
            "recon_status": "UNRESOLVED",
            "match_reason": None,
            "is_exception": True,
        }

        # Fetch invoice data
        invoice = inv_index.get(invoice_id, {})
        invoice_amount = _safe_float(invoice.get("invoice_amount"))
        invoice_status = str(invoice.get("invoice_status", "")).strip().upper()
        rec["invoice_amount"] = invoice_amount
        rec["invoice_status"] = invoice_status if invoice_status else None

        # ── Rule 1: Duplicate detection ─────────────────────────────
        if gw_ref in dup_gw_refs:
            rec["recon_status"] = "DUPLICATE"
            rec["match_reason"] = (
                f"Gateway reference {gw_ref} appears on multiple transactions — "
                f"possible duplicate submission."
            )
            records.append(rec)
            continue

        # ── Rule 2: Failed payment ───────────────────────────────────
        if payment_status == "FAILED":
            rec["recon_status"] = "PAYMENT_FAILED"
            rec["match_reason"] = (
                f"Payment gateway recorded status FAILED for {txn_id}. "
                f"No settlement expected."
            )
            records.append(rec)
            continue

        # ── Rule 3: Refunded transaction ────────────────────────────
        if payment_status == "REFUNDED":
            settlement = bs_index.get(txn_id, {})
            settled_amount = _safe_float(settlement.get("settled_amount"))
            rec["settled_amount"] = settled_amount
            rec["settlement_status"] = str(settlement.get("settlement_status", "")).upper()
            rec["settlement_date"] = str(settlement.get("settlement_date", "")).strip() or None
            rec["recon_status"] = "REFUND"
            rec["match_reason"] = (
                f"Transaction {txn_id} was refunded. "
                f"Negative settlement of {settled_amount} recorded."
            )
            records.append(rec)
            continue

        # ── Rule 4: Look up bank settlement by transaction_id ────────
        settlement = bs_index.get(txn_id, {})

        if not settlement:
            # No settlement found at all
            rec["recon_status"] = "MISSING_SETTLEMENT"
            rec["match_reason"] = (
                f"No bank settlement record found for transaction {txn_id} "
                f"(gateway shows {payment_status})."
            )
            records.append(rec)
            continue

        processed_settlements.add(txn_id)
        settled_amount = _safe_float(settlement.get("settled_amount"))
        settlement_status = str(settlement.get("settlement_status", "")).strip().upper()
        settlement_date_str = str(settlement.get("settlement_date", "")).strip()

        rec["settled_amount"] = settled_amount
        rec["settlement_status"] = settlement_status
        rec["settlement_date"] = settlement_date_str if settlement_date_str else None

        # ── Rule 5: Settlement pending ──────────────────────────────
        if settlement_status == "PENDING":
            rec["recon_status"] = "SETTLEMENT_PENDING"
            rec["match_reason"] = (
                f"Bank settlement for {txn_id} is in PENDING status. "
                f"Awaiting bank confirmation."
            )
            records.append(rec)
            continue

        # ── Rule 6: Amount mismatch (gateway vs bank) ───────────────
        if gateway_amount is not None and settled_amount is not None:
            if abs(gateway_amount - settled_amount) > 1.0:  # allow ₹1 rounding
                rec["recon_status"] = "AMOUNT_MISMATCH"
                rec["match_reason"] = (
                    f"Gateway recorded ₹{gateway_amount:,.0f} but bank settled "
                    f"₹{settled_amount:,.0f} — difference of ₹{abs(gateway_amount - settled_amount):,.0f}."
                )
                records.append(rec)
                continue

        # ── Rule 7: Date mismatch (settlement too late) ─────────────
        txn_date = _parse_date(txn_date_str)
        settlement_date = _parse_date(settlement_date_str)

        if txn_date and settlement_date:
            lag_days = (settlement_date - txn_date).days
            if lag_days > DATE_LAG_THRESHOLD:
                rec["recon_status"] = "DATE_MISMATCH"
                rec["match_reason"] = (
                    f"Settlement received {lag_days} days after transaction date "
                    f"(threshold: {DATE_LAG_THRESHOLD} days). "
                    f"Possible delayed processing."
                )
                records.append(rec)
                continue

        # ── Rule 8: Invoice amount mismatch ─────────────────────────
        if invoice_amount is not None and gateway_amount is not None:
            if abs(invoice_amount - gateway_amount) > 1.0:
                rec["recon_status"] = "INVOICE_MISMATCH"
                rec["match_reason"] = (
                    f"Invoice amount ₹{invoice_amount:,.0f} does not match "
                    f"gateway amount ₹{gateway_amount:,.0f} — "
                    f"difference of ₹{abs(invoice_amount - gateway_amount):,.0f}."
                )
                records.append(rec)
                continue

        # ── Rule 9: Full match ───────────────────────────────────────
        rec["recon_status"] = "MATCHED"
        rec["is_exception"] = False
        rec["match_reason"] = (
            f"Matched using transaction_id {txn_id}. "
            f"Gateway ₹{gateway_amount:,.0f} = Bank ₹{settled_amount:,.0f}."
        )
        records.append(rec)

    # ── Process settlement records with no gateway match ─────────
    for txn_id, settlement in bs_index.items():
        if txn_id in processed_settlements:
            continue
        if txn_id in gw_txn_ids:
            continue  # gateway record exists, already handled above

        settled_amount = _safe_float(settlement.get("settled_amount"))
        settlement_status = str(settlement.get("settlement_status", "")).strip().upper()

        records.append({
            "transaction_id": txn_id,
            "customer_id": None,
            "invoice_id": None,
            "transaction_date": None,
            "gateway_amount": None,
            "settled_amount": settled_amount,
            "invoice_amount": None,
            "payment_status": None,
            "payment_method": None,
            "settlement_status": settlement_status,
            "settlement_date": str(settlement.get("settlement_date", "")).strip() or None,
            "invoice_status": None,
            "recon_status": "MISSING_TRANSACTION",
            "match_reason": (
                f"Bank settlement {txn_id} found with no corresponding "
                f"gateway transaction record."
            ),
            "is_exception": True,
        })

    return records


def calculate_metrics(records: List[Dict]) -> Dict:
    """Compute dashboard metrics from reconciliation results."""
    total = len(records)
    matched = sum(1 for r in records if r["recon_status"] == "MATCHED")
    exceptions = total - matched

    # Values
    total_value = sum(
        (r.get("gateway_amount") or 0) for r in records
        if r.get("gateway_amount") is not None
    )
    exception_value = sum(
        (r.get("gateway_amount") or 0) for r in records
        if r["recon_status"] != "MATCHED" and r.get("gateway_amount") is not None
    )
    resolved_value = sum(
        (r.get("gateway_amount") or 0) for r in records
        if r.get("is_resolved") and r.get("gateway_amount") is not None
    )

    match_rate = round((matched / total * 100), 2) if total > 0 else 0.0

    # Exception distribution
    dist: Dict[str, Dict] = {}
    for r in records:
        status = r["recon_status"]
        if status == "MATCHED":
            continue
        if status not in dist:
            dist[status] = {"count": 0, "value": 0.0}
        dist[status]["count"] += 1
        dist[status]["value"] += r.get("gateway_amount") or 0

    exception_distribution = [
        {"status": k, "count": v["count"], "value": round(v["value"], 2)}
        for k, v in sorted(dist.items(), key=lambda x: -x[1]["count"])
    ]

    return {
        "total_records": total,
        "matched_count": matched,
        "exception_count": exceptions,
        "match_rate": match_rate,
        "total_value": round(total_value, 2),
        "exception_value": round(exception_value, 2),
        "resolved_value": round(resolved_value, 2),
        "exception_distribution": exception_distribution,
    }
