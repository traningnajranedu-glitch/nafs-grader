"""Read-only, privacy-preserving preflight for unresolved NAFS imports.

No approvals, grading, student names, identity numbers, or answer data leave the DB.
This is a prerequisite audit, NOT an OMR correction worker.
"""
import datetime
import json
import os
import pathlib
import sys
import urllib.parse
import urllib.request

output = pathlib.Path("reports/nafs-pending-audit.json")
output.parent.mkdir(parents=True, exist_ok=True)
report = {
    "checked_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "mode": "read_only",
    "scope": "nafs_result_import_rows.status = pending_review",
    "status": "blocked",
    "pending": None,
    "verified_untouched": True,
    "graded": 0,
    "approved": 0,
    "reason": "not_checked",
}

def save():
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

url = os.getenv("SUPABASE_URL", "").rstrip("/")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
if not (url.startswith("https://") and key):
    report["reason"] = "Missing NAFS_SUPABASE_URL or NAFS_SUPABASE_SERVICE_ROLE_KEY secrets"
    save()
    sys.exit(1)

try:
    query = urllib.parse.urlencode({"select": "id", "status": "eq.pending_review", "limit": "1"})
    request = urllib.request.Request(
        url + "/rest/v1/nafs_result_import_rows?" + query,
        headers={
            "apikey": key,
            "Authorization": "Bearer " + key,
            "Prefer": "count=exact",
            "Range": "0-0",
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        content_range = response.headers.get("Content-Range", "")
        if "/" not in content_range:
            raise RuntimeError("Database did not provide an exact count")
        total = content_range.rsplit("/", 1)[1]
        if not total.isdigit():
            raise RuntimeError("Pending count is not numeric")
        report["pending"] = int(total)
        report["status"] = "pending_inventory_complete"
        report["reason"] = "Awaiting source PDF and answer-key matching worker; no records changed"
except Exception as exc:
    report["reason"] = type(exc).__name__ + ": " + str(exc)[:140]
    save()
    sys.exit(1)
save()
print("Pending-only audit complete: " + str(report["pending"]) + " rows. No data modified.")
