import { TelemetryCollector } from "./telemetry.ts";
import type {
  KeywordMapping,
  NormalizedMessage,
  ProcessedMessageResult,
  RouteDestination,
  RouterRepository,
  WhatsAppWebhookPayload,
} from "./types.ts";

const encoder = new TextEncoder();

export interface RouterServiceOptions {
  verifyToken: string;
  appSecret: string;
  routerEnabled: boolean;
  rateLimitWindowSeconds: number;
  rateLimitMaxMessages: number;
}

export class RouterService {
  private pendingFanouts: Promise<void>[] = [];

  constructor(
    private readonly repository: RouterRepository,
    private readonly options: RouterServiceOptions,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async handleRequest(req: Request): Promise<Response> {
    const correlationId = crypto.randomUUID();
    try {
      if (!this.options.routerEnabled) {
        this.logEvent("ROUTER_DISABLED", { correlationId });
        return new Response("Service Unavailable", { status: 503 });
      }

      if (req.method === "GET") {
        return this.handleVerification(req, correlationId);
      }

      if (req.method !== "POST") {
        this.logEvent("INVALID_METHOD", { correlationId, method: req.method });
        return new Response("Method Not Allowed", { status: 405 });
      }

      const rawBody = await req.text();
      this.logEvent("REQUEST_RECEIVED", { correlationId, bodySize: rawBody.length });

      if (!await this.verifySignature(req, rawBody)) {
        this.logEvent("SIGNATURE_VERIFICATION_FAILED", { correlationId });
        return new Response("Unauthorized", { status: 401 });
      }

      let payload: WhatsAppWebhookPayload;
      try {
        payload = JSON.parse(rawBody);
      } catch (error) {
        this.logEvent("JSON_PARSE_ERROR", { correlationId, error: String(error) });
        return new Response("Bad Request", { status: 400 });
      }

      return await this.handleWebhookPayload(payload, correlationId);
    } catch (error) {
      this.logEvent("UNHANDLED_ERROR", {
        correlationId,
        error: String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return new Response("ok", { status: 200 });
    }
  }

  async drainFanouts(): Promise<void> {
    if (this.pendingFanouts.length === 0) return;
    const tasks = [...this.pendingFanouts];
    this.pendingFanouts = [];
    await Promise.allSettled(tasks);
  }

  private async handleVerification(req: Request, correlationId: string): Promise<Response> {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    this.logEvent("WEBHOOK_VERIFICATION_REQUEST", {
      correlationId,
      mode,
      token: token ? "present" : "missing",
    });

    if (mode === "subscribe" && token === this.options.verifyToken) {
      this.logEvent("WEBHOOK_VERIFICATION_SUCCESS", { correlationId });
      return new Response(challenge ?? "", { status: 200 });
    }

    this.logEvent("WEBHOOK_VERIFICATION_FAILED", { correlationId, reason: "invalid_token" });
    return new Response("Forbidden", { status: 403 });
  }

  private async handleWebhookPayload(payload: WhatsAppWebhookPayload, correlationId: string): Promise<Response> {
    const telemetry = new TelemetryCollector();
    const normalizedMessages = normalizePayload(payload);
    this.logEvent("PAYLOAD_NORMALIZED", { correlationId, messageCount: normalizedMessages.length });

    if (normalizedMessages.length === 0) {
      this.logEvent("NO_MESSAGES_FOUND", { correlationId });
      return new Response("ok", { status: 200 });
    }

    const [keywordMappings, destinations] = await Promise.all([
      this.repository.loadKeywordMappings(),
      this.repository.loadDestinations(),
    ]);

    const fanoutTasks: Promise<void>[] = [];

    for (const message of normalizedMessages) {
      telemetry.recordReceived();
    const processResult = await this.processMessage(
      message,
      keywordMappings,
      destinations,
      telemetry,
      correlationId,
    );

      if (processResult.outcome === "routed" && processResult.destinations) {
        const task = this.executeFanout(
          message,
          payload,
          processResult.routeKey!,
          processResult.destinations,
          telemetry,
          correlationId,
        );
        fanoutTasks.push(task);
      }
    }

    const summaryPromise = (async () => {
      await Promise.allSettled(fanoutTasks);
      this.logEvent("ROUTER_TELEMETRY", {
        correlationId,
        ...telemetry.snapshot(),
      });
    })();

    summaryPromise.catch((error) => {
      this.logEvent("TELEMETRY_FLUSH_FAILED", { correlationId, error: String(error) });
    });

    this.pendingFanouts.push(summaryPromise);

    this.logEvent("REQUEST_ACKNOWLEDGED", {
      correlationId,
      messages: normalizedMessages.length,
    });

    return new Response("ok", { status: 200 });
  }

  private async processMessage(
    message: NormalizedMessage,
    keywordMappings: KeywordMapping[],
    destinations: RouteDestination[],
    telemetry: TelemetryCollector,
    correlationId: string,
  ): Promise<ProcessedMessageResult> {
    const { routeKey, matchedKeyword } = resolveRoute(message, keywordMappings);

    if (!routeKey) {
      telemetry.recordUnknownKeyword(matchedKeyword ?? message.keywordCandidate);
      await this.repository.recordRouterLog({
        messageId: message.messageId,
        routeKey: undefined,
        status: "unmatched",
        textSnippet: message.text,
        metadata: { correlationId, reason: "no_route" },
      });
      return { messageId: message.messageId, outcome: "unmatched" };
    }

    const allowedDestinations = destinations
      .filter((destination) => destination.routeKey === routeKey)
      .sort((a, b) => a.priority - b.priority)
      .map((destination) => destination.destinationUrl);

    const uniqueDestinations = Array.from(new Set(allowedDestinations));

    if (uniqueDestinations.length === 0) {
      telemetry.recordUnknownKeyword(routeKey);
      await this.repository.recordRouterLog({
        messageId: message.messageId,
        routeKey,
        status: "unmatched",
        textSnippet: message.text,
        metadata: { correlationId, reason: "no_destination" },
      });
      return { messageId: message.messageId, outcome: "unmatched" };
    }

    const rateLimit = await this.repository.checkRateLimit(
      message.from,
      this.options.rateLimitWindowSeconds,
      this.options.rateLimitMaxMessages,
    );

    if (!rateLimit.allowed) {
      telemetry.recordRateLimited();
      await this.repository.recordRouterLog({
        messageId: message.messageId,
        routeKey,
        status: "rate_limited",
        textSnippet: message.text,
        metadata: {
          correlationId,
          currentCount: rateLimit.currentCount,
          windowSeconds: this.options.rateLimitWindowSeconds,
        },
      });
      return { messageId: message.messageId, outcome: "rate_limited", routeKey };
    }

    const claimed = await this.repository.claimMessage(
      message.messageId,
      message.from,
      routeKey,
      {
        correlationId,
        matchedKeyword,
        rateLimitCount: rateLimit.currentCount,
      },
    );

    if (!claimed) {
      telemetry.recordDuplicate();
      await this.repository.recordRouterLog({
        messageId: message.messageId,
        routeKey,
        status: "duplicate",
        textSnippet: message.text,
        metadata: { correlationId },
      });
      return { messageId: message.messageId, outcome: "duplicate", routeKey };
    }

    telemetry.recordRouted(uniqueDestinations.length);

    await this.repository.recordRouterLog({
      messageId: message.messageId,
      routeKey,
      status: "accepted",
      textSnippet: message.text,
      metadata: {
        correlationId,
        matchedKeyword,
        destinations: uniqueDestinations,
      },
    });

    return {
      messageId: message.messageId,
      outcome: "routed",
      routeKey,
      destinations: uniqueDestinations,
    };
  }

  private async executeFanout(
    message: NormalizedMessage,
    originalPayload: WhatsAppWebhookPayload,
    routeKey: string,
    destinations: string[],
    telemetry: TelemetryCollector,
    correlationId: string,
  ): Promise<void> {
    try {
      const fanoutResults = await Promise.allSettled(
        destinations.map(async (destination) => {
          try {
            const response = await this.fetcher(destination, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-correlation-id": correlationId,
              },
              body: JSON.stringify({
                normalized: message,
                original: originalPayload,
              }),
            });

            if (!response.ok) {
              telemetry.recordDownstreamError(destination, response.status, response.statusText);
            }

            return {
              destination,
              status: response.status,
              ok: response.ok,
            };
          } catch (error) {
            const messageText = error instanceof Error ? error.message : String(error);
            telemetry.recordDownstreamError(destination, 0, messageText);
            return {
              destination,
              status: 0,
              ok: false,
              error: messageText,
            };
          }
        }),
      );

      const responses = fanoutResults.map((result) =>
        result.status === "fulfilled" ? result.value : {
          destination: "unknown",
          status: 0,
          ok: false,
          error: result.reason ? String(result.reason) : "rejected",
        }
      );

      const successful = responses.some((response) => response.ok);

      await this.repository.recordRouterLog({
        messageId: message.messageId,
        routeKey,
        status: successful ? "routed" : "error",
        textSnippet: message.text,
        metadata: {
          correlationId,
          destinations,
          responses,
        },
      });
    } catch (error) {
      this.logEvent("FANOUT_FAILED", { correlationId, error: String(error) });
    }
  }

  private async verifySignature(req: Request, rawBody: string): Promise<boolean> {
    if (!this.options.appSecret) {
      return false;
    }

    const signatureHeader = req.headers.get("x-hub-signature-256") ?? "";
    if (!signatureHeader.startsWith("sha256=")) {
      return false;
    }

    const providedHex = signatureHeader.slice(7);
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(this.options.appSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );

    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(rawBody),
    );
    const computedHex = bufferToHex(signatureBuffer);
    return timingSafeEqual(providedHex, computedHex);
  }

  private logEvent(event: string, data: Record<string, unknown>): void {
    console.log(JSON.stringify({ event, timestamp: new Date().toISOString(), ...data }));
  }
}

export function normalizePayload(payload: WhatsAppWebhookPayload): NormalizedMessage[] {
  const normalized: NormalizedMessage[] = [];
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value) continue;
      const metadata = value.metadata;
      const messages = value.messages ?? [];
      for (const msg of messages) {
        const base: NormalizedMessage = {
          from: msg.from,
          messageId: msg.id,
          type: msg.type,
          metadata: {
            phoneNumberId: metadata?.phone_number_id,
            displayPhoneNumber: metadata?.display_phone_number,
          },
        };

        if (msg.type === "text" && msg.text?.body) {
          base.text = msg.text.body;
          base.keywordCandidate = msg.text.body;
        }

        if (msg.type === "interactive" && msg.interactive) {
          if (msg.interactive.button_reply) {
            base.interactive = {
              type: "button_reply",
              id: msg.interactive.button_reply.id,
              title: msg.interactive.button_reply.title,
            };
            base.keywordCandidate = msg.interactive.button_reply.id;
          } else if (msg.interactive.list_reply) {
            base.interactive = {
              type: "list_reply",
              id: msg.interactive.list_reply.id,
              title: msg.interactive.list_reply.title,
            };
            base.keywordCandidate = msg.interactive.list_reply.id;
          }
        }

        if (msg.type === "image" && msg.image) {
          base.media = { type: "image", id: msg.image.id, caption: msg.image.caption };
          if (msg.image.caption) {
            base.keywordCandidate = msg.image.caption;
          }
        }

        if (msg.type === "document" && msg.document) {
          base.media = { type: "document", id: msg.document.id, caption: msg.document.caption };
          if (msg.document.caption) {
            base.keywordCandidate = msg.document.caption;
          }
        }

        normalized.push(base);
      }
    }
  }
  return normalized;
}

export function resolveRoute(
  message: NormalizedMessage,
  keywordMappings: KeywordMapping[],
): { routeKey?: string; matchedKeyword?: string } {
  if (keywordMappings.length === 0) {
    return {};
  }

  const candidates = collectCandidateKeywords(message);
  if (candidates.length === 0) {
    return {};
  }

  for (const candidate of candidates) {
    for (const mapping of keywordMappings) {
      if (candidate === mapping.keyword) {
        return { routeKey: mapping.routeKey, matchedKeyword: mapping.keyword };
      }
    }
  }

  return {};
}

function collectCandidateKeywords(message: NormalizedMessage): string[] {
  const rawCandidates: string[] = [];
  if (message.keywordCandidate) rawCandidates.push(message.keywordCandidate);
  if (message.text) rawCandidates.push(message.text);
  if (message.interactive?.id) rawCandidates.push(message.interactive.id);
  if (message.interactive?.title) rawCandidates.push(message.interactive.title);
  if (message.media?.caption) rawCandidates.push(message.media.caption);

  const normalized = new Set<string>();
  for (const candidate of rawCandidates) {
    const lower = candidate.toLowerCase();
    normalized.add(lower.trim());
    for (const token of lower.split(/[^a-z0-9]+/g)) {
      if (token) normalized.add(token);
    }
  }
  return Array.from(normalized).filter(Boolean);
}

function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const hex: string[] = [];
  for (const byte of bytes) {
    hex.push(byte.toString(16).padStart(2, "0"));
  }
  return hex.join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
