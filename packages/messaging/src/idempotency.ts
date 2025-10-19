import Redis from "ioredis";
import { IdempotencyConflictError } from "./errors.js";
import { Logger } from "pino";

export type IdempotencyRecord<T extends object = Record<string, unknown>> = {
  key: string;
  status: "pending" | "completed";
  response?: T;
  expiresAt?: number;
};

export type IdempotencyStoreOptions = {
  redisUrl: string;
  ttlSeconds?: number;
  logger?: Logger;
};

export class IdempotencyStore<T extends object = Record<string, unknown>> {
  private readonly redis: Redis;
  private readonly ttlSeconds: number;
  private readonly logger?: Logger;
  private readonly namespace: string;

  constructor(options: IdempotencyStoreOptions & { namespace?: string }) {
    this.redis = new Redis(options.redisUrl, { lazyConnect: true });
    this.ttlSeconds = options.ttlSeconds ?? 24 * 60 * 60;
    this.logger = options.logger;
    this.namespace = options.namespace ?? "idemp";
  }

  private key(key: string) {
    return `${this.namespace}:${key}`;
  }

  async connect() {
    await this.redis.connect();
  }

  async disconnect() {
    await this.redis.quit();
  }

  async execute(key: string, handler: () => Promise<T>): Promise<T> {
    const redisKey = this.key(key);
    const existing = await this.redis.get(redisKey);
    if (existing) {
      const parsed = JSON.parse(existing) as IdempotencyRecord<T>;
      if (parsed.status === "completed" && parsed.response) {
        this.logger?.debug({ msg: "idempotency.hit", key });
        return parsed.response;
      }
      throw new IdempotencyConflictError(`Idempotent operation in progress for key ${key}`);
    }

    const pendingRecord: IdempotencyRecord = {
      key,
      status: "pending",
      expiresAt: Date.now() + this.ttlSeconds * 1000,
    };
    await this.redis.set(redisKey, JSON.stringify(pendingRecord), "EX", this.ttlSeconds, "NX");
    this.logger?.debug({ msg: "idempotency.locked", key });

    try {
      const response = await handler();
      const record: IdempotencyRecord<T> = {
        key,
        status: "completed",
        response,
        expiresAt: Date.now() + this.ttlSeconds * 1000,
      };
      await this.redis.set(redisKey, JSON.stringify(record), "EX", this.ttlSeconds);
      return response;
    } catch (error) {
      await this.redis.del(redisKey);
      throw error;
    }
  }
}
