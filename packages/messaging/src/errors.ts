export class IdempotencyConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IdempotencyConflictError";
  }
}

export class RetryExhaustedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RetryExhaustedError";
  }
}
