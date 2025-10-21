"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdempotencyStore = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const errors_js_1 = require("./errors.js");
class IdempotencyStore {
    constructor(options) {
        this.redis = new ioredis_1.default(options.redisUrl, { lazyConnect: true });
        this.ttlSeconds = options.ttlSeconds ?? 24 * 60 * 60;
        this.logger = options.logger;
        this.namespace = options.namespace ?? "idemp";
    }
    key(key) {
        return `${this.namespace}:${key}`;
    }
    async connect() {
        await this.redis.connect();
    }
    async disconnect() {
        await this.redis.quit();
    }
    async execute(key, handler) {
        const redisKey = this.key(key);
        const existing = await this.redis.get(redisKey);
        if (existing) {
            const parsed = JSON.parse(existing);
            if (parsed.status === "completed" && parsed.response) {
                this.logger?.debug({ msg: "idempotency.hit", key });
                return parsed.response;
            }
            throw new errors_js_1.IdempotencyConflictError(`Idempotent operation in progress for key ${key}`);
        }
        const pendingRecord = {
            key,
            status: "pending",
            expiresAt: Date.now() + this.ttlSeconds * 1000,
        };
        await this.redis.set(redisKey, JSON.stringify(pendingRecord), "EX", this.ttlSeconds, "NX");
        this.logger?.debug({ msg: "idempotency.locked", key });
        try {
            const response = await handler();
            const record = {
                key,
                status: "completed",
                response,
                expiresAt: Date.now() + this.ttlSeconds * 1000,
            };
            await this.redis.set(redisKey, JSON.stringify(record), "EX", this.ttlSeconds);
            return response;
        }
        catch (error) {
            await this.redis.del(redisKey);
            throw error;
        }
    }
}
exports.IdempotencyStore = IdempotencyStore;
