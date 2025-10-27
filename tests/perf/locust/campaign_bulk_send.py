"""Locust scenario for the "Campaign Bulk Send" load test."""
from __future__ import annotations

import json
import os
import random
import time
import uuid
from pathlib import Path
from typing import List

from locust import HttpUser, between, events, task

SUMMARY_PATH = Path(os.environ.get(
    "PERF_SUMMARY_PATH",
    Path(__file__).resolve().parents[1] / "fixtures" / "generated" / "perf_seed_summary.json",
))

if not SUMMARY_PATH.exists():
    raise SystemExit(
        "perf_seed_summary.json not found. Run `pnpm perf:seed` before executing the Locust scenario."
    )

with SUMMARY_PATH.open("r", encoding="utf-8") as summary_file:
    seed_summary = json.load(summary_file)

campaign_dispatch = seed_summary.get("campaignDispatch") or {}
CAMPAIGN_ID = os.environ.get("PERF_CAMPAIGN_ID", campaign_dispatch.get("campaignId"))
BULK_TARGETS: List[str] = campaign_dispatch.get("bulkTargetMsisdns", [])
BATCH_REFERENCE = campaign_dispatch.get("batchReference", "perf-bulk")

if not CAMPAIGN_ID:
    raise SystemExit("Campaign ID missing. Provide PERF_CAMPAIGN_ID or rerun the seed script.")

if len(BULK_TARGETS) < 1:
    raise SystemExit("Seed summary missing bulk campaign targets. Re-run the fixture seed before testing.")

BATCH_SIZE = int(os.environ.get("PERF_CAMPAIGN_DISPATCH_BATCH_SIZE", "100"))
METHOD = os.environ.get("PERF_CAMPAIGN_DISPATCH_METHOD", "POST").upper()
DISPATCH_URL = os.environ.get("PERF_CAMPAIGN_DISPATCH_URL")
if not DISPATCH_URL:
    raise SystemExit("Set PERF_CAMPAIGN_DISPATCH_URL to the dispatcher endpoint.")

AUTH_HEADER = os.environ.get("PERF_CAMPAIGN_AUTH_HEADER", "authorization")
AUTH_TOKEN = os.environ.get("PERF_CAMPAIGN_BEARER")
BRIDGE_SECRET = os.environ.get("BRIDGE_SHARED_SECRET")

LOG_PATH = Path(os.environ.get("PERF_LOCUST_LOG", ".perf/locust-responses.log"))
LOG_PATH.parent.mkdir(parents=True, exist_ok=True)

_log_handle = LOG_PATH.open("a", encoding="utf-8")


@events.quitting.add_listener
def close_log_file(environment, **_kwargs):  # pragma: no cover - runtime cleanup
    _log_handle.close()


@events.request.add_listener
def log_responses(request_type, name, response_time, response_length, response, context, exception, **_kwargs):
    """Stream dispatcher + optional WABA responses to a log file for audit trail."""
    record = {
        "ts": time.time(),
        "type": request_type,
        "name": name,
        "response_time_ms": response_time,
        "response_length": response_length,
        "status_code": getattr(response, "status_code", None),
        "exception": str(exception) if exception else None,
    }
    try:
        if response is not None and response.headers.get("content-type", "").startswith("application/json"):
            record["body"] = response.json()
        elif response is not None:
            record["body"] = response.text[:2048]
    except Exception:  # pragma: no cover - defensive logging
        record["body"] = "<unparsed>"
    _log_handle.write(json.dumps(record) + "\n")


class CampaignDispatchUser(HttpUser):
    """Simulates dispatcher batches hitting the campaign bridge."""

    wait_time = between(
        float(os.environ.get("PERF_CAMPAIGN_WAIT_MIN", "0.3")),
        float(os.environ.get("PERF_CAMPAIGN_WAIT_MAX", "0.8")),
    )

    def on_start(self):
        self._targets = BULK_TARGETS.copy()
        random.shuffle(self._targets)
        self._cursor = 0

    def _next_batch(self) -> List[str]:
        if self._cursor >= len(self._targets):
            random.shuffle(self._targets)
            self._cursor = 0
        end = min(self._cursor + BATCH_SIZE, len(self._targets))
        batch = self._targets[self._cursor:end]
        self._cursor = end
        return batch

    def _build_headers(self) -> dict[str, str]:
        headers: dict[str, str] = {"content-type": "application/json"}
        if AUTH_TOKEN:
            headers[AUTH_HEADER] = f"Bearer {AUTH_TOKEN}" if not AUTH_TOKEN.lower().startswith("bearer") else AUTH_TOKEN
        if BRIDGE_SECRET:
            headers["x-bridge-secret"] = BRIDGE_SECRET
        return headers

    @task
    def dispatch_batch(self):
        batch = self._next_batch()
        payload = {
            "campaignId": CAMPAIGN_ID,
            "batchReference": f"{BATCH_REFERENCE}-{uuid.uuid4().hex}",
            "targets": batch,
            "throttle": {
                "maxPerMinute": int(os.environ.get("PERF_CAMPAIGN_TARGETS_PER_MIN", "600")),
                "maxInflight": int(os.environ.get("PERF_CAMPAIGN_MAX_INFLIGHT", "200")),
            },
        }
        if os.environ.get("PERF_CAMPAIGN_INCLUDE_METADATA", "true").lower() == "true":
            payload["metadata"] = {
                "source": "perf-harness",
                "seedVersion": seed_summary.get("seedVersion"),
            }
        if os.environ.get("PERF_WABA_SANDBOX_NUMBER"):
            payload.setdefault("sandbox", {})["number"] = os.environ["PERF_WABA_SANDBOX_NUMBER"]
        if os.environ.get("PERF_WABA_SANDBOX_TOKEN"):
            payload.setdefault("sandbox", {})["token"] = os.environ["PERF_WABA_SANDBOX_TOKEN"]

        headers = self._build_headers()
        name = os.environ.get("PERF_CAMPAIGN_REQUEST_NAME", "campaign_dispatch")

        self.client.request(
            METHOD,
            DISPATCH_URL,
            name=name,
            data=json.dumps(payload),
            headers=headers,
            timeout=float(os.environ.get("PERF_CAMPAIGN_TIMEOUT", "30")),
        )
