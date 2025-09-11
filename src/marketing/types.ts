export type QueueStatus = "PENDING" | "SENT" | "FAILED" | "SKIPPED";

export type QPayload =
  | { kind: "TEXT"; text: string }
  | { kind: "TEMPLATE"; name: string; language_code: string; components: any[] }
  | { kind: "INTERACTIVE"; interactive: any };

export type SendQueueRow = {
  id: number;
  campaign_id: number | null;
  msisdn_e164: string;
  payload: QPayload;
  attempt: number;
  next_attempt_at: string;
  status: QueueStatus;
};

export type SendLogRow = {
  id: number;
  queue_id: number;
  campaign_id: number | null;
  msisdn_e164: string;
  sent_at: string | null;
  provider_msg_id: string | null;
  delivery_status: string | null;
  error: string | null;
};