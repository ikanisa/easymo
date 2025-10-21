"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RetryExhaustedError = exports.IdempotencyConflictError = void 0;
class IdempotencyConflictError extends Error {
    constructor(message) {
        super(message);
        this.name = "IdempotencyConflictError";
    }
}
exports.IdempotencyConflictError = IdempotencyConflictError;
class RetryExhaustedError extends Error {
    constructor(message) {
        super(message);
        this.name = "RetryExhaustedError";
    }
}
exports.RetryExhaustedError = RetryExhaustedError;
