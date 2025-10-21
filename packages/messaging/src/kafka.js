"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KafkaConsumer = exports.KafkaProducer = exports.KafkaFactory = void 0;
const kafkajs_1 = require("kafkajs");
const lodash_merge_1 = __importDefault(require("lodash.merge"));
const ulid_1 = require("ulid");
class KafkaFactory {
    constructor(options) {
        this.config = options;
    }
    ensureClient() {
        if (this.kafka)
            return this.kafka;
        const kafka = new kafkajs_1.Kafka({
            clientId: this.config.clientId,
            brokers: this.config.brokers,
            ssl: this.config.ssl,
            sasl: this.config.sasl,
            retry: this.config.retry,
            logLevel: kafkajs_1.logLevel.ERROR,
        });
        this.kafka = kafka;
        return kafka;
    }
    createProducer(config) {
        const client = this.ensureClient();
        return new KafkaProducer(client.producer(config?.options), config?.logger ?? this.config.logger);
    }
    createConsumer(config) {
        const client = this.ensureClient();
        return new KafkaConsumer(client.consumer(config.options), config.logger ?? this.config.logger);
    }
}
exports.KafkaFactory = KafkaFactory;
class KafkaProducer {
    constructor(producer, logger) {
        this.producer = producer;
        this.logger = logger;
    }
    async connect() {
        await this.producer.connect();
        this.logger?.info({ msg: "kafka.producer.connected" });
    }
    async disconnect() {
        await this.producer.disconnect();
        this.logger?.info({ msg: "kafka.producer.disconnected" });
    }
    async send(record) {
        const enrichedRecord = (0, lodash_merge_1.default)({}, record, {
            messages: (record.messages ?? []).map((message) => {
                const headers = {
                    "x-produced-at": new Date().toISOString(),
                    "x-message-id": message.headers?.["x-message-id"] ?? (0, ulid_1.ulid)(),
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
            messageId: firstHeaders["x-message-id"],
        });
        await this.producer.send(enrichedRecord);
    }
}
exports.KafkaProducer = KafkaProducer;
class KafkaConsumer {
    constructor(consumer, logger) {
        this.consumer = consumer;
        this.logger = logger;
    }
    async connect() {
        await this.consumer.connect();
        this.logger?.info({ msg: "kafka.consumer.connected" });
    }
    async disconnect() {
        await this.consumer.disconnect();
        this.logger?.info({ msg: "kafka.consumer.disconnected" });
    }
    async subscribe(topic, fromBeginning = false) {
        await this.consumer.subscribe({ topic, fromBeginning });
        this.logger?.info({ msg: "kafka.consumer.subscribe", topic });
    }
    async run(config) {
        await this.consumer.run(config);
    }
}
exports.KafkaConsumer = KafkaConsumer;
