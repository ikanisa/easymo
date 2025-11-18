import { WA_PHONE_ID, WA_TOKEN } from "../config.ts";
import { delay, fetchWithTimeout } from "../utils/http.ts";

export class WhatsAppClientError extends Error {
  readonly status: number;
  readonly detail: string;

  constructor(status: number, detail: string) {
    super(`WhatsApp request failed (${status}): ${detail}`);
    this.status = status;
    this.detail = detail;
  }
}
import {
  safeButtonTitle,
  safeHeaderText,
  safeRowDesc,
  safeRowTitle,
} from "../utils/text.ts";
import {
  previewListPayload,
  validateListMessage,
  WA_LIMITS_CONST,
} from "../utils/wa_validate.ts";

const GRAPH_BASE = "https://graph.facebook.com/v20.0";
const STATUS_RETRY_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);
const STATUS_RETRIES = Math.max(
  Number(Deno.env.get("WA_HTTP_STATUS_RETRIES") ?? "2") || 2,
  0,
);
const STATUS_RETRY_DELAY_MS = Math.max(
  Number(Deno.env.get("WA_HTTP_STATUS_RETRY_DELAY_MS") ?? "400") || 400,
  0,
);

async function post(payload: unknown): Promise<void> {
  let attempt = 0;
  while (attempt <= STATUS_RETRIES) {
    const res = await fetchWithTimeout(
      `${GRAPH_BASE}/${WA_PHONE_ID}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${WA_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );
    if (res.ok) return;
    const text = await res.text();
    console.error("wa_client.send_fail", res.status, text);
    if (attempt >= STATUS_RETRIES || !STATUS_RETRY_CODES.has(res.status)) {
      throw new WhatsAppClientError(res.status, text);
    }
    if (STATUS_RETRY_DELAY_MS > 0) {
      await delay(STATUS_RETRY_DELAY_MS * Math.max(attempt, 1));
    }
    attempt += 1;
  }
}

export async function sendText(to: string, body: string): Promise<void> {
  await post({
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body },
  });
}

export async function sendButtons(
  to: string,
  body: string,
  buttons: Array<{ id: string; title: string }>,
): Promise<void> {
  if ((Deno.env.get("LOG_LEVEL") ?? "").toLowerCase() === "debug") {
    console.debug("wa.payload.buttons_preview", {
      bodyPreview: body?.slice(0, 40),
      count: buttons?.length ?? 0,
      buttons: buttons.slice(0, 3).map((b) => ({
        id: b.id,
        title: b.title.slice(0, 20),
      })),
    });
  }
  await post({
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: body.slice(0, 1024) },
      action: {
        buttons: buttons.slice(0, 3).map((btn) => ({
          type: "reply",
          reply: { id: btn.id, title: safeButtonTitle(btn.title) },
        })),
      },
    },
  });
}

export async function sendList(
  to: string,
  opts: {
    title: string;
    body: string;
    buttonText?: string;
    sectionTitle?: string;
    rows?: Array<{ id: string; title: string; description?: string }>;
    sections?: Array<{
      title: string;
      rows: Array<{ id: string; title: string; description?: string }>;
    }>;
  },
): Promise<void> {
  const headerText = safeHeaderText(opts.title ?? "", WA_LIMITS_CONST.HEADER_TEXT);
  const baseSectionTitle = safeHeaderText(
    opts.sectionTitle ?? "",
    WA_LIMITS_CONST.SECTION_TITLE,
  ) || "Options";
  const bodyText = (opts.body ?? "").slice(0, WA_LIMITS_CONST.BODY).trim();
  const buttonText = safeButtonTitle(opts.buttonText ?? "Choose");
  const sectionsInput = Array.isArray(opts.sections) && opts.sections.length
    ? opts.sections
    : [{
      title: baseSectionTitle,
      rows: opts.rows ?? [],
    }];
  const sections = sectionsInput.map((section) => ({
    title: safeHeaderText(section.title ?? "", WA_LIMITS_CONST.SECTION_TITLE) ||
      baseSectionTitle,
    rows: (section.rows ?? []).slice(0, WA_LIMITS_CONST.MAX_ROWS_PER_SECTION)
      .map((row) => ({
        id: row.id,
        title: safeRowTitle(row.title),
        description: row.description ? safeRowDesc(row.description) : undefined,
      })),
  }));

  // Validate and optionally preview payload
  const issues = validateListMessage({
    title: headerText,
    body: bodyText,
    buttonText,
    sections,
  });
  if (issues.length) console.warn("wa_client.validate_warn", { issues });
  if ((Deno.env.get("LOG_LEVEL") ?? "").toLowerCase() === "debug") {
    console.debug(
      "wa.payload.list_preview",
      previewListPayload({
        title: headerText,
        body: bodyText,
        buttonText,
        sections,
      }),
    );
  }
  const headerPayload = headerText
    ? { type: "text", text: headerText }
    : null;
  await post({
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "list",
      ...(headerPayload ? { header: headerPayload } : {}),
      body: { text: bodyText },
      action: {
        button: buttonText,
        sections,
      },
    },
  });
}

export async function sendTemplate(
  to: string,
  opts: {
    name: string;
    language: string;
    templateId?: string;
    bodyParameters?: Array<{ type: "text"; text: string }>;
  },
): Promise<void> {
  const templatePayload: Record<string, unknown> = {
    name: opts.name,
    language: { code: opts.language },
  };

  if (opts.templateId) {
    templatePayload.template_id = opts.templateId;
  }

  if (opts.bodyParameters && opts.bodyParameters.length) {
    templatePayload.components = [
      {
        type: "body",
        parameters: opts.bodyParameters.map((param) => ({
          type: param.type,
          text: param.text,
        })),
      },
    ];
  }

  await post({
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: templatePayload,
  });
}

export async function sendImageUrl(
  to: string,
  link: string,
  caption?: string,
): Promise<void> {
  await post({
    messaging_product: "whatsapp",
    to,
    type: "image",
    image: { link, caption: caption?.slice(0, 1024) },
  });
}

export async function sendFlowMessage(
  to: string,
  flowId: string,
  options: { languageCode?: string; metadata?: Record<string, unknown> } = {},
): Promise<void> {
  const flowPayload: Record<string, unknown> = {
    name: flowId,
    language: { code: options.languageCode ?? "en" },
  };
  if (options.metadata && Object.keys(options.metadata).length) {
    flowPayload.metadata = options.metadata;
  }
  await post({
    messaging_product: "whatsapp",
    to,
    type: "flow",
    flow: flowPayload,
  });
}
