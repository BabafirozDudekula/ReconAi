"""
Synthetic data generator for ReconAI hackathon demo.
Generates realistic payment gateway, bank settlement, and invoice records
with intentional anomalies for reconciliation testing.
"""

import csv
import random
from datetime import datetime, timedelta
import os

random.seed(42)

# ── Configuration ──────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)

NUM_CLEAN = 163        # ~81.5% clean matches
START_DATE = datetime(2026, 7, 1)
PAYMENT_METHODS = ["UPI", "NEFT", "RTGS", "IMPS", "Card", "Netbanking"]
CUSTOMERS = [f"CUST{str(i).zfill(3)}" for i in range(1, 81)]

def rand_date(start=START_DATE, days=60):
    return start + timedelta(days=random.randint(0, days))

def rand_amount(low=500, high=50000):
    return round(random.choice([
        random.randint(low, 5000),
        random.randint(5001, 20000),
        random.randint(20001, high),
    ]), -1)  # round to nearest 10


# ════════════════════════════════════════════════════════════════════
# 1. Generate records
# ════════════════════════════════════════════════════════════════════

gateway_rows = []
settlement_rows = []
invoice_rows = []

txn_counter = 1001
inv_counter = 1001

def next_txn():
    global txn_counter
    t = f"TXN{txn_counter}"
    txn_counter += 1
    return t

def next_inv():
    global inv_counter
    i = f"INV{inv_counter}"
    inv_counter += 1
    return i

# ── Scenario A: Clean matched records (163) ──────────────────────
for _ in range(NUM_CLEAN):
    txn_id = next_txn()
    inv_id = next_inv()
    cust = random.choice(CUSTOMERS)
    txn_date = rand_date()
    amount = rand_amount()
    method = random.choice(PAYMENT_METHODS)
    gw_ref = f"GW{txn_id[3:]}"
    bank_ref = f"BNK{txn_id[3:]}"

    gateway_rows.append({
        "transaction_id": txn_id,
        "customer_id": cust,
        "invoice_id": inv_id,
        "transaction_date": txn_date.strftime("%Y-%m-%d"),
        "amount": amount,
        "payment_status": "SUCCESS",
        "payment_method": method,
        "gateway_reference": gw_ref,
    })

    settlement_rows.append({
        "settlement_id": f"SET{txn_id[3:]}",
        "transaction_id": txn_id,
        "settlement_date": (txn_date + timedelta(days=random.randint(1, 2))).strftime("%Y-%m-%d"),
        "settled_amount": amount,
        "settlement_status": "SETTLED",
        "bank_reference": bank_ref,
    })

    invoice_rows.append({
        "invoice_id": inv_id,
        "customer_id": cust,
        "invoice_amount": amount,
        "invoice_date": (txn_date - timedelta(days=random.randint(1, 5))).strftime("%Y-%m-%d"),
        "invoice_status": "PAID",
    })


# ── Scenario B: Amount mismatch — gateway vs bank (12 records) ──
for i in range(12):
    txn_id = next_txn()
    inv_id = next_inv()
    cust = random.choice(CUSTOMERS)
    txn_date = rand_date()
    amount = rand_amount()
    method = random.choice(PAYMENT_METHODS)
    gw_ref = f"GW{txn_id[3:]}"
    bank_ref = f"BNK{txn_id[3:]}"
    # Bank settles less due to processing fee / error
    fee = random.choice([50, 100, 150, 200, 250, 300])
    settled = amount - fee

    gateway_rows.append({
        "transaction_id": txn_id, "customer_id": cust, "invoice_id": inv_id,
        "transaction_date": txn_date.strftime("%Y-%m-%d"), "amount": amount,
        "payment_status": "SUCCESS", "payment_method": method,
        "gateway_reference": gw_ref,
    })
    settlement_rows.append({
        "settlement_id": f"SET{txn_id[3:]}", "transaction_id": txn_id,
        "settlement_date": (txn_date + timedelta(days=1)).strftime("%Y-%m-%d"),
        "settled_amount": settled, "settlement_status": "SETTLED",
        "bank_reference": bank_ref,
    })
    invoice_rows.append({
        "invoice_id": inv_id, "customer_id": cust, "invoice_amount": amount,
        "invoice_date": (txn_date - timedelta(days=2)).strftime("%Y-%m-%d"),
        "invoice_status": "PAID",
    })


# ── Scenario C: Missing bank settlement (8 records) ──────────────
# TXN1087 is the showcase — add it deterministically first
showcase_txn = "TXN1087"
showcase_inv = "INV1087"
txn_counter = max(txn_counter, 1088)  # keep counter ahead
inv_counter = max(inv_counter, 1088)

gateway_rows.append({
    "transaction_id": showcase_txn, "customer_id": "CUST087",
    "invoice_id": showcase_inv,
    "transaction_date": "2026-08-15", "amount": 8500,
    "payment_status": "SUCCESS", "payment_method": "NEFT",
    "gateway_reference": "GW1087",
})
invoice_rows.append({
    "invoice_id": showcase_inv, "customer_id": "CUST087",
    "invoice_amount": 8500,
    "invoice_date": "2026-08-13", "invoice_status": "PAID",
})
# NO settlement row for TXN1087

for i in range(7):
    txn_id = next_txn()
    inv_id = next_inv()
    cust = random.choice(CUSTOMERS)
    txn_date = rand_date()
    amount = rand_amount()
    method = random.choice(PAYMENT_METHODS)

    gateway_rows.append({
        "transaction_id": txn_id, "customer_id": cust, "invoice_id": inv_id,
        "transaction_date": txn_date.strftime("%Y-%m-%d"), "amount": amount,
        "payment_status": "SUCCESS", "payment_method": method,
        "gateway_reference": f"GW{txn_id[3:]}",
    })
    invoice_rows.append({
        "invoice_id": inv_id, "customer_id": cust, "invoice_amount": amount,
        "invoice_date": (txn_date - timedelta(days=2)).strftime("%Y-%m-%d"),
        "invoice_status": "PAID",
    })
    # No settlement


# ── Scenario D: Missing gateway transaction (5 records) ──────────
for i in range(5):
    txn_id = next_txn()
    inv_id = next_inv()
    cust = random.choice(CUSTOMERS)
    txn_date = rand_date()
    amount = rand_amount()

    # Settlement exists but no gateway record
    settlement_rows.append({
        "settlement_id": f"SET{txn_id[3:]}", "transaction_id": txn_id,
        "settlement_date": txn_date.strftime("%Y-%m-%d"),
        "settled_amount": amount, "settlement_status": "SETTLED",
        "bank_reference": f"BNK{txn_id[3:]}",
    })
    invoice_rows.append({
        "invoice_id": inv_id, "customer_id": cust, "invoice_amount": amount,
        "invoice_date": (txn_date - timedelta(days=1)).strftime("%Y-%m-%d"),
        "invoice_status": "PAID",
    })


# ── Scenario E: Duplicate gateway transactions (4 records = 2 pairs) ──
for i in range(2):
    txn_id = next_txn()
    inv_id = next_inv()
    cust = random.choice(CUSTOMERS)
    txn_date = rand_date()
    amount = rand_amount()
    method = random.choice(PAYMENT_METHODS)
    gw_ref = f"GW{txn_id[3:]}"

    for j in range(2):  # duplicate
        dup_txn = txn_id if j == 0 else f"{txn_id}D"
        gateway_rows.append({
            "transaction_id": dup_txn, "customer_id": cust, "invoice_id": inv_id,
            "transaction_date": txn_date.strftime("%Y-%m-%d"), "amount": amount,
            "payment_status": "SUCCESS", "payment_method": method,
            "gateway_reference": gw_ref,  # same GW ref = duplicate signal
        })

    settlement_rows.append({
        "settlement_id": f"SET{txn_id[3:]}", "transaction_id": txn_id,
        "settlement_date": (txn_date + timedelta(days=1)).strftime("%Y-%m-%d"),
        "settled_amount": amount, "settlement_status": "SETTLED",
        "bank_reference": f"BNK{txn_id[3:]}",
    })
    invoice_rows.append({
        "invoice_id": inv_id, "customer_id": cust, "invoice_amount": amount,
        "invoice_date": (txn_date - timedelta(days=1)).strftime("%Y-%m-%d"),
        "invoice_status": "PAID",
    })


# ── Scenario F: Invoice amount mismatch (5 records) ──────────────
for i in range(5):
    txn_id = next_txn()
    inv_id = next_inv()
    cust = random.choice(CUSTOMERS)
    txn_date = rand_date()
    amount = rand_amount()
    method = random.choice(PAYMENT_METHODS)
    inv_amount = amount + random.choice([-500, -200, 200, 500, 1000])

    gateway_rows.append({
        "transaction_id": txn_id, "customer_id": cust, "invoice_id": inv_id,
        "transaction_date": txn_date.strftime("%Y-%m-%d"), "amount": amount,
        "payment_status": "SUCCESS", "payment_method": method,
        "gateway_reference": f"GW{txn_id[3:]}",
    })
    settlement_rows.append({
        "settlement_id": f"SET{txn_id[3:]}", "transaction_id": txn_id,
        "settlement_date": (txn_date + timedelta(days=1)).strftime("%Y-%m-%d"),
        "settled_amount": amount, "settlement_status": "SETTLED",
        "bank_reference": f"BNK{txn_id[3:]}",
    })
    invoice_rows.append({
        "invoice_id": inv_id, "customer_id": cust, "invoice_amount": inv_amount,
        "invoice_date": (txn_date - timedelta(days=1)).strftime("%Y-%m-%d"),
        "invoice_status": "PAID",
    })


# ── Scenario G: Date mismatch (3 records — settlement much later) ─
for i in range(3):
    txn_id = next_txn()
    inv_id = next_inv()
    cust = random.choice(CUSTOMERS)
    txn_date = rand_date()
    amount = rand_amount()
    method = random.choice(PAYMENT_METHODS)

    gateway_rows.append({
        "transaction_id": txn_id, "customer_id": cust, "invoice_id": inv_id,
        "transaction_date": txn_date.strftime("%Y-%m-%d"), "amount": amount,
        "payment_status": "SUCCESS", "payment_method": method,
        "gateway_reference": f"GW{txn_id[3:]}",
    })
    settlement_rows.append({
        "settlement_id": f"SET{txn_id[3:]}", "transaction_id": txn_id,
        # Settlement 10–30 days late
        "settlement_date": (txn_date + timedelta(days=random.randint(10, 30))).strftime("%Y-%m-%d"),
        "settled_amount": amount, "settlement_status": "SETTLED",
        "bank_reference": f"BNK{txn_id[3:]}",
    })
    invoice_rows.append({
        "invoice_id": inv_id, "customer_id": cust, "invoice_amount": amount,
        "invoice_date": (txn_date - timedelta(days=1)).strftime("%Y-%m-%d"),
        "invoice_status": "PAID",
    })


# ── Scenario H: Failed payment (4 records) ───────────────────────
for i in range(4):
    txn_id = next_txn()
    inv_id = next_inv()
    cust = random.choice(CUSTOMERS)
    txn_date = rand_date()
    amount = rand_amount()
    method = random.choice(PAYMENT_METHODS)

    gateway_rows.append({
        "transaction_id": txn_id, "customer_id": cust, "invoice_id": inv_id,
        "transaction_date": txn_date.strftime("%Y-%m-%d"), "amount": amount,
        "payment_status": "FAILED", "payment_method": method,
        "gateway_reference": f"GW{txn_id[3:]}",
    })
    # No settlement (payment failed)
    invoice_rows.append({
        "invoice_id": inv_id, "customer_id": cust, "invoice_amount": amount,
        "invoice_date": (txn_date - timedelta(days=1)).strftime("%Y-%m-%d"),
        "invoice_status": "UNPAID",
    })


# ── Scenario I: Refunded transactions (2 records) ────────────────
for i in range(2):
    txn_id = next_txn()
    inv_id = next_inv()
    cust = random.choice(CUSTOMERS)
    txn_date = rand_date()
    amount = rand_amount()
    method = random.choice(PAYMENT_METHODS)

    gateway_rows.append({
        "transaction_id": txn_id, "customer_id": cust, "invoice_id": inv_id,
        "transaction_date": txn_date.strftime("%Y-%m-%d"), "amount": amount,
        "payment_status": "REFUNDED", "payment_method": method,
        "gateway_reference": f"GW{txn_id[3:]}",
    })
    settlement_rows.append({
        "settlement_id": f"SET{txn_id[3:]}", "transaction_id": txn_id,
        "settlement_date": (txn_date + timedelta(days=3)).strftime("%Y-%m-%d"),
        "settled_amount": -amount, "settlement_status": "REFUNDED",
        "bank_reference": f"BNK{txn_id[3:]}",
    })
    invoice_rows.append({
        "invoice_id": inv_id, "customer_id": cust, "invoice_amount": amount,
        "invoice_date": (txn_date - timedelta(days=1)).strftime("%Y-%m-%d"),
        "invoice_status": "CANCELLED",
    })


# ── Scenario J: Settlement pending (2 records) ───────────────────
for i in range(2):
    txn_id = next_txn()
    inv_id = next_inv()
    cust = random.choice(CUSTOMERS)
    txn_date = rand_date(start=datetime(2026, 8, 28), days=5)  # very recent
    amount = rand_amount()
    method = random.choice(PAYMENT_METHODS)

    gateway_rows.append({
        "transaction_id": txn_id, "customer_id": cust, "invoice_id": inv_id,
        "transaction_date": txn_date.strftime("%Y-%m-%d"), "amount": amount,
        "payment_status": "SUCCESS", "payment_method": method,
        "gateway_reference": f"GW{txn_id[3:]}",
    })
    settlement_rows.append({
        "settlement_id": f"SET{txn_id[3:]}", "transaction_id": txn_id,
        "settlement_date": "",
        "settled_amount": 0, "settlement_status": "PENDING",
        "bank_reference": f"BNK{txn_id[3:]}",
    })
    invoice_rows.append({
        "invoice_id": inv_id, "customer_id": cust, "invoice_amount": amount,
        "invoice_date": (txn_date - timedelta(days=1)).strftime("%Y-%m-%d"),
        "invoice_status": "PAID",
    })


# ════════════════════════════════════════════════════════════════════
# 2. Write CSV files
# ════════════════════════════════════════════════════════════════════

def write_csv(path, rows, fieldnames):
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    print(f"  OK: Written {len(rows)} rows to {path}")

# Shuffle gateway and settlement rows to make matching non-trivial
random.shuffle(gateway_rows)
random.shuffle(settlement_rows)
random.shuffle(invoice_rows)

write_csv(
    os.path.join(DATA_DIR, "payment_gateway.csv"),
    gateway_rows,
    ["transaction_id", "customer_id", "invoice_id", "transaction_date",
     "amount", "payment_status", "payment_method", "gateway_reference"],
)

write_csv(
    os.path.join(DATA_DIR, "bank_settlements.csv"),
    settlement_rows,
    ["settlement_id", "transaction_id", "settlement_date",
     "settled_amount", "settlement_status", "bank_reference"],
)

write_csv(
    os.path.join(DATA_DIR, "invoices.csv"),
    invoice_rows,
    ["invoice_id", "customer_id", "invoice_amount", "invoice_date", "invoice_status"],
)

print(f"\nTotal gateway records  : {len(gateway_rows)}")
print(f"Total settlement records: {len(settlement_rows)}")
print(f"Total invoice records  : {len(invoice_rows)}")
print("\nData generation complete.")
