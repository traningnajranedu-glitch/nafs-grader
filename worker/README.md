# Render NAFS source worker — safe initial deployment

This is a **read-only** background service. It invokes the repository's existing
`scripts/nafs-preflight.py` to inventory and validate source PDFs from the
three Google Drive folders. **It does not perform OMR, compute grades, approve
rows, update Supabase, or export Excel.** Do not label its inventory as grading
progress. The existing script writes `reports/nafs-preflight.json` to the
ephemeral container filesystem; logs survive in Render, but the JSON does not
persist across instance replacement.

## Deployment

1. Review the PR and merge to `main` after approval.
2. In Render, choose **New → Blueprint** and connect this GitHub repository.
3. Render reads `render.yaml` and proposes `nafs-source-worker` as a paid
   background worker. Confirm the plan and charges before deploying.
4. Create a Google Cloud service account with **read-only** access to the three
   source folders and grant that service account Viewer access to those folders.
   In Render's secret settings set `GOOGLE_SERVICE_ACCOUNT_JSON` to the complete
   JSON key (never commit the key). The existing Google Drive OAuth connection
   inside the web app is **not** automatically available to this worker.
5. Deploy and inspect logs for `source_inventory_complete`; check error counts.

The preflight downloads PDFs and may consume bandwidth and time. It runs every
six hours by default; adjust `NAFS_WORKER_INTERVAL_SECONDS` (minimum one hour).
Only one worker instance should be deployed to avoid duplicate scanning.

## Before enabling real grading

Implement and test a server-side PDF rasterizer and OMR pipeline, per-template
question mapping, official answer-key validation, audit evidence, durable
per-page checkpoints, and an idempotent queue in Supabase. Require source
verification before changing `nafs_result_import_rows.status` to `verified`.
Export per-school Excel only after verified database commits, and verify upload.
Do not run a bulk approval SQL based solely on existing scores or source labels.

The browser-oriented `lib/auto-omr.ts` uses `ImageData` and cannot simply
be imported into this Python process. A separate tested server adapter is
needed. No grading secrets or service-role key are required for this initial
read-only deployment.
