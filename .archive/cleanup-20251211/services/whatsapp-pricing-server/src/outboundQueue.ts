import { childLogger } from '@easymo/commons';
import { randomUUID } from "crypto";
import PQueue from "p-queue";
import pRetry from "p-retry";

import { maskMsisdn } from "./utils/pii";

const log = childLogger({ service: 'whatsapp-pricing-server' });

type QueueMeta = {
  to: string;
  type: string;
  correlationId?: string;
};

const DEFAULT_CONCURRENCY = Number(process.env.WHATSAPP_QUEUE_CONCURRENCY ?? "4");
const DEFAULT_INTERVAL_CAP = Number(process.env.WHATSAPP_QUEUE_RATE_CAP ?? "20");
const DEFAULT_INTERVAL = Number(process.env.WHATSAPP_QUEUE_INTERVAL_MS ?? "1000");
const DEFAULT_RETRIES = Number(process.env.WHATSAPP_QUEUE_RETRIES ?? "2");

class OutboundMessageQueue {
  private queue: PQueue;

  constructor() {
    this.queue = new PQueue({
      concurrency: Number.isFinite(DEFAULT_CONCURRENCY) ? DEFAULT_CONCURRENCY : 4,
      intervalCap: Number.isFinite(DEFAULT_INTERVAL_CAP) ? DEFAULT_INTERVAL_CAP : 20,
      interval: Number.isFinite(DEFAULT_INTERVAL) ? DEFAULT_INTERVAL : 1000,
      carryoverConcurrencyCount: true,
    });
  }

  async enqueue(meta: QueueMeta, task: () => Promise<void>): Promise<void> {
    const correlationId = meta.correlationId ?? randomUUID();
    const retries = Number.isFinite(DEFAULT_RETRIES) ? Math.max(0, DEFAULT_RETRIES) : 2;
    const maskedRecipient = maskMsisdn(meta.to);

    log.info("outbound.queue.schedule", {
      correlationId,
      to: maskedRecipient,
      type: meta.type,
    });

    await this.queue.add(() =>
      pRetry(task, {
        retries,
        onFailedAttempt: (error) => {
          log.warn("outbound.queue.retry", {
            correlationId,
            to: maskedRecipient,
            attempt: error.attemptNumber,
            retriesLeft: error.retriesLeft,
            reason: error.message,
          });
        },
      }),
    );

    log.info("outbound.queue.delivered", {
      correlationId,
      to: maskedRecipient,
      type: meta.type,
    });
  }
}

const outboundQueue = new OutboundMessageQueue();

export function getOutboundQueue(): OutboundMessageQueue {
  return outboundQueue;
}

export async function enqueueOutboundSend(meta: QueueMeta, task: () => Promise<void>): Promise<void> {
  await outboundQueue.enqueue(meta, task);
}
