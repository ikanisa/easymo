import { KafkaConsumer, KafkaFactory, KafkaProducer } from "@easymo/messaging";

import { config } from "./config.js";
import { logger } from "./logger.js";
import { WebhookPayload, WebhookProcessingResult,WebhookProcessor } from "./processor.js";

/**
 * Kafka-based webhook worker
 * Consumes webhook events from Kafka topic and processes them
 */
export class WebhookWorker {
  private kafkaFactory: any;
  private consumer!: any;
  private producer!: any;
  private processor: WebhookProcessor;
  private isRunning = false;

  // Metrics
  private metrics = {
    processed: 0,
    failed: 0,
    retried: 0,
    deadLettered: 0,
  };

  constructor() {
    this.kafkaFactory = new KafkaFactory({
      clientId: config.KAFKA_CLIENT_ID,
      brokers: config.KAFKA_BROKERS.split(","),
      logger,
    });

    this.processor = new WebhookProcessor();
  }

  async start(): Promise<void> {
    logger.info("Starting WebhookWorker...");

    // Initialize Kafka consumer and producer
    this.consumer = this.kafkaFactory.createConsumer({
      options: { groupId: config.KAFKA_GROUP_ID },
      logger,
    });

    this.producer = this.kafkaFactory.createProducer({ logger });

    await this.consumer.connect();
    await this.producer.connect();
    await this.processor.connect();

    await this.consumer.subscribe(config.WEBHOOK_TOPIC);

    this.isRunning = true;

    // Start consuming messages
    await this.consumer.run({
      autoCommit: false,
      eachMessage: async ({ topic, partition, message }: any) => {
        if (!this.isRunning) return;

        const correlationId = message.headers?.["x-correlation-id"]?.toString() || 
                             message.headers?.["x-message-id"]?.toString();

        try {
          const payload = this.parseMessage(message);
          const result = await this.processWithRetry(payload);

          if (result.success) {
            // Publish to processed topic
            await this.publishProcessed(payload, result);
            await this.consumer.commitOffsets([
              { topic, partition, offset: (Number(message.offset) + 1).toString() },
            ]);
            this.metrics.processed++;
          } else {
            // Check if we should retry or send to DLQ
            const retryCount = payload.retryCount || 0;
            if (retryCount < config.MAX_RETRIES) {
              await this.publishForRetry(payload, retryCount + 1);
              await this.consumer.commitOffsets([
                { topic, partition, offset: (Number(message.offset) + 1).toString() },
              ]);
              this.metrics.retried++;
            } else {
              // Send to dead letter queue
              await this.publishToDLQ(payload, result.error || "Max retries exceeded");
              await this.consumer.commitOffsets([
                { topic, partition, offset: (Number(message.offset) + 1).toString() },
              ]);
              this.metrics.deadLettered++;
            }
            this.metrics.failed++;
          }

          // Log metrics every 100 messages
          if ((this.metrics.processed + this.metrics.failed) % 100 === 0) {
            this.logMetrics();
          }
        } catch (error) {
          logger.error({
            msg: "webhook.worker.error",
            error: error instanceof Error ? error.message : String(error),
            correlationId,
            topic,
            partition,
            offset: message.offset,
          });
          // Don't commit offset on unexpected errors - let Kafka retry
        }
      },
    });
  }

  async stop(): Promise<void> {
    logger.info("Stopping WebhookWorker...");
    this.isRunning = false;

    await this.consumer.disconnect();
    await this.producer.disconnect();
    await this.processor.disconnect();

    this.logMetrics();
    logger.info("WebhookWorker stopped");
  }

  private parseMessage(message: any): WebhookPayload {
    const value = message.value?.toString();
    if (!value) {
      throw new Error("Empty message value");
    }

    const parsed = JSON.parse(value);
    return {
      id: parsed.id || message.headers?.["x-message-id"]?.toString(),
      headers: parsed.headers || {},
      body: parsed.body,
      timestamp: parsed.timestamp || new Date().toISOString(),
      retryCount: parsed.retryCount || 0,
    };
  }

  private async processWithRetry(payload: WebhookPayload): Promise<WebhookProcessingResult> {
    // Add exponential backoff for retries
    if (payload.retryCount && payload.retryCount > 0) {
      const delay = config.RETRY_DELAY_MS * Math.pow(2, payload.retryCount - 1);
      logger.info({
        msg: "webhook.retry.delay",
        webhookId: payload.id,
        retryCount: payload.retryCount,
        delayMs: delay,
      });
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    return await this.processor.process(payload);
  }

  private async publishProcessed(
    payload: WebhookPayload,
    result: WebhookProcessingResult
  ): Promise<void> {
    await this.producer.send({
      topic: config.WEBHOOK_PROCESSED_TOPIC,
      messages: [
        {
          key: payload.id,
          value: JSON.stringify({
            webhookId: payload.id,
            success: true,
            duration: result.duration,
            timestamp: new Date().toISOString(),
          }),
          headers: {
            "x-correlation-id": payload.headers["x-correlation-id"] || payload.id,
          },
        },
      ],
    });
  }

  private async publishForRetry(payload: WebhookPayload, retryCount: number): Promise<void> {
    logger.info({
      msg: "webhook.retry.scheduled",
      webhookId: payload.id,
      retryCount,
    });

    await this.producer.send({
      topic: config.WEBHOOK_TOPIC,
      messages: [
        {
          key: payload.id,
          value: JSON.stringify({
            ...payload,
            retryCount,
          }),
          headers: {
            "x-correlation-id": payload.headers["x-correlation-id"] || payload.id,
            "x-retry-count": retryCount.toString(),
          },
        },
      ],
    });
  }

  private async publishToDLQ(payload: WebhookPayload, error: string): Promise<void> {
    logger.warn({
      msg: "webhook.dlq.sent",
      webhookId: payload.id,
      error,
      retryCount: payload.retryCount,
    });

    await this.producer.send({
      topic: config.WEBHOOK_DLQ_TOPIC,
      messages: [
        {
          key: payload.id,
          value: JSON.stringify({
            ...payload,
            error,
            deadLetteredAt: new Date().toISOString(),
          }),
          headers: {
            "x-correlation-id": payload.headers["x-correlation-id"] || payload.id,
            "x-dlq-reason": error,
          },
        },
      ],
    });
  }

  private logMetrics(): void {
    logger.info({
      msg: "webhook.worker.metrics",
      processed: this.metrics.processed,
      failed: this.metrics.failed,
      retried: this.metrics.retried,
      deadLettered: this.metrics.deadLettered,
      successRate: this.metrics.processed / (this.metrics.processed + this.metrics.failed) || 0,
    });
  }

  getMetrics() {
    return { ...this.metrics };
  }

  isStarted() {
    return this.isRunning;
  }
}
