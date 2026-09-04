"""
AI exception analyzer for ReconAI.

Uses OpenAI API to generate structured exception analysis.
Gracefully falls back if API is unavailable or key is missing.
"""

import os
import json
import logging
from typing import Optional, Dict
from openai import OpenAI, APIError, AuthenticationError

logger = logging.getLogger(__name__)

# Priority scoring for exception types
EXCEPTION_PRIORITY = {
    "MISSING_SETTLEMENT": "HIGH",
    "AMOUNT_MISMATCH": "MEDIUM",
    "MISSING_TRANSACTION": "HIGH",
    "DUPLICATE": "HIGH",
    "INVOICE_MISMATCH": "MEDIUM",
    "DATE_MISMATCH": "LOW",
    "PAYMENT_FAILED": "MEDIUM",
    "REFUND": "LOW",
    "SETTLEMENT_PENDING": "LOW",
    "UNRESOLVED": "CRITICAL",
}

# Rule-based fallback analysis when AI is unavailable
FALLBACK_ANALYSIS = {
    "MISSING_SETTLEMENT": {
        "explanation": "The payment gateway recorded a successful transaction, but no corresponding bank settlement record was found.",
        "likely_cause": "Possible causes include: settlement batch processing delay, banking system outage at time of settlement, or the transaction may have been filtered out during settlement reconciliation.",
        "confidence": 0.72,
        "recommendation": "Check the bank settlement batch files for the transaction date. If settlement is genuinely missing, raise a dispute with the payment processor within the SLA window.",
    },
    "AMOUNT_MISMATCH": {
        "explanation": "The amount recorded by the payment gateway differs from the amount settled by the bank.",
        "likely_cause": "Possible causes include: payment processing fees deducted by the bank, currency conversion rounding, or partial settlement due to chargeback.",
        "confidence": 0.85,
        "recommendation": "Compare the gateway settlement report with the bank statement. Confirm whether the difference represents a known processing fee or an unaccounted deduction.",
    },
    "MISSING_TRANSACTION": {
        "explanation": "A bank settlement record exists for this reference, but no corresponding payment gateway transaction was found.",
        "likely_cause": "Possible causes include: gateway record not captured due to timeout, data export issue, or the transaction originated from a different payment channel not included in this batch.",
        "confidence": 0.68,
        "recommendation": "Search the payment gateway portal directly for this bank reference number. Check if alternative data sources contain this transaction.",
    },
    "DUPLICATE": {
        "explanation": "Multiple gateway records share the same gateway reference number, indicating a possible duplicate transaction.",
        "likely_cause": "Possible causes include: double-click on payment button by customer, retry logic in the payment SDK, or a gateway processing error that submitted the same transaction twice.",
        "confidence": 0.90,
        "recommendation": "Verify with the payment gateway whether both charges were actually processed. If duplicate, initiate a refund for the second charge immediately.",
    },
    "INVOICE_MISMATCH": {
        "explanation": "The payment amount does not match the invoice amount on record.",
        "likely_cause": "Possible causes include: partial payment by customer, invoice updated after payment, or incorrect invoice linked to this transaction.",
        "confidence": 0.80,
        "recommendation": "Verify with accounts receivable whether a partial payment arrangement exists. If no arrangement, contact the customer and request the balance.",
    },
    "DATE_MISMATCH": {
        "explanation": "The bank settlement date is significantly later than the transaction date, exceeding the expected settlement window.",
        "likely_cause": "Possible causes include: bank processing delay, public holiday during settlement period, or the transaction was held for fraud review.",
        "confidence": 0.75,
        "recommendation": "Check if the settlement delay falls within the bank's stated SLA. If outside SLA, raise a formal query with the acquiring bank.",
    },
    "PAYMENT_FAILED": {
        "explanation": "The payment gateway recorded a FAILED status for this transaction. No settlement is expected.",
        "likely_cause": "Possible causes include: insufficient funds, card declined by issuing bank, OTP timeout, or network failure during payment processing.",
        "confidence": 0.95,
        "recommendation": "Notify the customer of the payment failure and provide a retry link. Update the invoice status to UNPAID if not already done.",
    },
    "REFUND": {
        "explanation": "This transaction has been refunded. The settlement shows a negative amount corresponding to the original payment.",
        "likely_cause": "Customer-initiated refund or merchant-initiated cancellation.",
        "confidence": 0.90,
        "recommendation": "Verify the refund was correctly processed and the customer has received confirmation. Update the invoice status to CANCELLED.",
    },
    "SETTLEMENT_PENDING": {
        "explanation": "The bank settlement for this transaction is in PENDING status, indicating it has not yet been fully processed.",
        "likely_cause": "Transaction is recent and settlement is within the normal 1–2 business day processing window.",
        "confidence": 0.82,
        "recommendation": "Monitor this settlement. If PENDING status persists beyond 3 business days, escalate to the bank.",
    },
    "UNRESOLVED": {
        "explanation": "This record could not be classified by the automated reconciliation rules.",
        "likely_cause": "Insufficient data or an edge case not covered by current reconciliation logic.",
        "confidence": 0.40,
        "recommendation": "Manual review required. Escalate to the finance team lead with all available source documents.",
    },
}


def _build_prompt(record: Dict) -> str:
    """Construct a structured prompt for exception analysis."""
    return f"""You are a senior finance reconciliation analyst. Analyze the following payment exception and provide a structured response.

EXCEPTION RECORD:
- Transaction ID: {record.get('transaction_id', 'N/A')}
- Exception Type: {record.get('recon_status', 'N/A')}
- Customer ID: {record.get('customer_id', 'N/A')}
- Invoice ID: {record.get('invoice_id', 'N/A')}
- Transaction Date: {record.get('transaction_date', 'N/A')}
- Payment Method: {record.get('payment_method', 'N/A')}

SOURCE DATA COMPARISON:
- Payment Gateway Amount: {f"INR {record.get('gateway_amount'):,.0f}" if record.get('gateway_amount') else 'Not found'}
- Payment Gateway Status: {record.get('payment_status', 'N/A')}
- Bank Settled Amount: {f"INR {record.get('settled_amount'):,.0f}" if record.get('settled_amount') else 'Not found'}
- Bank Settlement Status: {record.get('settlement_status', 'N/A')}
- Bank Settlement Date: {record.get('settlement_date', 'N/A')}
- Invoice Amount: {f"INR {record.get('invoice_amount'):,.0f}" if record.get('invoice_amount') else 'Not found'}
- Invoice Status: {record.get('invoice_status', 'N/A')}

SYSTEM MATCH REASON: {record.get('match_reason', 'N/A')}

Respond ONLY with a JSON object in this exact format:
{{
  "explanation": "Clear explanation of what the exception is (2-3 sentences)",
  "likely_cause": "The most probable cause, phrased with appropriate uncertainty (use 'likely', 'possibly', 'may be')",
  "confidence": 0.XX,
  "recommendation": "Specific, actionable next step for the finance team",
  "priority": "LOW|MEDIUM|HIGH|CRITICAL"
}}

Rules:
- Never claim certainty. Use hedging language like "likely", "possibly", "requires verification"
- Confidence must be between 0.0 and 1.0
- Recommendation must be specific and actionable
- Priority must be one of: LOW, MEDIUM, HIGH, CRITICAL"""


def analyze_exception(record: Dict) -> Dict:
    """
    Call OpenAI to analyze an exception record.
    Returns structured analysis dict.
    Falls back to rule-based analysis if API unavailable.
    """
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    model = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
    exception_type = record.get("recon_status", "UNRESOLVED")

    # Attempt AI analysis if API key is present
    if api_key:
        try:
            client = OpenAI(api_key=api_key)
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": "You are a finance reconciliation analyst. Always respond with valid JSON only."},
                    {"role": "user", "content": _build_prompt(record)},
                ],
                temperature=0.3,
                max_tokens=400,
            )
            content = response.choices[0].message.content.strip()
            # Strip markdown code blocks if present
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]

            parsed = json.loads(content)
            return {
                "explanation": parsed.get("explanation", ""),
                "likely_cause": parsed.get("likely_cause", ""),
                "confidence": float(parsed.get("confidence", 0.7)),
                "recommendation": parsed.get("recommendation", ""),
                "priority": parsed.get("priority", EXCEPTION_PRIORITY.get(exception_type, "MEDIUM")),
                "source": "ai",
            }

        except AuthenticationError:
            logger.warning("OpenAI API key is invalid — falling back to rule-based analysis.")
        except APIError as e:
            logger.warning(f"OpenAI API error: {e} — falling back to rule-based analysis.")
        except (json.JSONDecodeError, KeyError) as e:
            logger.warning(f"Failed to parse AI response: {e} — falling back to rule-based analysis.")
        except Exception as e:
            logger.warning(f"Unexpected AI error: {e} — falling back to rule-based analysis.")

    # Fallback: rule-based analysis
    fallback = FALLBACK_ANALYSIS.get(exception_type, FALLBACK_ANALYSIS["UNRESOLVED"])
    return {
        "explanation": fallback["explanation"],
        "likely_cause": fallback["likely_cause"],
        "confidence": fallback["confidence"],
        "recommendation": fallback["recommendation"],
        "priority": EXCEPTION_PRIORITY.get(exception_type, "MEDIUM"),
        "source": "rule-based",
    }


def generate_ai_summary(metrics: Dict, top_exceptions: list) -> str:
    """
    Generate a natural-language reconciliation summary.
    Falls back to template if AI is unavailable.
    """
    total = metrics.get("total_records", 0)
    matched = metrics.get("matched_count", 0)
    exceptions = metrics.get("exception_count", 0)
    match_rate = metrics.get("match_rate", 0)
    exception_value = metrics.get("exception_value", 0)
    dist = metrics.get("exception_distribution", [])

    largest_category = dist[0]["status"].replace("_", " ").title() if dist else "Unknown"
    largest_count = dist[0]["count"] if dist else 0

    # Find highest-priority unresolved exception
    highlight = ""
    if top_exceptions:
        top = top_exceptions[0]
        highlight = (
            f"The highest priority item is {top.get('transaction_id', 'N/A')} — "
            f"the gateway shows {top.get('payment_status', 'N/A')} but "
            f"{top.get('recon_status', '').replace('_', ' ').lower()}."
        )

    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    model = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")

    template_summary = (
        f"Reconciliation completed for {total} records. "
        f"{matched} records were successfully matched (match rate: {match_rate}%). "
        f"{exceptions} exceptions require attention. "
        f"The largest exception category is {largest_category} ({largest_count} records). "
        f"INR {exception_value:,.0f} is currently associated with unresolved exceptions. "
        f"{highlight}"
    )

    if not api_key:
        return template_summary

    try:
        client = OpenAI(api_key=api_key)
        prompt = f"""Write a professional 3-4 sentence finance reconciliation summary for a dashboard.

Data:
- Total records: {total}
- Matched: {matched} ({match_rate}%)
- Exceptions: {exceptions}
- Exception value: INR {exception_value:,.0f}
- Largest exception type: {largest_category} ({largest_count} records)
- Priority item: {highlight}

Write in the style of a senior finance controller. Be precise and professional. Do not use bullet points."""

        response = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4,
            max_tokens=200,
        )
        return response.choices[0].message.content.strip()

    except Exception as e:
        logger.warning(f"AI summary generation failed: {e}")
        return template_summary
