import { Kafka, KafkaConfig, Producer, Consumer, logLevel, ProducerRecord, ConsumerRunConfig } from "kafkajs";
import merge from "lodash.merge";
import { Logger } from "pino";
import { ulid } from "ulid";

export type KafkaFactoryOptions = {
  clientId: string;
  brokers: string[];
  ssl?: boolean;
  sasl?: KafkaConfig["sasl"];
  retry?: KafkaConfig["retry"];
  logger?: Logger;
};

export class KafkaFactory {
  private readonly config: KafkaFactoryOptions;
  private kafka?: Kafka;

  constructor(options: KafkaFactoryOptions) {
    this.config = options;
  }

  private ensureClient() {
    if (this.kafka) return this.kafka;
    const kafka = new Kafka({
      clientId: this.config.clientId,
      brokers: this.config.brokers,
      ssl: this.config.ssl,
      sasl: this.config.sasl,
      retry: this.config.retry,
      logLevel: logLevel.ERROR,
    });
    this.kafka = kafka;
    return kafka;
  }

  createProducer(config?: ProducerConfig): KafkaProducer {
    const client = this.ensureClient();
    return new KafkaProducer(client.producer(config?.options), config?.logger ?? this.config.logger);
  }

  createConsumer(config: ConsumerConfig): KafkaConsumer {
    const client = this.ensureClient();
    return new KafkaConsumer(client.consumer(config.options), config.logger ?? this.config.logger);
  }
}

export type ProducerConfig = {
  options?: Parameters<Kafka["producer"]>[0];
  logger?: Logger;
};

export type ConsumerConfig = {
  options: Parameters<Kafka["consumer"]>[0];
  logger?: Logger;
};

export class KafkaProducer {
  constructor(private readonly producer: Producer, private readonly logger?: Logger) {}

  async connect() {
    await this.producer.connect();
    this.logger?.info({ msg: "kafka.producer.connected" });
  }

  async disconnect() {
    await this.producer.disconnect();
    this.logger?.info({ msg: "kafka.producer.disconnected" });
  }

  async send(record: ProducerRecord) {
    const enrichedRecord: ProducerRecord = merge({}, record, {
      messages: (record.messages ?? []).map((message) => {
        const headers = {
          "x-produced-at": new Date().toISOString(),
          "x-message-id": message.headers?.["x-message-id"] ?? ulid(),
          ...message.headers,
        };
        return {
          ...message,
          headers,
        };
      }),
    });
    const firstHeaders = enrichedRecord.messages?.[0]?.headers ?? {};
    this.logger?.debug({
      msg: "kafka.producer.send",
      topic: record.topic,
      messageId: (firstHeaders as Record<string, string>)["x-message-id"],
    });
    await this.producer.send(enrichedRecord);
  }
}

export class KafkaConsumer {
  constructor(private readonly consumer: Consumer, private readonly logger?: Logger) {}

  async connect() {
    await this.consumer.connect();
    this.logger?.info({ msg: "kafka.consumer.connected" });
  }

  async disconnect() {
    await this.consumer.disconnect();
    this.logger?.info({ msg: "kafka.consumer.disconnected" });
  }

  async subscribe(topic: string, fromBeginning = false) {
    await this.consumer.subscribe({ topic, fromBeginning });
    this.logger?.info({ msg: "kafka.consumer.subscribe", topic });
  }

  async run(config: ConsumerRunConfig) {
    await this.consumer.run(config);
  }
}
