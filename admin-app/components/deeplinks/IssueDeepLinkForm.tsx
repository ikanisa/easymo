"use client";

import { FormEvent, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastProvider";
import { apiFetch } from "@/lib/api/client";
import { getAdminApiPath } from "@/lib/routes";
import {
  AdminDeeplinkFlow,
  DEFAULT_TTL_DAYS,
  FLOW_DEFINITIONS,
  FlowDefinition,
  FlowField,
} from "./config";
import styles from "./IssueDeepLinkForm.module.css";

interface IssueResponse {
  ok: boolean;
  flow: AdminDeeplinkFlow;
  token: string;
  url: string;
  expiresAt: string;
  msisdnBound: string | null;
  multiUse: boolean;
  ttlMinutes: number;
  payload: Record<string, unknown>;
}

interface IssueErrorDetail {
  error?: string;
  message?: string;
  detail?: string;
  reason?: string;
  details?: unknown;
}

function getDefinition(flow: AdminDeeplinkFlow): FlowDefinition {
  const definition = FLOW_DEFINITIONS.find((entry) => entry.flow === flow);
  if (!definition) {
    throw new Error(`Unknown flow: ${flow}`);
  }
  return definition;
}

function createInitialPayload(flow: AdminDeeplinkFlow) {
  const definition = getDefinition(flow);
  return definition.fields.reduce<Record<string, string>>((acc, field) => {
    acc[field.name] = "";
    return acc;
  }, {});
}

function parseFieldValue(field: FlowField, value: string) {
  if (!value) return undefined;
  if (field.type === "number") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return value;
}

function buildPayload(definition: FlowDefinition, payloadState: Record<string, string>) {
  return definition.fields.reduce<Record<string, unknown>>((acc, field) => {
    const parsed = parseFieldValue(field, payloadState[field.name] ?? "");
    if (parsed !== undefined && parsed !== "") {
      acc[field.name] = parsed;
    }
    return acc;
  }, {});
}

function buildWhatsAppMessage(definition: FlowDefinition, url: string, to: string) {
  return {
    to,
    type: "interactive",
    header: { type: "text", text: definition.label },
    body: { text: definition.previewMessage },
    action: {
      buttons: [
        {
          type: "url",
          url,
          title: definition.buttonTitle,
        },
      ],
    },
  } as const;
}

function normaliseMsisdn(value: string) {
  return value.replace(/\s+/g, "");
}

const MAX_TTL_DAYS = 60;

export function IssueDeepLinkForm() {
  const { pushToast } = useToast();
  const [flow, setFlow] = useState<AdminDeeplinkFlow>("insurance_attach");
  const [payloadState, setPayloadState] = useState<Record<string, string>>(createInitialPayload("insurance_attach"));
  const [msisdn, setMsisdn] = useState("");
  const [multiUse, setMultiUse] = useState(false);
  const [ttlDays, setTtlDays] = useState<number>(DEFAULT_TTL_DAYS);
  const [submitting, setSubmitting] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<IssueResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const definition = useMemo(() => getDefinition(flow), [flow]);

  const handleFlowChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextFlow = event.target.value as AdminDeeplinkFlow;
    setFlow(nextFlow);
    setPayloadState(createInitialPayload(nextFlow));
    setResult(null);
    setError(null);
  };

  const handleFieldChange = (field: FlowField, value: string) => {
    setPayloadState((prev) => ({ ...prev, [field.name]: value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setResult(null);

    const payload = buildPayload(definition, payloadState);
    if (definition.fields.some((field) => field.required && !payload[field.name])) {
      setError("Please fill in all required fields.");
      setSubmitting(false);
      return;
    }

    const ttlMinutes = Math.max(5, Math.round(ttlDays * 24 * 60));
    const requestBody: Record<string, unknown> = {
      flow: definition.flow,
      payload,
      multi_use: multiUse,
      ttl_minutes: ttlMinutes,
    };

    const msisdnClean = msisdn.trim();
    if (msisdnClean) {
      requestBody.msisdn_e164 = normaliseMsisdn(msisdnClean);
    }

    const response = await apiFetch<IssueResponse, typeof requestBody>(
      getAdminApiPath("deeplink", "issue"),
      {
      method: "POST",
      body: requestBody,
    });

    setSubmitting(false);

    if (!response.ok) {
      const problem = response.error as IssueErrorDetail;
      const message =
        typeof problem?.message === "string"
          ? problem.message
          : problem?.error ?? "Failed to issue deep link.";
      setError(message);
      pushToast(message, "error");
      return;
    }

    setResult(response.data);
    pushToast("Deep link issued.", "success");
  };

  const handleCopy = async () => {
    if (!result?.url) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(result.url);
        pushToast("Link copied to clipboard.", "success");
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = result.url;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "absolute";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        pushToast("Link copied to clipboard.", "success");
      }
    } catch (copyError) {
      console.error("deeplink.copy_failed", copyError);
      pushToast("Unable to copy link. Copy it manually instead.", "error");
    }
  };

  const handleSend = async () => {
    if (!result?.url) return;
    const target = normaliseMsisdn(msisdn || result.msisdnBound || "");
    if (!target) {
      setError("Enter a phone number to send the message.");
      return;
    }

    setSending(true);
    setError(null);

    const message = buildWhatsAppMessage(definition, result.url, target);
    const response = await apiFetch(getAdminApiPath("wa", "send"), {
      method: "POST",
      body: message,
    });

    setSending(false);

    if (!response.ok) {
      const problem = response.error as IssueErrorDetail;
      const messageText =
        typeof problem?.message === "string"
          ? problem.message
          : problem?.error ?? "Failed to send WhatsApp message.";
      setError(messageText);
      pushToast(messageText, "error");
      return;
    }

    pushToast("WhatsApp message queued.", "success");
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.grid}>
        <label className={styles.field}>
          <span>Flow</span>
          <select value={flow} onChange={handleFlowChange}>
            {FLOW_DEFINITIONS.map((entry) => (
              <option key={entry.flow} value={entry.flow}>
                {entry.label}
              </option>
            ))}
          </select>
          <small>{definition.description}</small>
        </label>

        <label className={styles.field}>
          <span>Bind to phone number (optional)</span>
          <input
            value={msisdn}
            onChange={(event) => setMsisdn(event.target.value)}
            placeholder="+2507XXXXXXX"
          />
          <small>Only this number can open the deep link when provided.</small>
        </label>

        <label className={styles.field}>
          <span>Expiry (days)</span>
          <input
            type="number"
            min={1}
            max={MAX_TTL_DAYS}
            value={ttlDays}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (!Number.isFinite(next)) {
                setTtlDays(DEFAULT_TTL_DAYS);
                return;
              }
              setTtlDays(Math.min(MAX_TTL_DAYS, Math.max(1, next)));
            }}
          />
          <small>Defaults to 14 days. Maximum {MAX_TTL_DAYS} days.</small>
        </label>

        <label className={`${styles.field} ${styles.checkboxField}`}>
          <span>Allow multiple uses</span>
          <input
            type="checkbox"
            checked={multiUse}
            onChange={(event) => setMultiUse(event.target.checked)}
          />
          <small>Enable for QR demos or broadcast flows.</small>
        </label>
      </div>

      <div className={styles.payloadGrid}>
        {definition.fields.map((field) => (
          <label key={field.name} className={styles.field}>
            <span>
              {field.label}
              {field.required ? " *" : ""}
            </span>
            <input
              type={field.type === "number" ? "number" : "text"}
              value={payloadState[field.name] ?? ""}
              placeholder={field.placeholder}
              onChange={(event) => handleFieldChange(field, event.target.value)}
              required={field.required}
            />
            {field.helperText ? <small>{field.helperText}</small> : null}
          </label>
        ))}
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.actions}>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Issuing…" : "Issue deep link"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={!result?.url || sending}
          onClick={handleSend}
        >
          {sending ? "Sending…" : "Send via WhatsApp"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={!result?.url}
          onClick={handleCopy}
        >
          Copy link
        </Button>
      </div>

      {result ? (
        <div className={styles.result}>
          <div className={styles.resultHeader}>
            <strong>{getDefinition(result.flow).label}</strong>
            <span>Expires {new Date(result.expiresAt).toLocaleString()}</span>
          </div>
          <code className={styles.url}>{result.url}</code>
          <dl className={styles.meta}>
            <div>
              <dt>Token</dt>
              <dd>{result.token}</dd>
            </div>
            <div>
              <dt>Bound MSISDN</dt>
              <dd>{result.msisdnBound ?? 'Any user'}</dd>
            </div>
            <div>
              <dt>Multi-use</dt>
              <dd>{result.multiUse ? 'Yes' : 'No'}</dd>
            </div>
          </dl>
        </div>
      ) : null}
    </form>
  );
}
