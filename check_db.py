import sqlite3
conn = sqlite3.connect('reconai.db')

print("=== audit_log schema ===")
cursor = conn.execute("PRAGMA table_info(audit_log)")
for c in cursor.fetchall():
    print(c)

print("\n=== record counts ===")
cursor2 = conn.execute("SELECT COUNT(*) FROM reconciliation_records")
print("Total Records:", cursor2.fetchone()[0])

cursor3 = conn.execute("SELECT COUNT(*) FROM reconciliation_records WHERE recon_status != 'MATCHED'")
print("Exceptions:", cursor3.fetchone()[0])

print("\n=== action_status breakdown ===")
cursor4 = conn.execute("SELECT action_status, COUNT(*) FROM reconciliation_records WHERE recon_status != 'MATCHED' GROUP BY action_status")
for row in cursor4.fetchall():
    print(row)

print("\n=== runs ===")
cursor5 = conn.execute("SELECT run_id, status, total_records FROM reconciliation_runs ORDER BY created_at DESC LIMIT 3")
for row in cursor5.fetchall():
    print(row)

conn.close()
