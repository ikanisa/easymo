import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  computeRetryDelaySeconds,
  type NotificationJob,
} from "../../../../../supabase/functions/_shared/notifications";
import {
  processWhatsappJob,
  processEmailJob,
  type WhatsappJobDeps,
  type EmailJobDeps,
} from "../../../../../supabase/functions/_shared/notification-handlers";

const baseJob: NotificationJob = {
  id: "job-1",
  event: "SMS_TEMPLATE_TEST",
  channel: "WHATSAPP",
  sacco_id: null,
  template_id: null,
  payment_id: null,
  status: "PENDING",
  scheduled_for: new Date().toISOString(),
  created_at: new Date().toISOString(),
  processed_at: null,
  payload: {},
  attempts: 1,
  last_error: null,
  last_attempt_at: null,
  retry_after: null,
};

const stubTemplate = {
  id: "tpl-1",
  body: "Hello {name}",
  sacco_id: null,
  tokens: ["{name}"],
};

describe("notification dispatch helpers", () => {
  it("computes retry delays with exponential backoff", () => {
    assert.equal(computeRetryDelaySeconds(1), 30);
    assert.equal(computeRetryDelaySeconds(2), 60);
    assert.equal(computeRetryDelaySeconds(5), 480);
    assert.equal(computeRetryDelaySeconds(8), 3600);
  });

  it("retries WhatsApp jobs when rate limit denies", async () => {
    const job: NotificationJob = {
      ...baseJob,
      payload: { templateId: "tpl-1", to: "+250700000000", tokens: { name: "Test" } },
      template_id: "tpl-1",
    };

    const deps: WhatsappJobDeps = {
      fetchTemplate: async () => stubTemplate,
      fetchPayment: async () => null,
      rateLimit: async () => false,
      send: async () => {
        throw new Error("should not send when rate limited");
      },
      audit: async () => {},
    };

    const outcome = await processWhatsappJob(job, deps);
    assert.equal(outcome.type, "retry");
    assert.equal(outcome.detail, "rate_limited");
  });

  it("delivers WhatsApp jobs when Twilio succeeds", async () => {
    const sent: Array<{ to: string; body: string }> = [];
    const audits: Array<Record<string, unknown>> = [];
    const job: NotificationJob = {
      ...baseJob,
      payload: { templateId: "tpl-1", to: "+250788888888", tokens: { name: "Aline" } },
      template_id: "tpl-1",
    };

    const deps: WhatsappJobDeps = {
      fetchTemplate: async () => stubTemplate,
      fetchPayment: async () => null,
      rateLimit: async () => true,
      send: async (payload) => {
        sent.push(payload);
        return { ok: true, status: 200 };
      },
      audit: async (entry) => {
        audits.push(entry.diff ?? {});
      },
    };

    const outcome = await processWhatsappJob(job, deps);
    assert.equal(outcome.type, "success");
    assert.equal(sent.length, 1);
    assert.ok(sent[0].body.includes("Aline"));
    assert.equal(
      audits.some((diff) => diff.event === "SMS_TEMPLATE_TEST"),
      true
    );
  });

  it("fails email jobs without recipient", async () => {
    const job: NotificationJob = {
      ...baseJob,
      channel: "EMAIL",
      event: "MFA_REMINDER",
      payload: {},
    };

    const deps: EmailJobDeps = {
      rateLimit: async () => true,
      send: async () => ({ ok: true, status: 200 }),
      audit: async () => {},
    };

    const outcome = await processEmailJob(job, deps);
    assert.equal(outcome.type, "failed");
    assert.equal(outcome.detail, "missing_email");
  });

  it("retries email jobs on upstream errors", async () => {
    const attempts: string[] = [];
    const job: NotificationJob = {
      ...baseJob,
      channel: "EMAIL",
      event: "MFA_REMINDER",
      payload: { email: "staff@example.com" },
    };

    const deps: EmailJobDeps = {
      rateLimit: async () => true,
      send: async () => {
        attempts.push("send");
        return { ok: false, status: 502, error: "bad gateway" };
      },
      audit: async () => {},
    };

    const outcome = await processEmailJob(job, deps);
    assert.equal(outcome.type, "retry");
    assert.equal(outcome.detail, "upstream_error");
    assert.equal(attempts.length, 1);
  });
});
