"""Read-only source inventory worker. Does NOT grade or approve student records."""
import os
import signal
import subprocess
import sys
import time
from datetime import datetime, timezone

running = True

def stop(_signal, _frame):
    global running
    running = False

signal.signal(signal.SIGTERM, stop)
signal.signal(signal.SIGINT, stop)

def log(message):
    print(f"[{datetime.now(timezone.utc).isoformat()}] {message}", flush=True)

interval = max(3600, int(os.environ.get("NAFS_WORKER_INTERVAL_SECONDS", "21600")))
log("NAFS source preflight worker started (READ ONLY; no grading, approvals or Excel writes)")
while running:
    try:
        result = subprocess.run([sys.executable, "scripts/nafs-preflight.py"], check=False)
        log(f"source preflight exit_code={result.returncode}")
    except Exception as exc:
        log(f"source preflight failed: {type(exc).__name__}: {exc}")
    for _ in range(interval):
        if not running:
            break
        time.sleep(1)
log("NAFS source preflight worker stopped")
