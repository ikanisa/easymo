import type { NotificationJob } from "./notifications.ts";
import { computeNextRetryAt, normalizeMsisdn, renderTemplate } from "./notifications.ts";

export type RateLimiter = (
  bucket: string,
  options?: { maxHits?: number; windowSeconds?: number; route?: string }
) => Promise<boolean>;

interface AuditEntry {
  actorId?: string | null;
  saccoId?: string | null;
  action: string;
  entity?: string | null;
  entityId?: string | null;
  diff?: Record<string, unknown> | null;
}

export type AuditLogger = (entry: AuditEntry) => Promise<void>;

interface SendResult {
  ok: boolean;
  status: number;
  error?: string;
}

export type WhatsappSender = (payload: { to: string; body: string }) => Promise<SendResult>;
export type EmailSender = (payload: {
  to: string;
  subject: string;
  text: string;
}) => Promise<SendResult>;

interface TemplateRecord {
  id: string;
  body: string;
  sacco_id: string | null;
  tokens: unknown;
  is_active?: boolean | null;
}

interface PaymentRecord {
  id: string;
  sacco_id: string | null;
  msisdn: string | null;
  amount: number | null;
  currency: string | null;
  reference: string | null;
  occurred_at: string | null;
}

export interface WhatsappJobDeps {
  fetchTemplate: (templateId: string) => Promise<TemplateRecord | null>;
  fetchPayment: (paymentId: string) => Promise<PaymentRecord | null>;
  rateLimit: RateLimiter;
  send: WhatsappSender;
  audit: AuditLogger;
  now?: () => Date;
}

export type JobOutcome =
  | { type: "success"; detail?: string }
  | { type: "retry"; detail: string; retryAt?: Date }
  | { type: "failed"; detail: string };

const formatCurrency = (amount: number | null | undefined, currency: string | null | undefined) => {
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    return null;
  }
  const symbol = currency && currency.trim().length > 0 ? currency.trim().toUpperCase() : "RWF";
  try {
    return new Intl.NumberFormat("en-KE", { style: "currency", currency: symbol }).format(
      amount / 100
    );
  } catch {
    return `${amount / 100} ${symbol}`;
  }
};

const formatDateTime = (iso: string | null | undefined) => {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString("en-US", { timeZone: "UTC" });
  } catch {
    return iso;
  }
};

const extractTokenMap = (source: unknown): Record<string, unknown> => {
  if (Array.isArray(source)) {
    return source
      .filter((item): item is string => typeof item === "string")
      .reduce<Record<string, string>>((acc, token) => {
        const key = token.replace(/[{}]/g, "");
        acc[key] = token;
        return acc;
      }, {});
  }
  if (source && typeof source === "object") {
    const entries = Object.entries(source as Record<string, unknown>);
    const out: Record<string, unknown> = {};
    for (const [key, value] of entries) {
      out[key] = value;
    }
    return out;
  }
  return {};
};

const resolveRetry = (job: NotificationJob, detail: string, now = new Date()) => {
  const retryAt = computeNextRetryAt(job.attempts, now);
  return { type: "retry", detail, retryAt } as const;
};

const ensureRecipient = (candidate: unknown) => {
  if (typeof candidate !== "string" || candidate.trim().length === 0) {
    return null;
  }
  return normalizeMsisdn(candidate);
};

const tokensFromPayload = (payload: Record<string, unknown>) => {
  const context = payload["tokens"];
  if (context && typeof context === "object" && !Array.isArray(context)) {
    return context as Record<string, unknown>;
  }
  return {};
};

export const processWhatsappJob = async (
  job: NotificationJob,
  deps: WhatsappJobDeps
): Promise<JobOutcome> => {
  const now = deps.now?.() ?? new Date();
  const tokens = tokensFromPayload(job.payload);
  const attempts = job.attempts;

  const ensureAudit = async (action: string, diff: Record<string, unknown>) => {
    await deps.audit({
      action,
      entity: "notification_queue",
      entityId: job.id,
      saccoId: job.sacco_id,
      diff,
    });
  };

  if (attempts > 0) {
    await ensureAudit("NOTIFICATION_WHATSAPP_ATTEMPT", {
      event: job.event,
      attempt: attempts,
    });
  }

  if (job.event === "SMS_TEMPLATE_TEST") {
    const recipient = ensureRecipient(job.payload["to"]);
    if (!recipient) {
      await ensureAudit("NOTIFICATION_WHATSAPP_FAILED", { reason: "missing_recipient" });
      return { type: "failed", detail: "missing_recipient" };
    }

    const templateId =
      typeof job.payload["templateId"] === "string" ? job.payload["templateId"] : job.template_id;
    if (!templateId) {
      await ensureAudit("NOTIFICATION_WHATSAPP_FAILED", { reason: "missing_template" });
      return { type: "failed", detail: "missing_template" };
    }

    const template = await deps.fetchTemplate(templateId);
    if (!template) {
      await ensureAudit("NOTIFICATION_WHATSAPP_FAILED", {
        reason: "template_not_found",
        templateId,
      });
      return { type: "failed", detail: "template_not_found" };
    }

    const templateTokens = extractTokenMap(template.tokens);
    const rendered = renderTemplate(template.body, {
      ...templateTokens,
      ...tokens,
    });

    const allowed = await deps.rateLimit(`whatsapp:${recipient}`, {
      route: "notifications:whatsapp",
    });
    if (!allowed) {
      await ensureAudit("NOTIFICATION_WHATSAPP_RATE_LIMIT", { to: recipient });
      return resolveRetry(job, "rate_limited", now);
    }

    const response = await deps.send({ to: recipient, body: rendered });
    if (!response.ok) {
      const shouldRetry = response.status >= 500 || response.status === 429;
      await ensureAudit("NOTIFICATION_WHATSAPP_FAILED", {
        to: recipient,
        status: response.status,
        retryable: shouldRetry,
      });
      return shouldRetry
        ? resolveRetry(job, "upstream_error", now)
        : { type: "failed", detail: "send_failed" };
    }

    await ensureAudit("NOTIFICATION_WHATSAPP_SENT", { to: recipient, event: job.event });
    return { type: "success", detail: "delivered" };
  }

  // Handle templated event notifications (INVITE_ACCEPTED, JOIN_APPROVED, PAYMENT_CONFIRMED)
  if (["INVITE_ACCEPTED", "JOIN_APPROVED", "PAYMENT_CONFIRMED"].includes(job.event)) {
    const recipient = ensureRecipient(job.payload["to"]);
    if (!recipient) {
      await ensureAudit("NOTIFICATION_WHATSAPP_FAILED", {
        reason: "missing_recipient",
        event: job.event,
      });
      return { type: "failed", detail: "missing_recipient" };
    }

    const templateId = job.template_id;
    if (!templateId) {
      await ensureAudit("NOTIFICATION_WHATSAPP_FAILED", {
        reason: "missing_template",
        event: job.event,
      });
      return { type: "failed", detail: "missing_template" };
    }

    const template = await deps.fetchTemplate(templateId);
    if (!template) {
      await ensureAudit("NOTIFICATION_WHATSAPP_FAILED", {
        reason: "template_not_found",
        templateId,
        event: job.event,
      });
      return { type: "failed", detail: "template_not_found" };
    }

    const allowed = await deps.rateLimit(`whatsapp:${recipient}`, {
      route: "notifications:whatsapp",
    });
    if (!allowed) {
      await ensureAudit("NOTIFICATION_WHATSAPP_RATE_LIMIT", { to: recipient, event: job.event });
      return resolveRetry(job, "rate_limited", now);
    }

    const rendered = renderTemplate(template.body, {
      ...tokens,
    });

    const response = await deps.send({ to: recipient, body: rendered });
    if (!response.ok) {
      const shouldRetry = response.status >= 500 || response.status === 429;
      await ensureAudit("NOTIFICATION_WHATSAPP_FAILED", {
        to: recipient,
        status: response.status,
        retryable: shouldRetry,
        event: job.event,
      });
      return shouldRetry
        ? resolveRetry(job, "upstream_error", now)
        : { type: "failed", detail: "send_failed" };
    }

    await ensureAudit("NOTIFICATION_WHATSAPP_SENT", { to: recipient, event: job.event });
    return { type: "success", detail: "delivered" };
  }

  if (job.event === "RECON_ESCALATION") {
    const candidateRecipient = ensureRecipient(job.payload["to"] ?? job.payload["msisdn"]);
    let recipient = candidateRecipient;

    if (!recipient && job.payment_id) {
      const payment = await deps.fetchPayment(job.payment_id);
      if (payment?.msisdn) {
        recipient = ensureRecipient(payment.msisdn);
        if (!job.sacco_id && payment.sacco_id) {
          job.sacco_id = payment.sacco_id;
        }
        if (payment && typeof tokens["amount"] === "undefined") {
          const formattedAmount = formatCurrency(payment.amount, payment.currency);
          if (formattedAmount) tokens["amount"] = formattedAmount;
        }
        if (payment && typeof tokens["reference"] === "undefined") {
          tokens["reference"] = payment.reference ?? "pending payment";
        }
        if (payment && typeof tokens["occurredAt"] === "undefined") {
          tokens["occurredAt"] = formatDateTime(payment.occurred_at);
        }
      }
    }

    if (!recipient) {
      await ensureAudit("NOTIFICATION_WHATSAPP_FAILED", {
        reason: "missing_recipient",
        event: job.event,
      });
      return { type: "failed", detail: "missing_recipient" };
    }

    const allowed = await deps.rateLimit(`whatsapp:${recipient}`, {
      route: "notifications:whatsapp",
    });
    if (!allowed) {
      await ensureAudit("NOTIFICATION_WHATSAPP_RATE_LIMIT", { to: recipient });
      return resolveRetry(job, "rate_limited", now);
    }

    const template =
      typeof job.payload["message"] === "string"
        ? job.payload["message"]
        : "Hello from SACCO+. Your payment {reference} recorded on {occurredAt} is still pending. Please contact your SACCO to finalize.";

    const rendered = renderTemplate(
      template,
      tokens as Record<string, string | number | null | undefined>
    );
    const response = await deps.send({ to: recipient, body: rendered });

    if (!response.ok) {
      const shouldRetry = response.status >= 500 || response.status === 429;
      await ensureAudit("NOTIFICATION_WHATSAPP_FAILED", {
        to: recipient,
        status: response.status,
        retryable: shouldRetry,
      });
      return shouldRetry
        ? resolveRetry(job, "upstream_error", now)
        : { type: "failed", detail: "send_failed" };
    }

    await ensureAudit("NOTIFICATION_WHATSAPP_SENT", { to: recipient, event: job.event });
    return { type: "success", detail: "delivered" };
  }

  await deps.audit({
    action: "NOTIFICATION_WHATSAPP_SKIPPED",
    entity: "notification_queue",
    entityId: job.id,
    saccoId: job.sacco_id,
    diff: { event: job.event },
  });
  return { type: "failed", detail: "unsupported_event" };
};

export interface EmailJobDeps {
  rateLimit: RateLimiter;
  send: EmailSender;
  audit: AuditLogger;
  now?: () => Date;
}

export const processEmailJob = async (
  job: NotificationJob,
  deps: EmailJobDeps
): Promise<JobOutcome> => {
  const now = deps.now?.() ?? new Date();

  const ensureAudit = async (action: string, diff: Record<string, unknown>) => {
    await deps.audit({
      action,
      entity: "notification_queue",
      entityId: job.id,
      saccoId: job.sacco_id,
      diff,
    });
  };

  if (job.attempts > 0) {
    await ensureAudit("NOTIFICATION_EMAIL_ATTEMPT", { event: job.event, attempt: job.attempts });
  }

  const email = typeof job.payload["email"] === "string" ? job.payload["email"].trim() : null;
  if (!email) {
    await ensureAudit("NOTIFICATION_EMAIL_FAILED", { reason: "missing_email" });
    return { type: "failed", detail: "missing_email" };
  }

  const allowed = await deps.rateLimit(`email:${email.toLowerCase()}`, {
    route: "notifications:email",
    maxHits: 5,
  });
  if (!allowed) {
    await ensureAudit("NOTIFICATION_EMAIL_RATE_LIMIT", { email });
    return resolveRetry(job, "rate_limited", now);
  }

  let subject = typeof job.payload["subject"] === "string" ? job.payload["subject"] : null;
  let text = typeof job.payload["body"] === "string" ? job.payload["body"] : null;

  if (job.event === "MFA_REMINDER") {
    const actor = job.payload["queuedBy"];
    subject = subject ?? "Reminder: enable SACCO+ multi-factor authentication";
    text =
      text ??
      [
        "Hello,",
        "",
        "Your SACCO+ administrator requested that you enable MFA to keep your account secure.",
        "",
        "Visit the security settings page to finish enrollment.",
        "",
        "If you have questions, reply directly to this email.",
        "",
        actor ? `Requested by user ${actor}.` : "— SACCO+ Security",
      ].join("\n");
  }

  if (!subject || !text) {
    await ensureAudit("NOTIFICATION_EMAIL_FAILED", {
      reason: "missing_template",
      event: job.event,
    });
    return { type: "failed", detail: "missing_template" };
  }

  const response = await deps.send({ to: email, subject, text });
  if (!response.ok) {
    const shouldRetry = response.status >= 500 || response.status === 429;
    await ensureAudit("NOTIFICATION_EMAIL_FAILED", {
      email,
      status: response.status,
      retryable: shouldRetry,
    });
    return shouldRetry
      ? resolveRetry(job, "upstream_error", now)
      : { type: "failed", detail: "send_failed" };
  }

  await ensureAudit("NOTIFICATION_EMAIL_SENT", { email, event: job.event });
  return { type: "success", detail: "delivered" };
};
